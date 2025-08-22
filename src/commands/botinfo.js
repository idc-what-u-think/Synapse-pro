const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getData } = require('../utils/github');
const { formatDuration } = require('../utils/time');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('botinfo')
        .setDescription('Show bot information and statistics'),

    async execute(interaction, octokit, owner, repo) {
        const client = interaction.client;
        const uptime = formatDuration(client.uptime);
        
        // Get JSON storage stats
        const stats = {
            commands: await getData(octokit, owner, repo, 'stats.json'),
            economy: await getData(octokit, owner, repo, 'economy.json'),
            levels: await getData(octokit, owner, repo, 'levels.json')
        };

        const commandsToday = stats.commands?.daily?.[new Date().toDateString()] || 0;

        const embed = new EmbedBuilder()
            .setTitle('Bot Information')
            .addFields(
                { name: 'Uptime', value: uptime, inline: true },
                { name: 'Servers', value: client.guilds.cache.size.toString(), inline: true },
                { name: 'Users', value: client.users.cache.size.toString(), inline: true },
                { name: 'Commands Today', value: commandsToday.toString(), inline: true },
                { name: 'Memory Usage', value: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`, inline: true },
                { name: 'JSON Storage', value: Object.keys(stats).length.toString(), inline: true },
                { name: 'Version', value: process.env.npm_package_version || '1.0.0' }
            )
            .setColor(0x5865F2)
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    },
};
