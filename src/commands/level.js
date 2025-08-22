const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getData } = require('../utils/github');

function getLevel(xp) {
    // Example: Level up every 1000 XP, can be customized
    return Math.floor(xp / 1000);
}

function getXPForNextLevel(xp) {
    const level = getLevel(xp);
    return (level + 1) * 1000 - xp;
}

function makeProgressBar(xp) {
    const level = getLevel(xp);
    const current = xp - (level * 1000);
    const total = 1000;
    const barLength = 20;
    const filled = Math.round((current / total) * barLength);
    return `\`[${'█'.repeat(filled)}${'░'.repeat(barLength - filled)}]\` ${current}/${total} XP`;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('level')
        .setDescription('Show your or another user\'s level and XP')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('User to check')
                .setRequired(false)),
    async execute(interaction, octokit, owner, repo) {
        const user = interaction.options.getUser('user') || interaction.user;
        const guildId = interaction.guild.id;
        const data = await getData(octokit, owner, repo, 'levels.json');
        const userData = data?.[guildId]?.[user.id] || { xp: 0 };

        // Calculate rank
        const allUsers = Object.entries(data?.[guildId] || {});
        allUsers.sort((a, b) => (b[1].xp || 0) - (a[1].xp || 0));
        const rank = allUsers.findIndex(([id]) => id === user.id) + 1;

        const xp = userData.xp || 0;
        const level = getLevel(xp);
        const xpToNext = getXPForNextLevel(xp);

        const embed = new EmbedBuilder()
            .setColor(0x3498db)
            .setTitle(`${user.username}'s Level`)
            .addFields(
                { name: 'Level', value: `${level}`, inline: true },
                { name: 'XP', value: `${xp}`, inline: true },
                { name: 'Rank', value: `#${rank || 'N/A'}`, inline: true },
                { name: 'Progress', value: makeProgressBar(xp) },
                { name: 'XP to Next Level', value: `${xpToNext}` }
            )
            .setThumbnail(user.displayAvatarURL())
            .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: false });
    }
};
