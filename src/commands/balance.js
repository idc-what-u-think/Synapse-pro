const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const github = require('../utils/github');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('balance')
        .setDescription('Check your current balance'),

    async execute(interaction) {
        const userId = interaction.user.id;

        try {
            const economy = await github.getEconomy();

            if (!economy[userId]) {
                economy[userId] = { coins: 0, bucks: 0 };
                await github.saveEconomy(economy);
            }

            const userBalance = economy[userId];

            const embed = new EmbedBuilder()
                .setColor('#0099ff')
                .setTitle(`💰 ${interaction.user.username}'s Balance`)
                .addFields(
                    { name: '🪙 Coins', value: `${userBalance.coins.toLocaleString()}`, inline: true },
                    { name: '💵 DMP Bucks', value: `${userBalance.bucks.toLocaleString()}`, inline: true }
                )
                .setFooter({ text: '50 Coins = 1 DMP Buck' })
                .setTimestamp();

            await interaction.reply({ embeds: [embed], ephemeral: true });

        } catch (error) {
            console.error('Error in balance command:', error);
            await interaction.reply({
                content: '❌ An error occurred while fetching your balance.',
                ephemeral: true
            });
        }
    }
};
