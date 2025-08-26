const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getConfig, getBalances, saveBalances, getDaily, saveDaily, getBankData, saveBankData } = require('../utils/github');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('daily')
        .setDescription('Claim your daily reward'),

    async execute(interaction) {
        try {
            await interaction.deferReply({ ephemeral: true });

            const userId = interaction.user.id;
            const guildId = interaction.guild.id;

            // Get all necessary data
            const [config, balancesData, dailyData, bankData] = await Promise.all([
                getConfig(),
                getBalances(),
                getDaily(),
                getBankData()
            ]);

            // Check if user already claimed today
            const userDailyData = dailyData[userId];
            const lastDaily = userDailyData?.lastClaimed ? new Date(userDailyData.lastClaimed) : null;
            const now = new Date();
            
            if (lastDaily && now - lastDaily < 24 * 60 * 60 * 1000) {
                const timeLeft = 24 * 60 * 60 * 1000 - (now - lastDaily);
                const hours = Math.floor(timeLeft / 3600000);
                const minutes = Math.floor((timeLeft % 3600000) / 60000);

                return await interaction.editReply({
                    content: `You can claim your next daily reward in **${hours}h ${minutes}m**`
                });
            }

            // Fixed daily amount: 200 coins
            const dailyAmount = 200;
            
            // Get currency setting
            const guildSettings = config?.guilds?.[guildId]?.settings || {};
            const currency = guildSettings.currency || '💰';

            // Check bank balance
            const currentBankBalance = bankData.balance || 10000000;
            if (currentBankBalance < dailyAmount) {
                return await interaction.editReply({
                    content: '❌ The server bank is empty! Daily rewards are temporarily unavailable.'
                });
            }

            // Update user balance
            const currentBalance = balancesData[userId] || 0;
            const newBalance = currentBalance + dailyAmount;
            balancesData[userId] = newBalance;

            // Update daily data
            if (!dailyData[userId]) dailyData[userId] = {};
            dailyData[userId].lastClaimed = now.toISOString();
            dailyData[userId].totalClaimed = (dailyData[userId].totalClaimed || 0) + dailyAmount;

            // Update bank data
            const newBankBalance = currentBankBalance - dailyAmount;
            const updatedBankData = {
                balance: newBankBalance,
                lastUpdated: now.toISOString(),
                totalDistributed: (bankData.totalDistributed || 0) + dailyAmount,
                transactions: bankData.transactions || []
            };
            
            // Add transaction record
            updatedBankData.transactions.push({
                type: 'daily',
                userId: userId,
                username: interaction.user.tag,
                amount: dailyAmount,
                timestamp: now.toISOString()
            });

            // Keep only last 100 transactions to prevent file getting too large
            if (updatedBankData.transactions.length > 100) {
                updatedBankData.transactions = updatedBankData.transactions.slice(-100);
            }

            // Save all data
            await Promise.all([
                saveBalances(balancesData, `Daily reward: ${interaction.user.tag} claimed ${dailyAmount} coins`),
                saveDaily(dailyData, `Daily claim: ${interaction.user.tag}`),
                saveBankData(updatedBankData, `Daily reward deduction: ${dailyAmount} coins to ${interaction.user.tag}`)
            ]);

            const embed = new EmbedBuilder()
                .setColor(0x00FF00)
                .setTitle('Daily Reward Claimed!')
                .addFields(
                    { name: 'Amount Received', value: `${currency} ${dailyAmount.toLocaleString()}`, inline: true },
                    { name: 'New Balance', value: `${currency} ${newBalance.toLocaleString()}`, inline: true },
                    { name: 'Bank Remaining', value: `${currency} ${newBankBalance.toLocaleString()}`, inline: true }
                )
                .setFooter({ text: 'Come back in 24 hours for your next daily reward!' })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('Daily command error:', error);
            
            try {
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({
                        content: 'An error occurred while claiming your daily reward.',
                        ephemeral: true
                    });
                } else {
                    await interaction.editReply({
                        content: 'An error occurred while claiming your daily reward.'
                    });
                }
            } catch (replyError) {
                console.error('Error sending error response:', replyError);
            }
        }
    },
};
