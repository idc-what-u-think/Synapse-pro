const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const github = require('../utils/github');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('sensi-profile')
        .setDescription('View your sensitivity generator profile'),
    
    async execute(interaction) {
        try {
            const userId = interaction.user.id;
            const username = interaction.user.username;
            
            // Load user data
            const sensiData = await github.getSensiUsers();
            const userData = sensiData.users[userId];

            if (!userData) {
                return await interaction.reply({
                    content: '❌ You don\'t have an account yet! Use `/signup` to create one.',
                    ephemeral: true
                });
            }

            // Update last login
            userData.lastLogin = new Date().toISOString();
            await github.saveSensiUsers(sensiData, `Updated login for ${username}`);

            const roleEmoji = userData.role === 'admin' ? '👑' : userData.role === 'vip' ? '⭐' : '🆓';

            const embed = new EmbedBuilder()
                .setTitle('📊 Your Sensitivity Profile')
                .setColor(userData.role === 'vip' ? 0xFFD700 : 0x5865F2)
                .addFields(
                    { name: '👤 Username', value: username, inline: true },
                    { name: `${roleEmoji} Role`, value: userData.role.toUpperCase(), inline: true },
                    { name: '🎯 Generations Today', value: userData.generationsToday.toString(), inline: true },
                    { name: '📈 Total Generations', value: userData.totalGenerations.toString(), inline: true },
                    { name: '📅 Member Since', value: new Date(userData.createdAt).toLocaleDateString(), inline: true },
                    { name: '🕒 Last Active', value: new Date(userData.lastLogin).toLocaleDateString(), inline: true }
                )
                .setThumbnail(interaction.user.displayAvatarURL())
                .setTimestamp();

            if (userData.role === 'vip' && userData.vipGrantedAt) {
                embed.addFields({
                    name: '💎 VIP Info',
                    value: `Granted: ${new Date(userData.vipGrantedAt).toLocaleDateString()}`
                });
            }

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
