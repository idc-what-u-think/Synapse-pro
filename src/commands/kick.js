const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { getData, saveData } = require('../utils/github');
const { sendModlogEmbed } = require('../utils/modlog');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('kick')
        .setDescription('Kicks a user from the server')
        .addUserOption(option => 
            option.setName('user')
                .setDescription('The user to kick')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Reason for kicking'))
        .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),

    async execute(interaction, octokit, owner, repo) {
        const user = interaction.options.getUser('user');
        const reason = interaction.options.getString('reason') || 'No reason provided';
        
        const modData = await getData(octokit, owner, repo, 'moderation.json');
        if (!modData.kicks) modData.kicks = [];
        
        modData.kicks.push({
            userId: user.id,
            moderatorId: interaction.user.id,
            reason,
            timestamp: new Date().toISOString(),
            guildId: interaction.guildId
        });

        await saveData(octokit, owner, repo, 'moderation.json', modData, 
            `Kick: ${user.tag} by ${interaction.user.tag}`);

        await interaction.guild.members.kick(user, reason);

        const modlogEmbed = new EmbedBuilder()
            .setColor(0xFF9900)
            .setTitle('Member Kicked')
            .addFields(
                { name: 'User', value: `${user.tag} (${user.id})` },
                { name: 'Moderator', value: `${interaction.user.tag}` },
                { name: 'Reason', value: reason }
            )
            .setTimestamp();

        await sendModlogEmbed(interaction, octokit, owner, repo, modlogEmbed);
        
        await interaction.reply({
            content: `Kicked ${user.tag} | Reason: ${reason}`,
            ephemeral: true
        });
    },
};
