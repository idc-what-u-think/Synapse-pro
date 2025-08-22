const { SlashCommandBuilder, PermissionFlagsBits, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('recreate')
        .setDescription('Delete and recreate a channel')
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('Channel to recreate')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Reason for recreation'))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

    async execute(interaction) {
        const channel = interaction.options.getChannel('channel');
        const reason = interaction.options.getString('reason') || 'No reason provided';

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('confirm')
                .setLabel('Confirm')
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId('cancel')
                .setLabel('Cancel')
                .setStyle(ButtonStyle.Secondary)
        );

        const response = await interaction.reply({
            content: `⚠️ Are you sure you want to recreate ${channel}?\nThis will delete all messages!`,
            components: [row],
            ephemeral: true
        });

        const collector = response.createMessageComponentCollector({ time: 15000 });

        collector.on('collect', async i => {
            if (i.user.id !== interaction.user.id) return;

            if (i.customId === 'confirm') {
                const permissions = channel.permissionOverwrites.cache;
                const position = channel.position;
                const newChannel = await channel.clone({
                    position: position,
                    reason: `${reason} - By ${interaction.user.tag}`
                });
                await channel.delete(reason);

                await i.update({
                    content: `Channel recreated: ${newChannel}\nReason: ${reason}`,
                    components: []
                });
            } else {
                await i.update({
                    content: 'Operation cancelled.',
                    components: []
                });
            }
        });

        collector.on('end', collected => {
            if (!collected.size) {
                interaction.editReply({
                    content: 'Operation timed out.',
                    components: []
                });
            }
        });
    },
};
