const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getData } = require('../utils/github');
const { getLevel, getMessagesForNextLevel } = require('../utils/xp');

function formatTime(ms) {
    if (ms < 0) return 'N/A';
    const sec = Math.floor(ms / 1000) % 60;
    const min = Math.floor(ms / 60000) % 60;
    const hr = Math.floor(ms / 3600000);
    return `${hr}h ${min}m ${sec}s`;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('xp')
        .setDescription('Show detailed XP info for a user')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('User to check')
                .setRequired(false)),
    async execute(interaction, octokit, owner, repo) {
        const user = interaction.options.getUser('user') || interaction.user;
        const guildId = interaction.guild.id;
        const data = await getData(octokit, owner, repo, 'levels.json');
        const userData = data?.[guildId]?.[user.id] || { messages: 0, totalMessages: 0, lastActivity: null, messageHistory: [] };

        const messages = userData.messages || 0;
        const totalMessages = userData.totalMessages || messages;
        const lastActivity = userData.lastActivity ? `<t:${Math.floor(new Date(userData.lastActivity).getTime()/1000)}:R>` : 'N/A';
        const level = getLevel(messages);
        const messagesForNext = getMessagesForNextLevel(messages);

        // Calculate message rate (last 10 entries)
        let gainRate = 'N/A';
        if (userData.messageHistory && userData.messageHistory.length >= 2) {
            const sorted = userData.messageHistory.slice(-10);
            const first = sorted[0];
            const last = sorted[sorted.length - 1];
            const deltaMessages = last.messages - first.messages;
            const deltaTime = new Date(last.time) - new Date(first.time);
            if (deltaTime > 0) {
                gainRate = `${(deltaMessages / (deltaTime / 3600000)).toFixed(2)} msgs/hr`;
            }
        }

        // Estimate time to next level
        let timeToNext = 'N/A';
        if (gainRate !== 'N/A' && parseFloat(gainRate)) {
            const ratePerMs = parseFloat(gainRate) / 3600000;
            timeToNext = formatTime(messagesForNext / ratePerMs);
        }

        const embed = new EmbedBuilder()
            .setColor(0x8e44ad)
            .setTitle(`${user.username}'s Level Details`)
            .addFields(
                { name: 'Level', value: `${level}`, inline: true },
                { name: 'Messages', value: `${messages}`, inline: true },
                { name: 'Total Messages', value: `${totalMessages}`, inline: true },
                { name: 'Last Activity', value: lastActivity, inline: true },
                { name: 'Message Rate', value: gainRate, inline: true },
                { name: 'Messages to Next Level', value: `${messagesForNext}`, inline: true },
                { name: 'Est. Time to Next Level', value: timeToNext, inline: false }
            )
            .setThumbnail(user.displayAvatarURL())
            .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: false });
    }
};