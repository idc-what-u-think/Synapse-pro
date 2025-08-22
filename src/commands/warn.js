const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { getData, saveData } = require('../utils/github');
const { sendModlogEmbed } = require('../utils/modlog');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('warn')
        .setDescription('Issues a warning to a user')
        .addUserOption(option => 
            option.setName('user')
                .setDescription('The user to warn')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Reason for warning')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

    async execute(interaction, octokit, owner, repo) {
        const user = interaction.options.getUser('user');
        const reason = interaction.options.getString('reason');
        
        const modData = await getData(octokit, owner, repo, 'moderation.json');
        if (!modData.warnings) modData.warnings = {};
        if (!modData.warnings[user.id]) modData.warnings[user.id] = [];
        
        const warning = {
            moderatorId: interaction.user.id,
            reason,
            timestamp: new Date().toISOString(),
            guildId: interaction.guildId
        };
        
        modData.warnings[user.id].push(warning);

        await saveData(octokit, owner, repo, 'moderation.json', modData,
            `Warning: ${user.tag} by ${interaction.user.tag}`);

        const warningCount = modData.warnings[user.id].length;
        const modlogEmbed = new EmbedBuilder()
            .setColor(0xFFA500)
            .setTitle('User Warned')
            .addFields(
                { name: 'User', value: `${user.tag} (${user.id})` },
                { name: 'Moderator', value: `${interaction.user.tag}` },
                { name: 'Reason', value: reason },
                { name: 'Warning Count', value: `${warningCount}` }
            )
            .setTimestamp();

        await sendModlogEmbed(interaction, octokit, owner, repo, modlogEmbed);
        
        await interaction.reply({
            content: `Warned ${user.tag} | Reason: ${reason} | Total Warnings: ${warningCount}`,
            ephemeral: true
        });
    },
};
