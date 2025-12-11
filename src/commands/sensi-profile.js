const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('sensi-profile')
        .setDescription('View your sensitivity generator profile'),
    
    async execute(interaction) {
        try {
            const userId = interaction.user.id;
            const username = interaction.user.username;
            
            // TODO: Load from database/GitHub
            const userData = {
                role: 'free',
                totalGenerations: 0,
                createdAt: new Date()
            };

            const roleEmoji = userData.role === 'vip' ? '⭐' : '🆓';

            const embed = new EmbedBuilder()
                .setTitle('📊 Your Sensitivity Profile')
                .setColor(0x5865F2)
                .addFields(
                    { name: '👤 Username', value: username, inline: true },
                    { name: `${roleEmoji} Role`, value: userData.role.toUpperCase(), inline: true },
                    { name: '🎯 Total Generations', value: userData.totalGenerations.toString(), inline: true },
                    { name: '📅 Member Since', value: userData.createdAt.toLocaleDateString(), inline: false }
                )
                .setThumbnail(interaction.user.displayAvatarURL())
                .setTimestamp();

            await interaction.reply({ embeds: [embed], ephemeral: true });
        } catch (error) {
            console.error('Profile error:', error);
            await interaction.reply({
                content: '❌ An error occurred while loading your profile.',
                ephemeral: true
            });
        }
    }
};
