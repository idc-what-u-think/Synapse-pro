const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { formatDate, formatPermissions } = require('../utils/formatters');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('userinfo')
        .setDescription('Show user information')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('User to show info for')),

    async execute(interaction) {
        const targetUser = interaction.options.getUser('user') || interaction.user;
        const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

        if (!member) {
            return interaction.reply({ content: 'User not found in this server.', ephemeral: true });
        }

        const roles = member.roles.cache
            .sort((a, b) => b.position - a.position)
            .map(role => role.toString())
            .slice(0, -1);

        const activities = member.presence?.activities.map(activity => {
            return `${activity.type === 'CUSTOM' ? activity.state : activity.name}`;
        }).join('\n') || 'None';

        const embed = new EmbedBuilder()
            .setTitle('User Information')
            .setThumbnail(member.displayAvatarURL({ size: 4096 }))
            .setColor(member.displayColor || 0x00FF00)
            .addFields(
                { name: 'User Tag', value: targetUser.tag, inline: true },
                { name: 'ID', value: targetUser.id, inline: true },
                { name: 'Nickname', value: member.nickname || 'None', inline: true },
                { name: 'Account Created', value: formatDate(targetUser.createdAt), inline: true },
                { name: 'Joined Server', value: formatDate(member.joinedAt), inline: true },
                { name: 'Roles', value: roles.join(', ') || 'None' },
                { name: 'Key Permissions', value: formatPermissions(member.permissions) },
                { name: 'Activities', value: activities }
            )
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    },
};
