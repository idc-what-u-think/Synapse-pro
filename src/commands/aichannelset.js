const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { getConfig, saveConfig } = require('../utils/github');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('aichannelset')
        .setDescription('Set the channel where AI will automatically respond')
        .addChannelOption(option =>
            option
                .setName('channel')
                .setDescription('Channel where AI will respond automatically')
                .setRequired(true)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

    async execute(interaction) {
        const channel = interaction.options.getChannel('channel');
        const guildId = interaction.guild.id;

        try {
            // Get current config
            const config = await getConfig();
            
            // Initialize guild config if doesn't exist
            if (!config[guildId]) {
                config[guildId] = {};
            }

            // Set AI channel
            config[guildId].aiChannel = channel.id;

            // Save config
            await saveConfig(config, `Set AI channel for guild ${guildId}`);

            const embed = new EmbedBuilder()
                .setColor(0x00FF00)
                .setTitle('✅ AI Channel Configured')
                .setDescription(`AI will now automatically respond in ${channel}`)
                .addFields([
                    {
                        name: '📍 Channel Set',
                        value: `<#${channel.id}>`,
                        inline: true
                    },
                    {
                        name: '⚙️ Behavior',
                        value: 'AI responds automatically in this channel only. In other channels, AI only responds when tagged by admins.',
                        inline: false
                    }
                ])
                .setFooter({ 
                    text: `Configured by ${interaction.user.username}`,
                    iconURL: interaction.user.displayAvatarURL()
                })
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });

        } catch (error) {
            console.error('Error setting AI channel:', error);
            await interaction.reply({
                content: '❌ **Error:** Failed to set AI channel. Please try again.',
                ephemeral: true
            });
        }
    }
};
