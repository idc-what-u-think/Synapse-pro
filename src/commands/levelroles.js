const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getData } = require('../utils/github');
const { getLevel } = require('../utils/xp');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('levelroles')
        .setDescription('View all level-based role rewards'),

    async execute(interaction, octokit, owner, repo) {
        const data = await getData(octokit, owner, repo, 'config.json');
        const levelRoles = data?.guilds?.[interaction.guild.id]?.levelRoles || {};
        const userLevel = getLevel(data?.levels?.[interaction.guild.id]?.[interaction.user.id]?.messages || 0);

        const embed = new EmbedBuilder()
            .setColor(0x00FF00)
            .setTitle('Level Role Rewards')
            .setDescription(Object.entries(levelRoles)
                .sort(([a], [b]) => parseInt(a) - parseInt(b))
                .map(([level, roleId]) => {
                    const role = interaction.guild.roles.cache.get(roleId);
                    const unlocked = userLevel >= parseInt(level);
                    return `${unlocked ? '✅' : '❌'} Level ${level}: ${role ? `<@&${roleId}>` : 'Role not found'}`;
                })
                .join('\n') || 'No role rewards configured')
            .setFooter({ text: `Your current level: ${userLevel}` });

        await interaction.reply({ embeds: [embed], ephemeral: false });
    },
};
