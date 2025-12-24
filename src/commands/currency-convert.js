const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('currency-convert')
        .setDescription('Convert currency between different types')
        .addNumberOption(option =>
            option.setName('amount')
                .setDescription('Amount to convert')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('from')
                .setDescription('Currency to convert from (e.g., USD, EUR, GBP)')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('to')
                .setDescription('Currency to convert to (e.g., USD, EUR, GBP)')
                .setRequired(true)),
    
    async execute(interaction) {
        await interaction.deferReply();

        try {
            const amount = interaction.options.getNumber('amount');
            const from = interaction.options.getString('from').toUpperCase();
            const to = interaction.options.getString('to').toUpperCase();

            const response = await fetch(`https://api.exchangerate-api.com/v4/latest/${from}`);
            const data = await response.json();

            if (!data.rates || !data.rates[to]) {
                return await interaction.editReply({ 
                    content: '❌ Invalid currency code! Use standard codes like USD, EUR, GBP, JPY, etc.' 
                });
            }

            const rate = data.rates[to];
            const convertedAmount = (amount * rate).toFixed(2);

            const embed = new EmbedBuilder()
                .setTitle('💱 Currency Conversion')
                .addFields(
                    { name: 'From', value: `${amount.toFixed(2)} ${from}`, inline: true },
                    { name: 'To', value: `${convertedAmount} ${to}`, inline: true },
                    { name: 'Exchange Rate', value: `1 ${from} = ${rate.toFixed(4)} ${to}`, inline: false }
                )
                .setColor(0xF1C40F)
                .setFooter({ text: `Last updated: ${new Date(data.time_last_updated * 1000).toLocaleString()}` })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('Currency conversion error:', error);
            await interaction.editReply({ content: '❌ Failed to convert currency. Check your currency codes and try again!' });
        }
    },
};
