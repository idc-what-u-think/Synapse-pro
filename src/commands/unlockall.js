const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { sendModlogEmbed } = require('../utils/modlog');
const { getStoredPermissions } = require('../utils/permissions');
const { getData } = require('../utils/github');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('unlockall')
        .setDescription('Unlock all locked channels in the server')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction, octokit, owner, repo) {
        await interaction.deferReply({ ephemeral: true });

        const modData = await getData(octokit, owner, repo, 'moderation.json');
        const lockedChannels = modData.lockedChannels || {};
        
        let unlockedCount = 0;
        const failedChannels = [];

        for (const [channelId, data] of Object.entries(lockedChannels)) {
            if (data.guildId !== interaction.guild.id) continue;
            
            const channel = await interaction.guild.channels.fetch(channelId).catch(() => null);
            if (!channel) continue;

            try {
                await channel.permissionOverwrites.edit(channel.guild.roles.everyone, {
                    SendMessages: null
                });

                await channel.send({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(0x00FF00)
                            .setTitle('Channel Unlocked')
                            .setDescription('🔓 This channel has been unlocked.')
                    ]
                });

                unlockedCount++;
            } catch (error) {
                failedChannels.push(channel.name);
            }
        }

        const modlogEmbed = new EmbedBuilder()
            .setColor(0x00FF00)
            .setTitle('Server Unlocked')
            .addFields(
                { name: 'Moderator', value: interaction.user.tag },
                { name: 'Channels Unlocked', value: `${unlockedCount}` }
            )
            .setTimestamp();

        if (failedChannels.length > 0) {
            modlogEmbed.addFields({
                name: 'Failed Channels',
                value: failedChannels.join('\n') || 'None'
            });
        }

        await sendModlogEmbed(interaction, octokit, owner, repo, modlogEmbed);
        
        await interaction.editReply({
            content: `Unlocked ${unlockedCount} channels.\n${
                failedChannels.length > 0 ? 
                `Failed to unlock: ${failedChannels.join(', ')}` : 
                ''
            }`,
            ephemeral: true
        });
    },
};
