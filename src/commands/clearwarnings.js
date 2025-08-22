const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const { getData, saveData } = require('../utils/github');
const { sendModlogEmbed } = require('../utils/modlog');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('clearwarnings')
        .setDescription('Clear all warnings for a user')
        .addUserOption(option => 
            option.setName('user')
                .setDescription('The user to clear warnings for')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction, octokit, owner, repo) {
        const user = interaction.options.getUser('user');
        const modData = await getData(octokit, owner, repo, 'moderation.json');
        
        if (!modData.warnings?.[user.id]?.length) {
            return interaction.reply({
                content: `${user.tag} has no warnings to clear.`,
                ephemeral: true
            });
        }

        const warningCount = modData.warnings[user.id].length;
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
            content: `Are you sure you want to clear ${warningCount} warnings for ${user.tag}?`,
            components: [row],
            ephemeral: true
        });

        const collector = response.createMessageComponentCollector({ time: 15000 });

        collector.on('collect', async i => {
            if (i.user.id !== interaction.user.id) return;

            if (i.customId === 'confirm') {
                delete modData.warnings[user.id];
                await saveData(octokit, owner, repo, 'moderation.json', modData,
                    `Cleared warnings for ${user.tag}`);

                const modlogEmbed = new EmbedBuilder()
                    .setColor(0x00FF00)
                    .setTitle('Warnings Cleared')
                    .addFields(
                        { name: 'User', value: `${user.tag} (${user.id})` },
                        { name: 'Moderator', value: `${interaction.user.tag}` },
                        { name: 'Warnings Cleared', value: `${warningCount}` }
                    )
                    .setTimestamp();

                await sendModlogEmbed(interaction, octokit, owner, repo, modlogEmbed);
                
                await i.update({
                    content: `Cleared ${warningCount} warnings for ${user.tag}`,
                    components: []
                });
            } else {
                await i.update({
                    content: 'Warning clear cancelled.',
                    components: []
                });
            }
        });

        collector.on('end', async (collected, reason) => {
            if (reason === 'time') {
                await interaction.editReply({
                    content: 'Warning clear timed out.',
                    components: []
                });
            }
        });
    },
};
