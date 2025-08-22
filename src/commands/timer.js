const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getData, saveData } = require('../utils/github');
const { parseDuration, formatDuration } = require('../utils/time');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('timer')
        .setDescription('Start a countdown timer')
        .addStringOption(option =>
            option.setName('duration')
                .setDescription('Timer duration (e.g. 1h30m, 45s)')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('message')
                .setDescription('Message to show when timer completes')),

    async execute(interaction, octokit, owner, repo) {
        const durationStr = interaction.options.getString('duration');
        const message = interaction.options.getString('message') || 'Timer completed!';
        
        const duration = parseDuration(durationStr);
        if (!duration) {
            return interaction.reply({
                content: 'Invalid duration format. Use: 1h30m, 45s, etc.',
                ephemeral: true
            });
        }

        const endTime = Date.now() + duration;
        const embed = new EmbedBuilder()
            .setTitle('⏰ Timer Started')
            .setDescription(`Time Remaining: ${formatDuration(duration)}\n${message}`)
            .setColor(0x00FF00)
            .setTimestamp();

        const reply = await interaction.reply({ embeds: [embed], fetchReply: true });

        // Store timer in JSON
        const data = await getData(octokit, owner, repo, 'timers.json');
        if (!data.timers) data.timers = [];
        
        data.timers.push({
            endTime,
            message,
            channelId: interaction.channelId,
            messageId: reply.id,
            userId: interaction.user.id,
            guildId: interaction.guildId
        });

        await saveData(octokit, owner, repo, 'timers.json', data,
            `Timer added by ${interaction.user.tag}`);

        // Update timer display
        const interval = setInterval(async () => {
            const remaining = endTime - Date.now();
            if (remaining <= 0) {
                clearInterval(interval);
                embed.setDescription(`⏰ ${message}`)
                    .setColor(0xFF0000);
                await reply.edit({ embeds: [embed] }).catch(() => {});
                return;
            }

            embed.setDescription(`Time Remaining: ${formatDuration(remaining)}\n${message}`);
            await reply.edit({ embeds: [embed] }).catch(() => {});
        }, 5000);
    },
};
