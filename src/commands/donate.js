const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { addToBank, updateBankMessage } = require('../utils/bankManager');
const { getUserBalance, addUserBalance } = require('../utils/economy'); // Changed updateUserBalance to addUserBalance

module.exports = {
    data: new SlashCommandBuilder()
        .setName('donate')
        .setDescription('Donate coins to the server trust fund')
        .addIntegerOption(option =>
            option.setName('amount')
                .setDescription('Amount of coins to donate')
                .setRequired(true)
                .setMinValue(1)),
    async execute(interaction) {
        await interaction.deferReply();
        try {
            const amount = interaction.options.getInteger('amount');
            const userId = interaction.user.id;
            const username = interaction.user.tag;
            
            const userBalance = await getUserBalance(userId);
            
            if (userBalance < amount) {
                const embed = new EmbedBuilder()
                    .setColor(0xFF0000)
                    .setTitle('Insufficient Funds')
                    .setDescription(`You don't have enough coins to donate ${amount.toLocaleString()}.`)
                    .addFields(
                        { name: 'Your Balance', value: `${userBalance.toLocaleString()} coins`, inline: true },
                        { name: 'Requested Amount', value: `${amount.toLocaleString()} coins`, inline: true }
                    );
                
                return await interaction.editReply({ embeds: [embed] });
            }
            
            // Use addUserBalance with negative amount to deduct coins
            await addUserBalance(userId, -amount, `Donation to server trust fund`);
            
            const newBankBalance = await addToBank(
                amount,
                `Donation from ${username}`,
                userId,
                username
            );
            
            const embed = new EmbedBuilder()
                .setColor(0x00FF00)
                .setTitle('Donation Successful! 💖')
                .setDescription(`Thank you for your generous donation to the server trust fund!`)
                .addFields(
                    { name: 'Amount Donated', value: `${amount.toLocaleString()} coins`, inline: true },
                    { name: 'Your New Balance', value: `${(userBalance - amount).toLocaleString()} coins`, inline: true },
                    { name: 'Bank Balance', value: `${newBankBalance.toLocaleString()} coins`, inline: true }
                )
                .setFooter({ text: 'Your contribution helps fund server activities and rewards!' })
                .setTimestamp();
            
            await interaction.editReply({ embeds: [embed] });
            
            await updateBankMessage(interaction.client);
        } catch (error) {
            console.error('Donate command error:', error);
            
            const embed = new EmbedBuilder()
                .setColor(0xFF0000)
                .setTitle('Donation Failed')
                .setDescription('An error occurred while processing your donation. Please try again.');
            
            if (!interaction.replied) {
                await interaction.editReply({ embeds: [embed] });
            }
        }
    }
};
