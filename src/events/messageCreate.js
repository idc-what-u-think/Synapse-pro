const { Events, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { getConfig, getLevels, saveLevels, getData, saveData } = require('../utils/github');
const { getLevel } = require('../utils/xp');

const GEMINI_KEYS = [
    process.env.GEMINI_API_KEY_1,
    process.env.GEMINI_API_KEY_2,
    process.env.GEMINI_API_KEY_3,
    process.env.GEMINI_API_KEY_4,
    process.env.GEMINI_API_KEY_5
].filter(key => key);

console.log(`Found ${GEMINI_KEYS.length} Gemini API keys`);

if (GEMINI_KEYS.length === 0) {
    console.error('No Gemini API keys found! Please set at least GEMINI_API_KEY_1 in your environment variables.');
}

const aiInstances = GEMINI_KEYS.map((key, index) => {
    const genAI = new GoogleGenerativeAI(key);
    return {
        model: genAI.getGenerativeModel({ model: 'gemini-2.5-flash' }),
        key: key.substring(0, 8) + '...',
        index: index + 1
    };
});

let currentKeyIndex = 0;

const rateLimits = new Map();
const RATE_LIMIT_REQUESTS = 10;
const RATE_LIMIT_WINDOW = 60 * 1000;

const URL_PATTERNS = [
    /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/gi,
    /discord\.gg\/[a-zA-Z0-9]+/gi,
    /discordapp\.com\/invite\/[a-zA-Z0-9]+/gi,
    /www\.[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/gi
];

const XP_COOLDOWN = 5 * 1000;
const xpCooldowns = new Map();

function containsLink(message) {
    return URL_PATTERNS.some(pattern => pattern.test(message));
}

function isOnXPCooldown(userId) {
    const lastXPGain = xpCooldowns.get(userId);
    if (!lastXPGain) return false;
    
    const now = Date.now();
    const timeElapsed = now - lastXPGain;
    
    return timeElapsed < XP_COOLDOWN;
}

function setXPCooldown(userId) {
    xpCooldowns.set(userId, Date.now());
}

setInterval(() => {
    const now = Date.now();
    for (const [userId, timestamp] of xpCooldowns.entries()) {
        if (now - timestamp > XP_COOLDOWN * 2) {
            xpCooldowns.delete(userId);
        }
    }
}, 10 * 60 * 1000);

function getNextAIInstance() {
    if (aiInstances.length === 0) {
        throw new Error('No Gemini API keys available');
    }
    
    const instance = aiInstances[currentKeyIndex];
    currentKeyIndex = (currentKeyIndex + 1) % aiInstances.length;
    console.log(`Using AI instance ${instance.index} (${instance.key})`);
    return instance;
}

async function getUserHistory(userId) {
    try {
        console.log(`Loading history for user ${userId}`);
        const historyPath = `data/ai_history/${userId}.json`;
        const history = await getData(historyPath);
        console.log(`Found ${history.messages?.length || 0} messages in history for user ${userId}`);
        return history.messages || [];
    } catch (error) {
        console.log(`No existing history found for user ${userId}, starting fresh`);
        return [];
    }
}

async function saveUserHistory(userId, messages) {
    try {
        console.log(`Saving ${messages.length} messages to history for user ${userId}`);
        const historyPath = `data/ai_history/${userId}.json`;
        await saveData(historyPath, { 
            userId, 
            messages, 
            lastUpdated: new Date().toISOString() 
        }, `Update AI history for user ${userId}`);
        console.log(`Successfully saved history for user ${userId}`);
    } catch (error) {
        console.error(`Error saving user history for ${userId}:`, error);
    }
}

async function addToUserHistory(userId, role, content) {
    try {
        console.log(`Adding ${role} message to history for user ${userId}`);
        let history = await getUserHistory(userId);
        
        history.push({
            role,
            parts: [{ text: content }],
            timestamp: new Date().toISOString()
        });
        
        if (history.length > 10) {
            const removed = history.length - 1;
            history = history.slice(-1);
            console.log(`Trimmed ${removed} old messages from history for user ${userId}`);
        }
        
        await saveUserHistory(userId, history);
        return history;
    } catch (error) {
        console.error(`Error adding to user history for ${userId}:`, error);
        return [];
    }
}

module.exports = {
    name: Events.MessageCreate,
    async execute(message, client) {
        if (message.author.bot) return;
        if (!message.guild) return;

        try {
            const config = await getConfig();
            
            const linkDeleted = await handleAntilink(message, config);
            if (linkDeleted) return;
            
            const wordFiltered = await handleWordFiltering(message, config);
            if (wordFiltered) return;
            
            await handleAIMessage(message, config);
            
            await handleLeveling(message);
            
        } catch (error) {
            console.error('Error in messageCreate event:', error);
        }
    },
};

async function handleAIMessage(message, config) {
    const guildId = message.guild.id;
    const userId = message.author.id;
    const channelId = message.channel.id;

    try {
        console.log(`Processing AI message from ${message.author.tag} in ${message.guild.name}`);
        
        const guildConfig = config[guildId] || {};

        if (guildConfig.maintenanceMode) {
            const member = message.member;
            const isAdmin = member.permissions.has(PermissionFlagsBits.Administrator);
            
            if (!isAdmin) {
                console.log('Bot in maintenance mode, ignoring non-admin message');
                return;
            }
        }

        let shouldRespond = false;
        const botMention = `<@${message.client.user.id}>`;
        const isTagged = message.content.includes(botMention);

        if (guildConfig.aiChannel) {
            if (channelId === guildConfig.aiChannel) {
                shouldRespond = true;
                console.log('Message in AI channel, will respond');
            } else if (isTagged) {
                const member = message.member;
                const isAdmin = member.permissions.has(PermissionFlagsBits.ManageGuild);
                shouldRespond = isAdmin;
                console.log(`Bot tagged by ${isAdmin ? 'admin' : 'non-admin'}, will ${shouldRespond ? '' : 'not '}respond`);
            }
        } else {
            if (isTagged) {
                shouldRespond = true;
                console.log('Bot tagged and no AI channel set, will respond');
            }
        }

        if (!shouldRespond) {
            console.log('Should not respond, skipping AI processing');
            return;
        }

        const now = Date.now();
        const userLimits = rateLimits.get(userId) || { requests: [] };
        
        userLimits.requests = userLimits.requests.filter(time => now - time < RATE_LIMIT_WINDOW);
        
        if (userLimits.requests.length >= RATE_LIMIT_REQUESTS) {
            console.log(`Rate limit exceeded for user ${message.author.tag}`);
            const embed = new EmbedBuilder()
                .setColor(0xFF9900)
                .setDescription('⏰ **Rate limit exceeded!** Please wait a moment before asking again.');
            
            return message.reply({ embeds: [embed] });
        }

        userLimits.requests.push(now);
        rateLimits.set(userId, userLimits);

        message.channel.sendTyping();

        let prompt = message.content.replace(botMention, '').trim();
        
        if (!prompt) {
            console.log('Empty prompt after cleaning, sending greeting');
            const embed = new EmbedBuilder()
                .setColor(0x4285F4)
                .setDescription('👋 **Hi there!** Ask me anything or upload an image for me to analyze!');
            
            return message.reply({ embeds: [embed] });
        }

        console.log(`Processing prompt: "${prompt.substring(0, 100)}${prompt.length > 100 ? '...' : ''}"`);

        if (GEMINI_KEYS.length === 0) {
            throw new Error('No Gemini API keys configured');
        }

        const userHistory = await getUserHistory(userId);
        const aiInstance = getNextAIInstance();

        let result;
        const imageAttachment = message.attachments.find(att => att.contentType?.startsWith('image/'));

        const systemPrompt = "You are a casual, friendly chatbot. Keep responses short and conversational. Be helpful but concise. Use internet slang and abbreviations naturally. Be funny and relatable. Don't give long explanations unless asked. Respond like chatting with a friend on Discord. Know common abbreviations (lol, brb, imo, etc.) and be engaging.";

        const enhancedPrompt = `${systemPrompt}\n\nUser: ${prompt}`;

        if (imageAttachment) {
            console.log('Processing image attachment');
            const response = await fetch(imageAttachment.url);
            const imageBuffer = await response.arrayBuffer();
            const imageData = {
                inlineData: {
                    data: Buffer.from(imageBuffer).toString('base64'),
                    mimeType: imageAttachment.contentType
                }
            };

            const chat = aiInstance.model.startChat({
                history: userHistory
            });

            result = await chat.sendMessage([enhancedPrompt, imageData]);
        } else {
            console.log('Processing text-only message');
            const chat = aiInstance.model.startChat({
                history: userHistory
            });

            result = await chat.sendMessage(enhancedPrompt);
        }

        const responseText = result.response.text();
        console.log(`Generated response length: ${responseText.length} characters`);
        
        await addToUserHistory(userId, 'user', prompt);
        await addToUserHistory(userId, 'model', responseText);
        
        if (responseText.length > 1900) {
            console.log('Response too long, splitting message');
            const embed = new EmbedBuilder()
                .setColor(0x4285F4)
                .setDescription(responseText.substring(0, 1900) + '...')
                .setFooter({ text: 'Response truncated due to Discord limits' });

            await message.reply({ embeds: [embed] });
            
            const remaining = responseText.substring(1900);
            if (remaining.length > 0) {
                await message.channel.send(remaining.substring(0, 1900));
            }
        } else {
            await message.reply(responseText);
        }

        console.log(`Successfully processed AI message for ${message.author.tag}`);

    } catch (error) {
        console.error('Detailed AI Message Error:', error);
        console.error('Error stack:', error.stack);

        let errorMessage = '❌ **An error occurred while processing your request.**';

        if (error.message?.includes('quota')) {
            errorMessage = '⚠️ **Quota exceeded!** Please try again later.';
        } else if (error.message?.includes('rate limit')) {
            errorMessage = '⏰ **Rate limit hit!** Please wait a moment.';
        } else if (error.message?.includes('blocked')) {
            errorMessage = '🚫 **Content blocked!** Your request was flagged by safety filters.';
        } else if (error.message?.includes('No Gemini API keys')) {
            errorMessage = '⚙️ **Configuration error!** No AI keys available.';
        }

        const embed = new EmbedBuilder()
            .setColor(0xFF0000)
            .setDescription(errorMessage);

        try {
            await message.reply({ embeds: [embed] });
        } catch (replyError) {
            console.error('Failed to send error message:', replyError);
        }
    }
}

async function handleAntilink(message, config) {
    try {
        const guildConfig = config?.guilds?.[message.guild.id];
        const antilink = guildConfig?.antilink;

        if (!antilink || !antilink.enabled) return false;

        if (!antilink.protectedChannels.includes(message.channel.id)) return false;

        if (antilink.bypassRoles?.some(roleId => message.member.roles.cache.has(roleId))) return false;

        if (message.member.permissions.has(PermissionFlagsBits.Administrator)) return false;

        if (containsLink(message.content)) {
            console.log(`Link detected from ${message.author.tag} in #${message.channel.name}: ${message.content}`);
            
            await message.delete();
            
            const warningText = antilink.message || "please refrain from sending links in this channel";
            const warningMessage = await message.channel.send(
                `${message.author}, ${warningText}`
            );
            
            setTimeout(() => {
                warningMessage.delete().catch(() => {});
            }, 5000);
            
            console.log(`Antilink: Deleted link from ${message.author.tag} in #${message.channel.name}`);
            return true;
        }

        return false;
    } catch (error) {
        console.error('Error in antilink handler:', error);
        return false;
    }
}

async function handleWordFiltering(message, config) {
    try {
        console.log('Checking word filter...');
        const filter = config.guilds?.[message.guild.id]?.filter;
        
        if (!filter?.words || Object.keys(filter.words).length === 0) {
            console.log('No word filter configured for this guild');
            return false;
        }
        
        if (filter.bypassRoles?.some(roleId => message.member.roles.cache.has(roleId))) {
            console.log('User has bypass role, skipping filter');
            return false;
        }

        if (message.member.permissions.has(PermissionFlagsBits.Administrator)) return false;

        const content = message.content.toLowerCase();
        console.log('Checking message against word filters...');
        
        for (const [word, filterConfig] of Object.entries(filter.words)) {
            const pattern = new RegExp(filterConfig.pattern, 'i');
            if (pattern.test(content)) {
                console.log(`Filtered word detected: ${word}`);
                
                try {
                    await message.delete();
                    console.log('Message deleted');
                } catch (deleteError) {
                    console.error('Failed to delete message:', deleteError);
                }
                
                try {
                    switch (filterConfig.action) {
                        case 'mute':
                            await message.member.timeout(3600000, `Filtered word: ${word}`);
                            console.log(`User muted for filtered word: ${word}`);
                            break;
                            
                        case 'warn':
                            console.log(`User should be warned for filtered word: ${word}`);
                            break;
                            
                        case 'ban':
                            await message.member.ban({ reason: `Filtered word: ${word}` });
                            console.log(`User banned for filtered word: ${word}`);
                            break;
                            
                        default:
                            console.log(`Filter action 'delete' applied for word: ${word}`);
                    }
                } catch (actionError) {
                    console.error(`Failed to apply filter action ${filterConfig.action}:`, actionError);
                }
                
                return true;
            }
        }
        
        return false;
    } catch (error) {
        console.error('Error in word filtering:', error);
        return false;
    }
}

async function handleLeveling(message) {
    try {
        if (isOnXPCooldown(message.author.id)) {
            console.log(`${message.author.tag} is on XP cooldown, skipping XP gain`);
            return;
        }

        console.log('Processing XP for message...');
        const data = await getLevels();
        const guildId = message.guild.id;
        
        if (!data.guilds) data.guilds = {};
        if (!data.guilds[guildId]) data.guilds[guildId] = {};
        if (!data.guilds[guildId][message.author.id]) {
            data.guilds[guildId][message.author.id] = {
                messages: 0,
                totalMessages: 0,
                lastActivity: null,
                messageHistory: []
            };
        }

        const userData = data.guilds[guildId][message.author.id];
        const oldLevel = getLevel(userData.messages);
        
        userData.messages++;
        userData.totalMessages++;
        userData.lastActivity = new Date().toISOString();
        userData.messageHistory.push({
            messages: userData.messages,
            time: userData.lastActivity
        });

        if (userData.messageHistory.length > 100) {
            userData.messageHistory.shift();
        }

        const newLevel = getLevel(userData.messages);
        
        setXPCooldown(message.author.id);
        
        await saveLevels(data, `Updated XP for ${message.author.tag}`);
        console.log(`XP updated for ${message.author.tag}: ${userData.messages} messages, level ${newLevel} (cooldown set for 5s)`);

        if (newLevel > oldLevel) {
            console.log(`Level up! ${message.author.tag} reached level ${newLevel}`);
            await handleLevelUp(message, userData, newLevel, oldLevel, data.guilds[guildId]);
        }
        
    } catch (error) {
        console.error('Error in leveling system:', error);
    }
}

async function handleLevelUp(message, userData, newLevel, oldLevel, guildData) {
    try {
        await handleAutomaticRoleManagement(message, newLevel, oldLevel);
        
        const config = await getConfig();
        const levelUpChannelId = config?.guilds?.[message.guild.id]?.levelUpChannel;
        let levelUpChannel;
        
        if (levelUpChannelId) {
            levelUpChannel = message.guild.channels.cache.get(levelUpChannelId);
        }
        
        if (!levelUpChannel) {
            levelUpChannel = message.channel;
        }

        const levelUpMessage = 
            `🌟 **Level Up!** ${message.author} just reached **Level ${newLevel}**! 🎉\n` +
            `📊 **Total Messages:** ${userData.messages}\n` +
            `⬆️ **Previous Level:** ${oldLevel}\n` +
            `💡 *Keep being active to level up faster!*`;

        try {
            await levelUpChannel.send(levelUpMessage);
            console.log(`Level up notification sent to ${levelUpChannel.name}`);
        } catch (sendError) {
            console.error('Failed to send level up notification:', sendError);
            
            if (levelUpChannel !== message.channel) {
                try {
                    await message.channel.send(levelUpMessage);
                    console.log('Level up notification sent to message channel as fallback');
                } catch (fallbackError) {
                    console.error('Failed to send level up notification to fallback channel:', fallbackError);
                }
            }
        }
        
        await handleLevelRewards(message, newLevel, guildData);
        
    } catch (error) {
        console.error('Error handling level up:', error);
    }
}

async function handleLevelRewards(message, level, guildData) {
    try {
        if (!guildData?.levelRewards) return;
        
        const rewards = guildData.levelRewards[level];
        if (!rewards) return;
        
        if (rewards.roles && rewards.roles.length > 0) {
            for (const roleId of rewards.roles) {
                const role = message.guild.roles.cache.get(roleId);
                if (role && !message.member.roles.cache.has(roleId)) {
                    try {
                        await message.member.roles.add(role, `Level ${level} reward`);
                        console.log(`Added role ${role.name} to ${message.author.tag} for reaching level ${level}`);
                    } catch (roleError) {
                        console.error(`Failed to add role ${role.name}:`, roleError);
                    }
                }
            }
        }
        
        if (rewards.message) {
            await message.channel.send(`🎁 **Level ${level} Reward:** ${rewards.message}`);
        }
        
    } catch (error) {
        console.error('Error handling level rewards:', error);
    }
}

function getRequiredMessages(level) {
    return level * level * 100;
}

async function handleAutomaticRoleManagement(message, newLevel, oldLevel) {
    try {
        const config = await getConfig();
        const levelRoles = config?.guilds?.[message.guild.id]?.levelRoles;
        
        if (!levelRoles || Object.keys(levelRoles).length === 0) {
            return;
        }

        const member = message.member;
        let rolesChanged = false;
        let addedRoles = [];
        let removedRoles = [];

        for (let level = 1; level <= oldLevel; level++) {
            const roleId = levelRoles[level];
            if (roleId && member.roles.cache.has(roleId)) {
                const role = message.guild.roles.cache.get(roleId);
                if (role) {
                    try {
                        await member.roles.remove(role, `Level up: Removed old level ${level} role`);
                        removedRoles.push(role.name);
                        rolesChanged = true;
                        console.log(`Removed level ${level} role: ${role.name} from ${message.author.tag}`);
                    } catch (error) {
                        console.error(`Failed to remove level ${level} role:`, error);
                    }
                }
            }
        }

        const newRoleId = levelRoles[newLevel];
        if (newRoleId && !member.roles.cache.has(newRoleId)) {
            const newRole = message.guild.roles.cache.get(newRoleId);
            if (newRole) {
                try {
                    await member.roles.add(newRole, `Level up: Reached level ${newLevel}`);
                    addedRoles.push(newRole.name);
                    rolesChanged = true;
                    console.log(`Added level ${newLevel} role: ${newRole.name} to ${message.author.tag}`);
                } catch (error) {
                    console.error(`Failed to add level ${newLevel} role:`, error);
                }
            }
        }

        if (rolesChanged) {
            console.log(`Role management for ${message.author.tag} level up ${oldLevel} → ${newLevel}:`);
            if (removedRoles.length > 0) {
                console.log(`  Removed: ${removedRoles.join(', ')}`);
            }
            if (addedRoles.length > 0) {
                console.log(`  Added: ${addedRoles.join(', ')}`);
            }
        }

    } catch (error) {
        console.error('Error in automatic role management:', error);
    }
}
