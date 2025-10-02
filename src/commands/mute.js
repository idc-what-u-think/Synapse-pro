const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { getMutes, saveMutes } = require('../utils/github');
const { sendModlogEmbed } = require('../utils/modlog');

function parseDuration(duration) {
    const units = { m: 60, h: 3600, d: 86400 };
    const match = duration.match(/^(\d+)([mhd])$/);
    if (!match) return null;
    return parseInt(match[1]) * units[match[2]] * 1000;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('mute')
        .setDescription('Mutes a user')
        .addUserOption(option => 
            option.setName('user')
                .setDescription('The user to mute')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('duration')
                .setDescription('Duration (e.g. 1m, 1h, 1d)')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Reason for muting'))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
    async execute(interaction) {
        try {
            const user = interaction.options.getUser('user');
            const duration = interaction.options.getString('duration');
            const reason = interaction.options.getString('reason') || 'No reason provided';
            
            const durationMs = parseDuration(duration);
            if (!durationMs) {
                return interaction.reply({
                    content: 'Invalid duration format. Use 1m, 1h, or 1d',
                    ephemeral: true
                });
            }

            const member = await interaction.guild.members.fetch(user.id);
            const expiresAt = new Date(Date.now() + durationMs);
            
            const mutes = await getMutes();
            if (!Array.isArray(mutes)) {
                mutes = [];
            }
            
            mutes.push({
                userId: user.id,
                moderatorId: interaction.user.id,
                reason,
                duration,
                expiresAt: expiresAt.toISOString(),
                timestamp: new Date().toISOString(),
                guildId: interaction.guildId,
                active: true
            });

            await saveMutes(mutes, `Mute: ${user.tag} by ${interaction.user.tag}`);
            await member.timeout(durationMs, reason);

            const modlogEmbed = new EmbedBuilder()
                .setColor(0xFFAA00)
                .setTitle('Member Muted')
                .addFields(
                    { name: 'User', value: `${user.tag} (${user.id})` },
                    { name: 'Moderator', value: `${interaction.user.tag}` },
                    { name: 'Duration', value: duration },
                    { name: 'Reason', value: reason }
                )
                .setTimestamp();

            await sendModlogEmbed(interaction, modlogEmbed);
            
            await interaction.reply({
                content: `Muted ${user.tag} for ${duration} | Reason: ${reason}`,
                ephemeral: true
            });
        } catch (error) {
            console.error('Error executing mute command:', error);
            await interaction.reply({
                content: 'An error occurred while executing the mute command.',
                ephemeral: true
            });
        }
    },
};
