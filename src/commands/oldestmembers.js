const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { formatDate } = require('../utils/formatters');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('oldestmembers')
        .setDescription('Show oldest server members by account creation')
        .addIntegerOption(option =>
            option.setName('count')
                .setDescription('Number of members to show (default: 10)')
                .setMinValue(1)
                .setMaxValue(25)),

    async execute(interaction) {
        await interaction.deferReply();
        
        const count = interaction.options.getInteger('count') || 10;
        const members = await interaction.guild.members.fetch();

        const oldestMembers = [...members.values()]
            .sort((a, b) => a.user.createdTimestamp - b.user.createdTimestamp)
            .slice(0, count);

        const embed = new EmbedBuilder()
            .setTitle(`${count} Oldest Discord Accounts`)
            .setDescription(oldestMembers.map((member, index) => 
                `${index + 1}. ${member.user.tag}\n` +
                `📅 Created: ${formatDate(member.user.createdAt)}\n` +
                `⌛ Account Age: ${Math.floor((Date.now() - member.user.createdTimestamp) / (1000 * 60 * 60 * 24))} days`
            ).join('\n\n'))
            .setColor(0x00FF00)
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
    },
};
