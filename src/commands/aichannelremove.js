const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { getConfig, saveConfig } = require('../utils/github.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('aichannelremove')
        .setDescription('Remove the configured AI channel (AI will only respond when tagged)')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

    async execute(interaction) {
        const guildId = interaction.guild.id;

        try {
            // Get current config
            const config = await getConfig();
            
            if (!config[guildId] || !config[guildId].aiChannel) {
                return interaction.reply({
                    content: '❌ **No AI channel is currently configured.**',
                    ephemeral: true
                });
            }

            const oldChannelId = config[guildId].aiChannel;
            
            // Remove AI channel
            delete config[guildId].aiChannel;

            // Save config
            await saveConfig(config, `Removed AI channel for guild ${guildId}`);

            const embed = new EmbedBuilder()
                .setColor(0xFF9900)
                .setTitle('🗑️ AI Channel Removed')
                .setDescription('AI channel configuration has been removed')
                .addFields([
                    {
                        name: '📍 Previous Channel',
                        value: `<#${oldChannelId}>`,
                        inline: true
                    },
                    {
                        name: '⚙️ New Behavior',
                        value: 'AI will now only respond when tagged by administrators.',
                        inline: false
                    }
                ])
                .setFooter({ 
                    text: `Removed by ${interaction.user.username}`,
                    iconURL: interaction.user.displayAvatarURL()
                })
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });

        } catch (error) {
            console.error('Error removing AI channel:', error);
            await interaction.reply({
                content: '❌ **Error:** Failed to remove AI channel. Please try again.',
                ephemeral: true
            });
        }
    }
};
