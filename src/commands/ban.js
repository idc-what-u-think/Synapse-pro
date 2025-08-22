const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { getData, saveData } = require('../utils/github');
const { sendModlogEmbed } = require('../utils/modlog');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ban')
        .setDescription('Bans a user from the server')
        .addUserOption(option => 
            option.setName('user')
                .setDescription('The user to ban')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Reason for banning'))
        .addIntegerOption(option =>
            option.setName('delete_days')
                .setDescription('Number of days of messages to delete (1-7)')
                .setMinValue(1)
                .setMaxValue(7))
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

    async execute(interaction, octokit, owner, repo) {
        const user = interaction.options.getUser('user');
        const reason = interaction.options.getString('reason') || 'No reason provided';
        const deleteDays = interaction.options.getInteger('delete_days') || 0;

        const modData = await getData(octokit, owner, repo, 'moderation.json');
        if (!modData.bans) modData.bans = [];
        
        modData.bans.push({
            userId: user.id,
            moderatorId: interaction.user.id,
            reason,
            deleteDays,
            timestamp: new Date().toISOString(),
            guildId: interaction.guildId
        });

        await saveData(octokit, owner, repo, 'moderation.json', modData,
            `Ban: ${user.tag} by ${interaction.user.tag}`);

        await interaction.guild.members.ban(user, { 
            deleteMessageDays: deleteDays,
            reason: reason 
        });
        
        const modlogEmbed = new EmbedBuilder()
            .setColor(0xFF0000)
            .setTitle('Member Banned')
            .addFields(
                { name: 'User', value: `${user.tag} (${user.id})` },
                { name: 'Moderator', value: `${interaction.user.tag}` },
                { name: 'Delete Messages', value: `${deleteDays} days` },
                { name: 'Reason', value: reason }
            )
            .setTimestamp();

        await sendModlogEmbed(interaction, octokit, owner, repo, modlogEmbed);
        
        await interaction.reply({
            content: `Banned ${user.tag} | Reason: ${reason} | Message deletion: ${deleteDays} days`,
            ephemeral: true
        });
    },
};
