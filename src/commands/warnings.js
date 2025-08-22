const { SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const { getData } = require('../utils/github');

function getWarningColor(count) {
    if (count <= 1) return 0x00FF00; // Green
    if (count <= 3) return 0xFFFF00; // Yellow
    return 0xFF0000; // Red
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('warnings')
        .setDescription('Display warnings for a user')
        .addUserOption(option => 
            option.setName('user')
                .setDescription('The user to check warnings for')
                .setRequired(true)),

    async execute(interaction, octokit, owner, repo) {
        const user = interaction.options.getUser('user');
        const modData = await getData(octokit, owner, repo, 'moderation.json');
        const warnings = modData.warnings?.[user.id] || [];
        
        if (warnings.length === 0) {
            return interaction.reply({
                content: `${user.tag} has no warnings.`,
                ephemeral: true
            });
        }

        const warningsPerPage = 5;
        const pages = Math.ceil(warnings.length / warningsPerPage);
        let currentPage = 0;

        const createEmbed = (page) => {
            const start = page * warningsPerPage;
            const end = Math.min(start + warningsPerPage, warnings.length);
            const currentWarnings = warnings.slice(start, end);

            return new EmbedBuilder()
                .setColor(getWarningColor(warnings.length))
                .setTitle(`Warnings for ${user.tag}`)
                .setDescription(`Total Warnings: ${warnings.length}`)
                .addFields(
                    currentWarnings.map((warn, index) => ({
                        name: `Warning ${start + index + 1}`,
                        value: `**Reason:** ${warn.reason}\n**By:** <@${warn.moderatorId}>\n**Date:** <t:${Math.floor(new Date(warn.timestamp).getTime() / 1000)}:R>`
                    }))
                )
                .setFooter({ text: `Page ${page + 1}/${pages}` });
        };

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('prev')
                .setLabel('Previous')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(true),
            new ButtonBuilder()
                .setCustomId('next')
                .setLabel('Next')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(pages <= 1)
        );

        const response = await interaction.reply({
            embeds: [createEmbed(0)],
            components: pages > 1 ? [row] : [],
            ephemeral: true
        });

        if (pages <= 1) return;

        const collector = response.createMessageComponentCollector({ time: 60000 });

        collector.on('collect', async i => {
            if (i.user.id !== interaction.user.id) return;

            currentPage = i.customId === 'next' ? 
                Math.min(currentPage + 1, pages - 1) : 
                Math.max(currentPage - 1, 0);

            row.components[0].setDisabled(currentPage === 0);
            row.components[1].setDisabled(currentPage === pages - 1);

            await i.update({
                embeds: [createEmbed(currentPage)],
                components: [row]
            });
        });
    },
};
