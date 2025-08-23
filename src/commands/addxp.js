const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { getLevels, saveLevels, getConfig } = require('../utils/github');
const { getLevel } = require('../utils/xp');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('addxp')
        .setDescription('Add XP to a user')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('User to add XP to')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('amount')
                .setDescription('Amount of XP to add')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Reason for adding XP'))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        try {
            const user = interaction.options.getUser('user');
            const amount = interaction.options.getInteger('amount');
            const reason = interaction.options.getString('reason') || 'No reason provided';

            if (amount <= 0) {
                return await interaction.reply({
                    content: '❌ XP amount must be greater than 0!',
                    ephemeral: true
                });
            }

            const data = await getLevels();
            const guildId = interaction.guild.id;
            
            // Ensure data structure exists
            if (!data.guilds) data.guilds = {};
            if (!data.guilds[guildId]) data.guilds[guildId] = {};
            if (!data.guilds[guildId][user.id]) {
                data.guilds[guildId][user.id] = {
                    messages: 0,
                    totalMessages: 0,
                    lastActivity: null,
                    messageHistory: []
                };
            }

            const userData = data.guilds[guildId][user.id];
            const oldMessages = userData.messages || 0;
            const oldLevel = getLevel(oldMessages);
            
            // Add XP
            userData.messages = oldMessages + amount;
            userData.totalMessages = (userData.totalMessages || oldMessages) + amount;
            userData.lastActivity = new Date().toISOString();
            
            // Update message history
            userData.messageHistory.push({
                messages: userData.messages,
                time: userData.lastActivity
            });

            // Keep only last 100 history entries
            if (userData.messageHistory.length > 100) {
                userData.messageHistory.shift();
            }

            const newLevel = getLevel(userData.messages);

            // Save updated data
            await saveLevels(data, `Added ${amount} XP to ${user.tag} by ${interaction.user.tag}`);

            // Handle level up and role management
            if (newLevel > oldLevel) {
                try {
                    const member = await interaction.guild.members.fetch(user.id);
                    await handleRoleUpgrade(member, newLevel, oldLevel);
                    await sendLevelUpNotification(interaction, user, newLevel, userData.messages);
                } catch (memberError) {
                    console.error('Error handling level up for addxp:', memberError);
                }
            }

            // Reply to the command
            await interaction.reply({
                content: `✅ Added **${amount} XP** to ${user} *(${reason})*\n` +
                        `📊 **New Total:** ${userData.messages} messages\n` +
                        `📈 **Level:** ${oldLevel} → **${newLevel}**${newLevel > oldLevel ? ' 🎉' : ''}`,
                ephemeral: true
            });

        } catch (error) {
            console.error('Error in addxp command:', error);
            await interaction.reply({
                content: 'An error occurred while adding XP. Please try again.',
                ephemeral: true
            });
        }
    },
};

// Handle role upgrades when manually adding XP
async function handleRoleUpgrade(member, newLevel, oldLevel) {
    try {
        const config = await getConfig();
        const levelRoles = config?.guilds?.[member.guild.id]?.levelRoles;
        
        if (!levelRoles || Object.keys(levelRoles).length === 0) {
            return; // No level roles configured
        }

        let rolesChanged = false;
        let addedRoles = [];
        let removedRoles = [];

        // Remove ALL old level roles (from level 1 to oldLevel)
        for (let level = 1; level <= oldLevel; level++) {
            const roleId = levelRoles[level];
            if (roleId && member.roles.cache.has(roleId)) {
                const role = member.guild.roles.cache.get(roleId);
                if (role) {
                    try {
                        await member.roles.remove(role, `Manual XP addition: Removed old level ${level} role`);
                        removedRoles.push(role.name);
                        rolesChanged = true;
                        console.log(`Removed level ${level} role: ${role.name} from ${member.user.tag}`);
                    } catch (error) {
                        console.error(`Failed to remove level ${level} role:`, error);
                    }
                }
            }
        }

        // Add ONLY the highest level role the user qualifies for (skip intermediate roles)
        let highestQualifiedLevel = 0;
        const sortedLevels = Object.keys(levelRoles)
            .map(level => parseInt(level))
            .sort((a, b) => b - a); // Sort descending to find highest first

        for (const level of sortedLevels) {
            if (newLevel >= level) {
                highestQualifiedLevel = level;
                break;
            }
        }

        // Add the highest qualified role
        if (highestQualifiedLevel > 0) {
            const roleId = levelRoles[highestQualifiedLevel];
            if (roleId && !member.roles.cache.has(roleId)) {
                const role = member.guild.roles.cache.get(roleId);
                if (role) {
                    try {
                        await member.roles.add(role, `Manual XP addition: Reached level ${newLevel}, qualified for level ${highestQualifiedLevel} role`);
                        addedRoles.push(role.name);
                        rolesChanged = true;
                        console.log(`Added level ${highestQualifiedLevel} role: ${role.name} to ${member.user.tag} (reached level ${newLevel})`);
                    } catch (error) {
                        console.error(`Failed to add level ${highestQualifiedLevel} role:`, error);
                    }
                }
            }
        }

        // Log role changes for debugging
        if (rolesChanged) {
            console.log(`Manual XP role management for ${member.user.tag} level ${oldLevel} → ${newLevel}:`);
            if (removedRoles.length > 0) {
                console.log(`  Removed: ${removedRoles.join(', ')}`);
            }
            if (addedRoles.length > 0) {
                console.log(`  Added: ${addedRoles.join(', ')}`);
            }
        }

    } catch (error) {
        console.error('Error in manual XP role upgrade:', error);
    }
}

// Send level up notification to configured channel
async function sendLevelUpNotification(interaction, user, newLevel, totalMessages) {
    try {
        const config = await getConfig();
        const levelUpChannelId = config?.guilds?.[interaction.guild.id]?.levelUpChannel;
        let levelUpChannel;
        
        if (levelUpChannelId) {
            levelUpChannel = interaction.guild.channels.cache.get(levelUpChannelId);
        }
        
        // If no specific channel is configured, don't send notification for manual XP
        if (!levelUpChannel) {
            console.log('No level-up channel configured, skipping notification for manual XP addition');
            return;
        }

        // Create level up message (only shows the final level reached)
        const levelUpMessage = 
            `🌟 **Level Up!** ${user} just reached **Level ${newLevel}**! 🎉\n` +
            `📊 **Total Messages:** ${totalMessages}\n` +
            `💡 *Keep being active to level up faster!*`;

        // Send the level up notification
        try {
            await levelUpChannel.send(levelUpMessage);
            console.log(`Manual XP level up notification sent to ${levelUpChannel.name} for ${user.tag} → Level ${newLevel}`);
        } catch (sendError) {
            console.error('Failed to send manual XP level up notification:', sendError);
        }
        
    } catch (error) {
        console.error('Error sending level up notification for manual XP:', error);
    }
}