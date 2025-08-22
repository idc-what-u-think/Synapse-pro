const { SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('avatar')
        .setDescription('Show user avatar')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('User to show avatar for'))
        .addStringOption(option =>
            option.setName('type')
                .setDescription('Avatar type')
                .addChoices(
                    { name: 'Server', value: 'server' },
                    { name: 'Global', value: 'global' }
                )),

    async execute(interaction) {
        const user = interaction.options.getUser('user') || interaction.user;
        const type = interaction.options.getString('type') || 'global';
        const member = type === 'server' ? await interaction.guild.members.fetch(user.id) : null;
        const avatar = type === 'server' ? member?.displayAvatarURL() : user.displayAvatarURL();
        
        const embed = new EmbedBuilder()
            .setTitle(`${user.tag}'s ${type} Avatar`)
            .setImage(avatar)
            .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setLabel('PNG')
                .setURL(avatar + '?size=4096&format=png')
                .setStyle(ButtonStyle.Link),
            new ButtonBuilder()
                .setLabel('JPG')
                .setURL(avatar + '?size=4096&format=jpg')
                .setStyle(ButtonStyle.Link),
            new ButtonBuilder()
                .setLabel('WebP')
                .setURL(avatar + '?size=4096&format=webp')
                .setStyle(ButtonStyle.Link)
        );

        await interaction.reply({ embeds: [embed], components: [row] });
    },
};
