const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const { sendModlogEmbed } = require('../utils/modlog');
const { storeChannelPermissions } = require('../utils/permissions');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('lockall')
        .setDescription('Lock all channels in the server')
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Reason for locking all channels')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction, octokit, owner, repo) {
        const reason = interaction.options.getString('reason');
        
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
            content: '⚠️ Are you sure you want to lock ALL channels in the server?',
            components: [row],
            ephemeral: true
        });

        const collector = response.createMessageComponentCollector({ time: 15000 });

        collector.on('collect', async i => {
            if (i.user.id !== interaction.user.id) return;

            if (i.customId === 'confirm') {
                await i.update({ content: 'Locking all channels...', components: [] });
                
                const channels = interaction.guild.channels.cache.filter(c => 
                    c.type === 0 && // Text channels only
                    c.permissionsFor(interaction.guild.members.me).has(PermissionFlagsBits.ManageChannels)
                );

                let lockedCount = 0;
                for (const channel of channels.values()) {
                    await storeChannelPermissions(channel, octokit, owner, repo);
                    await channel.permissionOverwrites.edit(channel.guild.roles.everyone, {
                        SendMessages: false
                    });
                    await channel.send({
                        embeds: [
                            new EmbedBuilder()
                                .setColor(0xFF0000)
                                .setTitle('Channel Locked')
                                .setDescription(`🔒 This channel has been locked.\n**Reason:** ${reason}`)
                        ]
                    });
                    lockedCount++;
                }

                const modlogEmbed = new EmbedBuilder()
                    .setColor(0xFF0000)
                    .setTitle('Server Lockdown')
                    .addFields(
                        { name: 'Moderator', value: interaction.user.tag },
                        { name: 'Reason', value: reason },
                        { name: 'Channels Locked', value: `${lockedCount}` }
                    )
                    .setTimestamp();

                await sendModlogEmbed(interaction, octokit, owner, repo, modlogEmbed);
                
                await i.editReply(`Locked ${lockedCount} channels.`);
            } else {
                await i.update({ content: 'Operation cancelled.', components: [] });
            }
        });

        collector.on('end', async (collected, reason) => {
            if (reason === 'time') {
                await interaction.editReply({
                    content: 'Operation timed out.',
                    components: []
                });
            }
        });
    },
};
