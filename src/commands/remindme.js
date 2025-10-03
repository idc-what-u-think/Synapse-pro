const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getData, saveData } = require('../utils/github');
const { parseDuration, formatDuration } = require('../utils/time');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('remindme')
        .setDescription('Set a personal reminder')
        .addStringOption(option =>
            option.setName('duration')
                .setDescription('When to remind you (e.g. 1h30m, 2d)')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('message')
                .setDescription('What to remind you about')
                .setRequired(true)),
    
    async execute(interaction) {
        try {
            const durationStr = interaction.options.getString('duration');
            const message = interaction.options.getString('message');
            
            const duration = parseDuration(durationStr);
            if (!duration || duration === 0) {
                return interaction.reply({
                    content: 'Invalid duration format. Use: 1h30m, 2d, etc.',
                    ephemeral: true
                });
            }

            const reminderTime = Date.now() + duration;
            
            let data = await getData('data/reminders.json');
            if (!data || typeof data !== 'object') {
                data = { reminders: [] };
            }
            if (!Array.isArray(data.reminders)) {
                data.reminders = [];
            }

            data.reminders.push({
                userId: interaction.user.id,
                message,
                reminderTime,
                setAt: Date.now(),
                guildId: interaction.guildId
            });

            await saveData('data/reminders.json', data, `Reminder added by ${interaction.user.tag}`);

            const embed = new EmbedBuilder()
                .setTitle('⏰ Reminder Set')
                .setDescription(`I'll remind you in ${formatDuration(duration)}:\n${message}`)
                .setColor(0x00FF00)
                .setTimestamp();

            await interaction.reply({ embeds: [embed], ephemeral: true });

        } catch (error) {
            console.error('Error executing remindme command:', error);
            await interaction.reply({
                content: 'An error occurred while setting your reminder.',
                ephemeral: true
            });
        }
    },
};
