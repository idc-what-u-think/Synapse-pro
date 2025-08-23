const { Events, PermissionFlagsBits } = require('discord.js');
const { getConfig, getLevels, saveLevels } = require('../utils/github');
const { getLevel } = require('../utils/xp');

// URL detection regex patterns
const URL_PATTERNS = [
    /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/gi,
    /discord\.gg\/[a-zA-Z0-9]+/gi,
    /discordapp\.com\/invite\/[a-zA-Z0-9]+/gi,
    /www\.[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/gi
];

// XP Cooldown system - 5 seconds
const XP_COOLDOWN = 5 * 1000; // 5 seconds in milliseconds
const xpCooldowns = new Map(); // userId -> timestamp

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

// Clean up old cooldown entries every 10 minutes to prevent memory leaks
setInterval(() => {
    const now = Date.now();
    for (const [userId, timestamp] of xpCooldowns.entries()) {
        if (now - timestamp > XP_COOLDOWN * 2) { // Clean entries older than 2x cooldown
            xpCooldowns.delete(userId);
        }
    }
}, 10 * 60 * 1000); // 10 minutes

module.exports = {
    name: Events.MessageCreate,
    async execute(message, client) {
        if (message.author.bot) return;
        if (!message.guild) return; // Ignore DMs

        try {
            // Get config once for all handlers
            const config = await getConfig();
            
            // Handle antilink protection (check first, before other handlers)
            const linkDeleted = await handleAntilink(message, config);
            if (linkDeleted) return; // Don't process further if message was deleted
            
            // Handle word filtering
            const wordFiltered = await handleWordFiltering(message, config);
            if (wordFiltered) return; // Don't process further if message was deleted
            
            // Handle XP/leveling system (only if message wasn't deleted)
            await handleLeveling(message);
            
        } catch (error) {
            console.error('Error in messageCreate event:', error);
        }
    },
};

async function handleAntilink(message, config) {
    try {
        const guildConfig = config?.guilds?.[message.guild.id];
        const antilink = guildConfig?.antilink;

        // Skip if antilink not configured or disabled
        if (!antilink || !antilink.enabled) return false;

        // Skip if channel not protected
        if (!antilink.protectedChannels.includes(message.channel.id)) return false;

        // Skip if user has bypass role
        if (antilink.bypassRoles?.some(roleId => message.member.roles.cache.has(roleId))) return false;

        // Skip if user has admin permissions
        if (message.member.permissions.has(PermissionFlagsBits.Administrator)) return false;

        // Check for links
        if (containsLink(message.content)) {
            console.log(`Link detected from ${message.author.tag} in #${message.channel.name}: ${message.content}`);
            
            // Delete the message
            await message.delete();
            
            // Send warning message
            const warningText = antilink.message || "please refrain from sending links in this channel";
            const warningMessage = await message.channel.send(
                `${message.author}, ${warningText}`
            );
            
            // Auto-delete warning after 5 seconds
            setTimeout(() => {
                warningMessage.delete().catch(() => {});
            }, 5000);
            
            console.log(`Antilink: Deleted link from ${message.author.tag} in #${message.channel.name}`);
            return true; // Message was deleted
        }

        return false; // No link found
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
        
        // Check bypass roles
        if (filter.bypassRoles?.some(roleId => message.member.roles.cache.has(roleId))) {
            console.log('User has bypass role, skipping filter');
            return false;
        }

        // Skip if user has admin permissions
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
                            console.log(`Filter action 'delete' applied for word: ${word}`);
                    }
                } catch (actionError) {
                    console.error(`Failed to apply filter action ${filterConfig.action}:`, actionError);
                }
                
                return true; // Message was filtered/deleted
            }
        }
        
        return false; // No filtered words found
    } catch (error) {
        console.error('Error in word filtering:', error);
        return false;
    }
}

async function handleLeveling(message) {
    try {
        // Check XP cooldown first
        if (isOnXPCooldown(message.author.id)) {
            console.log(`${message.author.tag} is on XP cooldown, skipping XP gain`);
            return;
        }

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
        
        // Set XP cooldown AFTER successful XP gain
        setXPCooldown(message.author.id);
        
        // Save the updated data
        await saveLevels(data, `Updated XP for ${message.author.tag}`);
        console.log(`XP updated for ${message.author.tag}: ${userData.messages} messages, level ${newLevel} (cooldown set for 5s)`);

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
        // Handle automatic role management first
        await handleAutomaticRoleManagement(message, newLevel, oldLevel);
        
        // Get updated config to check for level-up channel
        const config = await getConfig();
        const levelUpChannelId = config?.guilds?.[message.guild.id]?.levelUpChannel;
        let levelUpChannel;
        
        if (levelUpChannelId) {
            levelUpChannel = message.guild.channels.cache.get(levelUpChannelId);
        }
        
        // If no specific channel is configured, use the current channel
        if (!levelUpChannel) {
            levelUpChannel = message.channel;
        }

        // Create level up message (removed message remaining count as requested)
        const levelUpMessage = 
            `🌟 **Level Up!** ${message.author} just reached **Level ${newLevel}**! 🎉\n` +
            `📊 **Total Messages:** ${userData.messages}\n` +
            `⬆️ **Previous Level:** ${oldLevel}\n` +
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

// Automatic role management when users level up
async function handleAutomaticRoleManagement(message, newLevel, oldLevel) {
    try {
        // Get config to check for level roles
        const config = await getConfig();
        const levelRoles = config?.guilds?.[message.guild.id]?.levelRoles;
        
        if (!levelRoles || Object.keys(levelRoles).length === 0) {
            return; // No level roles configured
        }

        const member = message.member;
        let rolesChanged = false;
        let addedRoles = [];
        let removedRoles = [];

        // Remove old level roles (from levels 1 to oldLevel)
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

        // Add new level role (for the current level achieved)
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

        // Log role changes for debugging
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