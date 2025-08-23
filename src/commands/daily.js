const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getConfig, getBalances, saveBalances, getDaily, saveDaily } = require('../utils/github');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('daily')
        .setDescription('Claim your daily reward'),

    async execute(interaction) {
        try {
            // Defer immediately to prevent timeout
            await interaction.deferReply({ ephemeral: true });

            const userId = interaction.user.id;
            const guildId = interaction.guild.id;

            // Get all necessary data
            const [config, balancesData, dailyData] = await Promise.all([
                getConfig(),
                getBalances(),
                getDaily()
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

            // Get settings
            const guildSettings = config?.guilds?.[guildId]?.settings || {};
            const dailySettings = guildSettings.daily || {};
            const baseAmount = dailySettings.amount || 200;
            const currency = guildSettings.currency || '💰';

            // Calculate streak
            let streak = userDailyData?.streak || 0;
            if (lastDaily && now - lastDaily < 48 * 60 * 60 * 1000) {
                // Claimed within 48 hours, continue streak
                streak++;
            } else {
                // Reset streak
                streak = 1;
            }

            // Calculate bonus (5% per day up to 50% max)
            const bonusPercentage = Math.min(streak * 5, 50);
            const bonusAmount = Math.floor(baseAmount * (bonusPercentage / 100));
            const totalAmount = baseAmount + bonusAmount;

            // Update user balance
            const currentBalance = balancesData[userId] || 0;
            const newBalance = currentBalance + totalAmount;
            balancesData[userId] = newBalance;

            // Update daily data
            if (!dailyData[userId]) dailyData[userId] = {};
            dailyData[userId].lastClaimed = now.toISOString();
            dailyData[userId].streak = streak;
            dailyData[userId].totalClaimed = (dailyData[userId].totalClaimed || 0) + totalAmount;

            // Save both files
            await Promise.all([
                saveBalances(balancesData, `Daily reward: ${interaction.user.tag} claimed ${totalAmount} coins`),
                saveDaily(dailyData, `Daily streak: ${interaction.user.tag} day ${streak}`)
            ]);

            console.log(`${interaction.user.tag} claimed daily reward: ${totalAmount} coins (${streak} day streak)`);

            const embed = new EmbedBuilder()
                .setColor(0x00FF00)
                .setTitle('Daily Reward Claimed!')
                .addFields(
                    { name: 'Base Amount', value: `${currency} ${baseAmount.toLocaleString()}`, inline: true },
                    { name: 'Streak Bonus', value: `${currency} ${bonusAmount.toLocaleString()} (+${bonusPercentage}%)`, inline: true },
                    { name: 'Total Received', value: `${currency} ${totalAmount.toLocaleString()}`, inline: true },
                    { name: 'Current Streak', value: `${streak} day${streak === 1 ? '' : 's'}`, inline: true },
                    { name: 'New Balance', value: `${currency} ${newBalance.toLocaleString()}`, inline: true }
                )
                .setFooter({ text: `Come back in 24 hours for day ${streak + 1}!` })
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