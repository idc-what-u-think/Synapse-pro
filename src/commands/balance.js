const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getConfig, getBalances } = require('../utils/github');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('balance')
        .setDescription('Check your or another user\'s balance')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('User to check balance for')),

    async execute(interaction) {
        try {
            // Defer immediately to prevent timeout
            await interaction.deferReply({ ephemeral: true });

            const target = interaction.options.getUser('user') || interaction.user;
            
            // Get config and balance data
            const [config, balancesData] = await Promise.all([
                getConfig(),
                getBalances()
            ]);

            const guildSettings = config?.guilds?.[interaction.guild.id]?.settings || {};
            const currency = guildSettings.currency || '💰';
            
            const userBalance = balancesData[target.id] || 0;

            // Calculate rank by sorting all users by balance
            const sortedUsers = Object.entries(balancesData)
                .filter(([userId, balance]) => balance > 0) // Only include users with positive balance
                .sort(([, a], [, b]) => b - a); // Sort by balance descending
            
            const userRank = sortedUsers.findIndex(([userId]) => userId === target.id) + 1;

            const embed = new EmbedBuilder()
                .setColor(0xFFD700)
                .setTitle(`${target.username}'s Balance`)
                .addFields(
                    { name: 'Balance', value: `${currency} ${userBalance.toLocaleString()}`, inline: true },
                    { name: 'Server Rank', value: userRank > 0 ? `#${userRank}` : 'N/A', inline: true },
                    { name: 'User ID', value: target.id, inline: true }
                )
                .setThumbnail(target.displayAvatarURL())
                .setTimestamp();

            // Add footer with total users
            if (sortedUsers.length > 0) {
                embed.setFooter({ text: `Out of ${sortedUsers.length} users with coins` });
            }

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('Balance command error:', error);
            
            try {
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({
                        content: 'An error occurred while checking balance.',
                        ephemeral: true
                    });
                } else {
                    await interaction.editReply({
                        content: 'An error occurred while checking balance.'
                    });
                }
            } catch (replyError) {
                console.error('Error sending error response:', replyError);
            }
        }
    },
};