const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('signup')
        .setDescription('Create your sensitivity generator account'),
    
    async execute(interaction) {
        try {
            // Create account info (you can save to GitHub or database)
            const userId = interaction.user.id;
            const username = interaction.user.username;
            
            // Send DM
            const dmEmbed = new EmbedBuilder()
                .setTitle('🎉 Welcome to Sensitivity Generator!')
                .setDescription(`Hey **${username}**! Your account has been created.`)
                .setColor(0x00ff00)
                .addFields(
                    {
                        name: '📊 Account Info',
                        value: `**Username:** ${username}\n**Role:** FREE\n**Created:** ${new Date().toLocaleString()}`
                    },
                    {
                        name: '🎮 Commands',
                        value: '• `/generate` - Generate sensitivity settings\n• `/sensi-profile` - View your profile'
                    },
                    {
                        name: '📱 How to Use',
                        value: '1. Visit https://gamingsensitivity.vercel.app\n2. Find your device name\n3. Use `/generate` with your device'
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
                    content: `✅ **Account created!** (Couldn't send DM - please enable DMs from server members)`,
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
