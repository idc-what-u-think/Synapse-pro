const { Events } = require('discord.js');
const { getConfig, getLevels, saveLevels } = require('../utils/github');
const { getLevel } = require('../utils/xp');

module.exports = {
    name: Events.MessageCreate,
    async execute(message, client) {
        if (message.author.bot) return;
        if (!message.guild) return; // Ignore DMs

        try {
            // Handle word filtering
            await handleWordFiltering(message);
            
            // Handle XP/leveling system
            await handleLeveling(message);
            
        } catch (error) {
            console.error('Error in messageCreate event:', error);
        }
    },
};

async function handleWordFiltering(message) {
    try {
        console.log('Checking word filter...');
        const config = await getConfig();
        const filter = config.guilds?.[message.guild.id]?.filter;
        
        if (!filter?.words || Object.keys(filter.words).length === 0) {
            console.log('No word filter configured for this guild');
            return;
        }
        
        // Check bypass roles
        if (filter.bypassRoles?.some(roleId => message.member.roles.cache.has(roleId))) {
            console.log('User has bypass role, skipping filter');
            return;
        }

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
                
                // Apply the configured action
                try {
                    switch (filterConfig.action) {
                        case 'mute':
                            await message.member.timeout(3600000, `Filtered word: ${word}`);
                            console.log(`User muted for filtered word: ${word}`);
                            break;
                            
                        case 'warn':
                            // You'll need to implement a warn system or call your warn command
                            console.log(`User should be warned for filtered word: ${word}`);
                            // Example: await handleWarn(message.member, `Filtered word: ${word}`);
                            break;
                            
                        case 'ban':
                            await message.member.ban({ reason: `Filtered word: ${word}` });
                            console.log(`User banned for filtered word: ${word}`);
                            break;
                            
                        default:
                            console.log(`Unknown filter action: ${filterConfig.action}`);
                    }
                } catch (actionError) {
                    console.error(`Failed to apply filter action ${filterConfig.action}:`, actionError);
                }
                
                break; // Only apply the first matching filter
            }
        }
    } catch (error) {
        console.error('Error in word filtering:', error);
    }
}

async function handleLeveling(message) {
    try {
        console.log('Processing XP for message...');
        const data = await getLevels();
        const guildId = message.guild.id;
        
        // Ensure guild data structure exists
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
        
        // Update user data
        userData.messages++;
        userData.totalMessages++;
        userData.lastActivity = new Date().toISOString();
        userData.messageHistory.push({
            messages: userData.messages,
            time: userData.lastActivity
        });

        // Keep only last 100 history entries to prevent data bloat
        if (userData.messageHistory.length > 100) {
            userData.messageHistory.shift();
        }

        const newLevel = getLevel(userData.messages);
        
        // Save the updated data
        await saveLevels(data, `Updated XP for ${message.author.tag}`);
        console.log(`XP updated for ${message.author.tag}: ${userData.messages} messages, level ${newLevel}`);

        // Handle level up notification
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
        // Check if there's a configured level-up channel
        const levelUpChannelId = guildData?.levelUpChannel;
        let levelUpChannel;
        
        if (levelUpChannelId) {
            levelUpChannel = message.guild.channels.cache.get(levelUpChannelId);
        }
        
        // If no specific channel is configured, use the current channel
        if (!levelUpChannel) {
            levelUpChannel = message.channel;
        }

        // Create level up message
        const levelUpMessage = 
            `🌟 **Level Up!** ${message.author} just reached **Level ${newLevel}**! 🎉\n` +
            `📊 **Total Messages:** ${userData.messages}\n` +
            `⬆️ **Previous Level:** ${oldLevel}\n` +
            `🎯 **Next Level:** ${newLevel + 1} (${getRequiredMessages(newLevel + 1) - userData.messages} messages to go!)\n` +
            `💡 *Keep being active to level up faster!*`;

        // Send the level up notification
        try {
            await levelUpChannel.send(levelUpMessage);
            console.log(`Level up notification sent to ${levelUpChannel.name}`);
        } catch (sendError) {
            console.error('Failed to send level up notification:', sendError);
            
            // Try to send in the original channel if the configured channel failed
            if (levelUpChannel !== message.channel) {
                try {
                    await message.channel.send(levelUpMessage);
                    console.log('Level up notification sent to message channel as fallback');
                } catch (fallbackError) {
                    console.error('Failed to send level up notification to fallback channel:', fallbackError);
                }
            }
        }
        
        // Optional: Add role rewards for certain levels
        await handleLevelRewards(message, newLevel, guildData);
        
    } catch (error) {
        console.error('Error handling level up:', error);
    }
}

async function handleLevelRewards(message, level, guildData) {
    try {
        // Check if there are level rewards configured
        if (!guildData?.levelRewards) return;
        
        const rewards = guildData.levelRewards[level];
        if (!rewards) return;
        
        // Handle role rewards
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
        
        // Handle other potential rewards (coins, items, etc.)
        if (rewards.message) {
            await message.channel.send(`🎁 **Level ${level} Reward:** ${rewards.message}`);
        }
        
    } catch (error) {
        console.error('Error handling level rewards:', error);
    }
}

// Helper function to calculate required messages for a level
function getRequiredMessages(level) {
    // This should match your XP system's calculation
    // Adjust this based on your actual level calculation
    return level * level * 100; // Example calculation
}