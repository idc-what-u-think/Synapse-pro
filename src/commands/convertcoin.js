const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const github = require('../utils/github');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('convertcoins')
        .setDescription('Convert coins to DMP Bucks (50 Coins = 1 DMP Buck)')
        .addIntegerOption(option =>
            option.setName('coins')
                .setDescription('Number of coins to convert (must be multiples of 50)')
                .setRequired(true)
                .setMinValue(50)),

    async execute(interaction) {
        const userId = interaction.user.id;
        const coinsToConvert = interaction.options.getInteger('coins');

        // Validation: Must be multiple of 50
        if (coinsToConvert % 50 !== 0) {
            return await interaction.reply({
                content: '❌ You can only convert coins in multiples of 50!\n\n**Conversion Rate:** 50 Coins = 1 DMP Buck',
                ephemeral: true
            });
        }

        const bucksToReceive = Math.floor(coinsToConvert / 50);

        try {
            const economy = await github.getEconomy();

            // Initialize user if not exists
            if (!economy[userId]) {
                economy[userId] = { coins: 0, bucks: 0 };
            }

            // Check if user has enough coins
            if (economy[userId].coins < coinsToConvert) {
                return await interaction.reply({
                    content: `❌ Insufficient coins!\n\nYou have: **${economy[userId].coins} Coins**\nRequired: **${coinsToConvert} Coins**`,
                    ephemeral: true
                });
            }

            // Process conversion
            economy[userId].coins -= coinsToConvert;
            economy[userId].bucks += bucksToReceive;

            await github.saveEconomy(economy);

            const embed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle('✅ Conversion Successful!')
                .setDescription(`You converted **${coinsToConvert} 🪙 Coins** to **${bucksToReceive} 💵 DMP Bucks**!`)
                .addFields(
                    { name: 'New Balance', value: `🪙 ${economy[userId].coins} Coins\n💵 ${economy[userId].bucks} DMP Bucks` }
                )
                .setFooter({ text: 'Conversion Rate: 50 Coins = 1 DMP Buck' })
                .setTimestamp();

            await interaction.reply({ embeds: [embed], ephemeral: true });

        } catch (error) {
            console.error('Error in convertcoins command:', error);
            await interaction.reply({
                content: '❌ An error occurred while converting coins.',
                ephemeral: true
            });
        }
    }
};
