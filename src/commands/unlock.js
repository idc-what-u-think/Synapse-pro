const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { sendModlogEmbed } = require('../utils/modlog');
const { getStoredPermissions } = require('../utils/permissions');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('unlock')
        .setDescription('Unlock a channel')
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('Channel to unlock (defaults to current channel)'))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

    async execute(interaction, octokit, owner, repo) {
        const channel = interaction.options.getChannel('channel') || interaction.channel;
        
        const storedPerms = await getStoredPermissions(channel, octokit, owner, repo);
        await channel.permissionOverwrites.edit(channel.guild.roles.everyone, {
            SendMessages: null
        });

        const unlockEmbed = new EmbedBuilder()
            .setColor(0x00FF00)
            .setTitle('Channel Unlocked')
            .setDescription('🔓 This channel has been unlocked.');

        await channel.send({ embeds: [unlockEmbed] });

        const modlogEmbed = new EmbedBuilder()
            .setColor(0x00FF00)
            .setTitle('Channel Unlocked')
            .addFields(
                { name: 'Channel', value: `<#${channel.id}>` },
                { name: 'Moderator', value: interaction.user.tag }
            )
            .setTimestamp();

        await sendModlogEmbed(interaction, octokit, owner, repo, modlogEmbed);
        
        await interaction.reply({
            content: `Unlocked channel ${channel}`,
            ephemeral: true
        });
    },
};
