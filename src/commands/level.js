const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getLevels } = require('../utils/github');
const { getLevel, getMessagesForNextLevel } = require('../utils/xp');

function formatNumber(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function makeProgressBar(messages) {
    const currentLevel = getLevel(messages);
    const messagesForCurrentLevel = getMessagesForLevel(currentLevel);
    const messagesForNextLevel = getMessagesForLevel(currentLevel + 1);
    
    // Calculate progress within current level
    const currentLevelStart = getTotalMessagesUpToLevel(currentLevel);
    const nextLevelStart = getTotalMessagesUpToLevel(currentLevel + 1);
    const progressInLevel = messages - currentLevelStart;
    const totalForLevel = nextLevelStart - currentLevelStart;
    
    const barLength = 20;
    const filled = Math.round((progressInLevel / totalForLevel) * barLength);
    return `\`[${'█'.repeat(filled)}${'░'.repeat(barLength - filled)}]\` ${formatNumber(progressInLevel)}/${formatNumber(totalForLevel)} XP`;
}

// Helper functions to match your XP system
function getMessagesForLevel(level) {
    return 5 * (level * level);
}

function getTotalMessagesUpToLevel(level) {
    let total = 0;
    for (let i = 1; i <= level; i++) {
        total += getMessagesForLevel(i);
    }
    return total;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('level')
        .setDescription('Show your or another user\'s level and XP')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('User to check')
                .setRequired(false)),

    async execute(interaction) {
        try {
            const user = interaction.options.getUser('user') || interaction.user;
            const guildId = interaction.guild.id;
            const data = await getLevels();
            const userData = data?.guilds?.[guildId]?.[user.id] || { 
                messages: 0, 
                totalMessages: 0, 
                lastActivity: null 
            };

            // Calculate rank
            const guildData = data?.guilds?.[guildId] || {};
            const allUsers = Object.entries(guildData)
                .map(([userId, userData]) => ({
                    id: userId,
                    messages: userData.messages || 0
                }))
                .sort((a, b) => b.messages - a.messages);

            const rank = allUsers.findIndex(userObj => userObj.id === user.id) + 1;

            const messages = userData.messages || 0;
            const level = getLevel(messages);
            const messagesToNext = getMessagesForNextLevel(messages);

            // Create embed
            const embed = new EmbedBuilder()
                .setColor(rank === 1 ? 0xFFD700 : rank === 2 ? 0xC0C0C0 : rank === 3 ? 0xCD7F32 : 0x3498db)
                .setTitle(`${user.username}'s Level`)
                .addFields(
                    { name: '📊 Level', value: `${level}`, inline: true },
                    { name: '💬 Messages', value: `${formatNumber(messages)}`, inline: true },
                    { name: '🏆 Rank', value: `#${rank || 'N/A'}`, inline: true },
                    { name: '📈 Progress', value: makeProgressBar(messages), inline: false },
                    { name: '🎯 Messages to Next Level', value: `${formatNumber(messagesToNext)}`, inline: false }
                )
                .setThumbnail(user.displayAvatarURL())
                .setFooter({ 
                    text: `${interaction.guild.name} • Total Users: ${allUsers.length}`,
                    iconURL: interaction.guild.iconURL()
                })
                .setTimestamp();

            // Add special indicators for top 3
            if (rank === 1) {
                embed.setDescription('🥇 **Server Champion!**');
            } else if (rank === 2) {
                embed.setDescription('🥈 **Runner Up!**');
            } else if (rank === 3) {
                embed.setDescription('🥉 **Third Place!**');
            } else if (rank <= 10) {
                embed.setDescription('⭐ **Top 10 Member!**');
            }

            await interaction.reply({ embeds: [embed] });

        } catch (error) {
            console.error('Error in level command:', error);
            await interaction.reply({
                content: 'An error occurred while fetching level data. Please try again.',
                ephemeral: true
            });
        }
    }
};