const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('onthisday')
        .setDescription('Historical events that happened on this day')
        .addStringOption(option =>
            option.setName('type')
                .setDescription('Type of events')
                .addChoices(
                    { name: 'Events', value: 'events' },
                    { name: 'Births', value: 'births' },
                    { name: 'Deaths', value: 'deaths' },
                    { name: 'All', value: 'all' }
                )
                .setRequired(false))
        .addIntegerOption(option =>
            option.setName('month')
                .setDescription('Month (1-12, defaults to today)')
                .setMinValue(1)
                .setMaxValue(12)
                .setRequired(false))
        .addIntegerOption(option =>
            option.setName('day')
                .setDescription('Day (1-31, defaults to today)')
                .setMinValue(1)
                .setMaxValue(31)
                .setRequired(false)),
    
    async execute(interaction) {
        await interaction.deferReply();

        try {
            const type = interaction.options.getString('type') || 'events';
            const today = new Date();
            const month = interaction.options.getInteger('month') || (today.getMonth() + 1);
            const day = interaction.options.getInteger('day') || today.getDate();

            const monthStr = month.toString().padStart(2, '0');
            const dayStr = day.toString().padStart(2, '0');

            const response = await fetch(`https://api.wikimedia.org/feed/v1/wikipedia/en/onthisday/all/${monthStr}/${dayStr}`);
            const data = await response.json();

            const embed = new EmbedBuilder()
                .setTitle(`📅 On This Day - ${getMonthName(month)} ${day}`)
                .setColor(0x3498DB)
                .setFooter({ text: 'Powered by Wikipedia API' })
                .setTimestamp();

            if (type === 'events' || type === 'all') {
                const events = data.events.slice(0, 5).map(event => 
                    `**${event.year}** - ${event.text}`
                ).join('\n\n');
                
                if (events) {
                    embed.addFields({ name: '📜 Historical Events', value: events });
                }
            }

            if (type === 'births' || type === 'all') {
                const births = data.births.slice(0, 3).map(birth => 
                    `**${birth.year}** - ${birth.text}`
                ).join('\n');
                
                if (births) {
                    embed.addFields({ name: '👶 Births', value: births });
                }
            }

            if (type === 'deaths' || type === 'all') {
                const deaths = data.deaths.slice(0, 3).map(death => 
                    `**${death.year}** - ${death.text}`
                ).join('\n');
                
                if (deaths) {
                    embed.addFields({ name: '⚰️ Deaths', value: deaths });
                }
            }

            if (data.holidays && data.holidays.length > 0) {
                const holidays = data.holidays.slice(0, 3).map(h => h.text).join(', ');
                embed.addFields({ name: '🎉 Holidays', value: holidays });
            }

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('On this day error:', error);
            await interaction.editReply({ content: '❌ Failed to fetch historical events. Try again!' });
        }
    },
};

function getMonthName(month) {
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 
                    'July', 'August', 'September', 'October', 'November', 'December'];
    return months[month - 1];
}
