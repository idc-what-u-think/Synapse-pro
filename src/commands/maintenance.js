const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { getConfig, saveConfig } = require('../utils/github');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('maintenance')
        .setDescription('Toggle maintenance mode (AI only responds to admins)')
        .addBooleanOption(option =>
            option
                .setName('enabled')
                .setDescription('Enable or disable maintenance mode')
                .setRequired(true)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        const enabled = interaction.options.getBoolean('enabled');
        const guildId = interaction.guild.id;

        try {
            // Get current config
            const config = await getConfig();
            
            // Initialize guild config if doesn't exist
            if (!config[guildId]) {
                config[guildId] = {};
            }

            // Set maintenance mode
            config[guildId].maintenanceMode = enabled;

            // Save config
            await saveConfig(config, `${enabled ? 'Enabled' : 'Disabled'} maintenance mode for guild ${guildId}`);

            const embed = new EmbedBuilder()
                .setColor(enabled ? 0xFF0000 : 0x00FF00)
                .setTitle(enabled ? '🔧 Maintenance Mode Enabled' : '✅ Maintenance Mode Disabled')
                .setDescription(enabled ? 
                    'AI is now in maintenance mode and will only respond to administrators.' : 
                    'AI maintenance mode has been disabled and normal operation has resumed.'
                )
                .addFields([
                    {
                        name: '🔒 Access Level',
                        value: enabled ? 'Administrators Only' : 'Normal Users (based on channel config)',
                        inline: true
                    },
                    {
                        name: '⚙️ Status',
                        value: enabled ? '🔴 Maintenance Active' : '🟢 Normal Operation',
                        inline: true
                    }
                ])
                .setFooter({ 
                    text: `${enabled ? 'Enabled' : 'Disabled'} by ${interaction.user.username}`,
                    iconURL: interaction.user.displayAvatarURL()
                })
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });

        } catch (error) {
            console.error('Error toggling maintenance mode:', error);
            await interaction.reply({
                content: '❌ **Error:** Failed to toggle maintenance mode. Please try again.',
                ephemeral: true
            });
        }
    }
};
