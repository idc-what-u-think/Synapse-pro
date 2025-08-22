const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('announce')
        .setDescription('Send an announcement')
        .addStringOption(option =>
            option.setName('title')
                .setDescription('Announcement title')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('message')
                .setDescription('Announcement message')
                .setRequired(true))
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('Channel to send announcement to'))
        .addStringOption(option =>
            option.setName('color')
                .setDescription('Hex color code (e.g. #FF0000)'))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        const title = interaction.options.getString('title');
        const message = interaction.options.getString('message');
        const channel = interaction.options.getChannel('channel') || interaction.channel;
        const color = interaction.options.getString('color');

        // Validate color format if provided
        if (color && !/^#[0-9A-Fa-f]{6}$/.test(color)) {
            return interaction.reply({
                content: 'Invalid color format. Please use hex format (e.g. #FF0000)',
                ephemeral: true
            });
        }

        const embed = new EmbedBuilder()
            .setTitle(title)
            .setDescription(message)
            .setColor(color || '#5865F2')
            .setTimestamp()
            .setFooter({ text: `Announced by ${interaction.user.tag}` });

        await channel.send({ embeds: [embed] });
        
        if (channel.id !== interaction.channelId) {
            await interaction.reply({
                content: `Announcement sent to ${channel}`,
                ephemeral: true
            });
        } else {
            await interaction.reply({ content: 'Announcement sent!', ephemeral: true });
        }
    },
};
