const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { sendModlogEmbed } = require('../utils/modlog');
const { storeChannelPermissions } = require('../utils/permissions');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('lock')
        .setDescription('Lock a channel')
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('Channel to lock (defaults to current channel)'))
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Reason for locking the channel'))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

    async execute(interaction, octokit, owner, repo) {
        const channel = interaction.options.getChannel('channel') || interaction.channel;
        const reason = interaction.options.getString('reason') || 'No reason provided';

        await storeChannelPermissions(channel, octokit, owner, repo);
        
        await channel.permissionOverwrites.edit(channel.guild.roles.everyone, {
            SendMessages: false
        });

        const lockEmbed = new EmbedBuilder()
            .setColor(0xFF0000)
            .setTitle('Channel Locked')
            .setDescription(`🔒 This channel has been locked.\n**Reason:** ${reason}`);

        await channel.send({ embeds: [lockEmbed] });

        const modlogEmbed = new EmbedBuilder()
            .setColor(0xFF0000)
            .setTitle('Channel Locked')
            .addFields(
                { name: 'Channel', value: `<#${channel.id}>` },
                { name: 'Moderator', value: interaction.user.tag },
                { name: 'Reason', value: reason }
            )
            .setTimestamp();

        await sendModlogEmbed(interaction, octokit, owner, repo, modlogEmbed);
        
        await interaction.reply({
            content: `Locked channel ${channel}`,
            ephemeral: true
        });
    },
};
