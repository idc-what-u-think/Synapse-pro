const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const github = require('../utils/github');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('signup')
        .setDescription('Create your sensitivity generator account'),
    
    async execute(interaction) {
        try {
            const userId = interaction.user.id;
            const username = interaction.user.username;
            
            // Load existing users
            const sensiData = await github.getSensiUsers();
            
            // Check if user already exists
            if (sensiData.users[userId]) {
                return await interaction.reply({
                    content: `✅ **Welcome back, ${username}!**\n\nYour account already exists!\n📊 Role: **${sensiData.users[userId].role.toUpperCase()}**\n🎯 Total Generations: **${sensiData.users[userId].totalGenerations}**`,
                    ephemeral: true
                });
            }
            
            // Create new user
            sensiData.users[userId] = {
                userId: userId,
                username: username,
                role: 'free',
                totalGenerations: 0,
                generationsToday: 0,
                lastGenerationDate: null,
                createdAt: new Date().toISOString(),
                lastLogin: new Date().toISOString(),
                vipGrantedBy: null,
                vipGrantedAt: null,
                isBanned: false,
                banReason: null
            };
            
            await github.saveSensiUsers(sensiData, `Created account for ${username}`);
            
            // Send DM
            const dmEmbed = new EmbedBuilder()
                .setTitle('🎉 Welcome to Sensitivity Generator!')
                .setDescription(`Hey **${username}**! Your account has been created.`)
                .setColor(0x00ff00)
                .addFields(
                    {
                        name: '📊 Account Info',
                        value: `**Discord ID:** ${userId}\n**Username:** ${username}\n**Role:** FREE\n**Created:** ${new Date().toLocaleString()}`
                    },
                    {
                        name: '🎮 Commands',
                        value: '• `/generate` - Generate sensitivity settings\n• `/sensi-profile` - View your profile'
                    },
                    {
                        name: '📱 How to Use',
                        value: '1. Visit https://gamingsensitivity.vercel.app\n2. Find your device name\n3. Use `/generate` with your device'
                    },
                    {
                        name: '💎 VIP Features',
                        value: 'Upgrade to VIP to unlock:\n• Advanced Free Fire calculator\n• 4 play styles\n• Drag speed & weapon preferences\n• Image exports'
                    }
                )
                .setTimestamp();

            try {
                await interaction.user.send({ embeds: [dmEmbed] });
                await interaction.reply({
                    content: `✅ **Account created, ${username}!** Check your DMs for details.`,
                    ephemeral: true
                });
            } catch (error) {
                await interaction.reply({
                    content: `✅ **Account created!** (Couldn't send DM - please enable DMs)`,
                    ephemeral: true
                });
            }
        } catch (error) {
            console.error('Signup error:', error);
            await interaction.reply({
                content: '❌ An error occurred while creating your account.',
                ephemeral: true
            });
        }
    }
};
