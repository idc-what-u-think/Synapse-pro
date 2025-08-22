const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { formatDuration } = require('../utils/time');
const os = require('os');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('uptime')
        .setDescription('Show bot and system uptime information'),

    async execute(interaction) {
        const botUptime = formatDuration(interaction.client.uptime);
        const systemUptime = formatDuration(os.uptime() * 1000);
        
        const memoryTotal = os.totalmem();
        const memoryUsed = memoryTotal - os.freemem();
        const memoryPercent = ((memoryUsed / memoryTotal) * 100).toFixed(1);

        const embed = new EmbedBuilder()
            .setTitle('Uptime Information')
            .addFields(
                { name: 'Bot Uptime', value: botUptime, inline: true },
                { name: 'System Uptime', value: systemUptime, inline: true },
                { name: 'Memory Usage', value: `${memoryPercent}%`, inline: true },
                { name: 'Last Restart', value: `<t:${Math.floor((Date.now() - interaction.client.uptime) / 1000)}:R>` }
            )
            .setColor(0x00FF00)
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    },
};
