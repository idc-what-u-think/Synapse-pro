const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getData } = require('../utils/github');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('balance')
        .setDescription('Check your or another user\'s balance')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('User to check balance for')),

    async execute(interaction, octokit, owner, repo) {
        const target = interaction.options.getUser('user') || interaction.user;
        const data = await getData(octokit, owner, repo, 'economy.json');
        const guildData = data?.guilds?.[interaction.guild.id] || {};
        const userData = guildData?.economy?.[target.id] || {
            balance: 0,
            totalEarned: 0,
            totalSpent: 0
        };

        // Calculate rank
        const sortedUsers = Object.entries(guildData?.economy || {})
            .sort(([, a], [, b]) => (b.balance || 0) - (a.balance || 0));
        const rank = sortedUsers.findIndex(([id]) => id === target.id) + 1;

        const currency = guildData?.settings?.currency || '💰';

        const embed = new EmbedBuilder()
            .setColor(0xFFD700)
            .setTitle(`${target.username}'s Balance`)
            .addFields(
                { name: 'Balance', value: `${currency} ${userData.balance.toLocaleString()}`, inline: true },
                { name: 'Rank', value: rank ? `#${rank}` : 'N/A', inline: true },
                { name: 'Total Earned', value: `${currency} ${userData.totalEarned.toLocaleString()}`, inline: true },
                { name: 'Total Spent', value: `${currency} ${userData.totalSpent.toLocaleString()}`, inline: true }
            )
            .setThumbnail(target.displayAvatarURL())
            .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
    },
};
