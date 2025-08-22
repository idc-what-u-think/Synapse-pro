const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getData } = require('../utils/github');

const WEATHER_API_KEY = '33133755e9ca4490862114921250608';
const BASE_URL = 'https://api.weatherapi.com/v1';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('weather')
        .setDescription('Get weather information for a location')
        .addStringOption(option =>
            option.setName('city')
                .setDescription('City name to get weather for')
                .setRequired(true)),

    async execute(interaction) {
        await interaction.deferReply();
        
        try {
            const city = interaction.options.getString('city');
            const response = await fetch(
                `${BASE_URL}/forecast.json?key=${WEATHER_API_KEY}&q=${encodeURIComponent(city)}&days=5&aqi=no`
            );

            if (!response.ok) {
                throw new Error(`Weather API returned ${response.status}`);
            }

            const data = await response.json();
            const current = data.current;
            const forecast = data.forecast.forecastday;
            const location = data.location;

            const embed = new EmbedBuilder()
                .setTitle(`🌤️ Weather for ${location.name}, ${location.country}`)
                .setColor(getWeatherColor(current.condition.code))
                .setThumbnail(`https:${current.condition.icon}`)
                .addFields(
                    {
                        name: '🌡️ Current Conditions',
                        value: [
                            `**Temperature:** ${current.temp_c}°C (${current.temp_f}°F)`,
                            `**Feels Like:** ${current.feelslike_c}°C (${current.feelslike_f}°F)`,
                            `**Condition:** ${current.condition.text}`,
                            `**Humidity:** ${current.humidity}%`
                        ].join('\n'),
                        inline: false
                    },
                    {
                        name: '💨 Wind & Pressure',
                        value: [
                            `**Speed:** ${current.wind_kph} km/h`,
                            `**Direction:** ${current.wind_dir}`,
                            `**Pressure:** ${current.pressure_mb} mb`
                        ].join('\n'),
                        inline: true
                    },
                    {
                        name: '🌅 Visibility & UV',
                        value: [
                            `**UV Index:** ${current.uv}`,
                            `**Visibility:** ${current.vis_km} km`,
                            `**Updated:** ${new Date(current.last_updated).toLocaleTimeString()}`
                        ].join('\n'),
                        inline: true
                    }
                );

            const forecastText = forecast.slice(0, 5).map((day, index) => {
                const date = new Date(day.date);
                const dayName = index === 0 ? 'Today' : date.toLocaleDateString('en-US', { weekday: 'short' });
                const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

                return [
                    `**${dayName} (${dateStr})**`,
                    `${day.day.condition.text}`,
                    `High: ${day.day.maxtemp_c}°C | Low: ${day.day.mintemp_c}°C`,
                    `Rain: ${day.day.daily_chance_of_rain}%`
                ].join('\n');
            }).join('\n\n');

            embed.addFields({
                name: '📅 5-Day Forecast',
                value: forecastText.length > 1024 ? forecastText.substring(0, 1021) + '...' : forecastText,
                inline: false
            });

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('Error in weather command:', error);
            let errorMessage = '❌ Failed to fetch weather data. Please try again.';

            if (error.message.includes('404')) {
                errorMessage = '❌ City not found. Please check the spelling and try again.';
            } else if (error.message.includes('401')) {
                errorMessage = '❌ Weather service authentication failed. Please contact the bot administrator.';
            } else if (error.message.includes('429')) {
                errorMessage = '❌ Too many requests. Please try again in a moment.';
            }

            await interaction.editReply({ content: errorMessage });
        }
    }
};

function getWeatherColor(code) {
    if (code === 1000) return 0xFFDB4D; // Clear or sunny
    if ([1003, 1006, 1009].includes(code)) return 0x87CEEB; // Partly cloudy
    if ([1030, 1135, 1147].includes(code)) return 0x708090; // Overcast/Mist
    if ([1063, 1150, 1153, 1168, 1171, 1180, 1183].includes(code)) return 0x4682B4; // Light rain
    if ([1186, 1189, 1192, 1195, 1198, 1201, 1240, 1243, 1246].includes(code)) return 0x1E90FF; // Heavy rain
    if (code >= 1210 && code <= 1237) return 0xF0F8FF; // Snow
    if (code >= 1273 && code <= 1282) return 0x4B0082; // Thunder
    return 0x95A5A6; // Default gray
}
