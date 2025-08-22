const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getData } = require('../utils/github');
const { addBalance } = require('../utils/economy');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('daily')
        .setDescription('Claim your daily reward'),

    async execute(interaction, octokit, owner, repo) {
        const data = await getData(octokit, owner, repo, 'economy.json');
        const guildId = interaction.guild.id;
        const userId = interaction.user.id;

        const userData = data?.guilds?.[guildId]?.economy?.[userId];
        const lastDaily = userData?.lastDaily ? new Date(userData.lastDaily) : null;
        const now = new Date();
        
        if (lastDaily && now - lastDaily < 24 * 60 * 60 * 1000) {
            const timeLeft = 24 * 60 * 60 * 1000 - (now - lastDaily);
            const hours = Math.floor(timeLeft / 3600000);
            const minutes = Math.floor((timeLeft % 3600000) / 60000);

            return interaction.reply({
                content: `You can claim your next daily reward in ${hours}h ${minutes}m`,
                ephemeral: true
            });
        }

        const settings = data?.guilds?.[guildId]?.settings || {};
        const baseAmount = settings.dailyReward || 200;
        const currency = settings.currency || '💰';

        // Calculate streak bonus
        let streak = userData?.dailyStreak || 0;
        if (lastDaily && now - lastDaily < 48 * 60 * 60 * 1000) {
            streak++;
        } else {
            streak = 1;
        }

        // Bonus calculation (5% per day up to 50% max)
        const bonus = Math.min(streak * 0.05, 0.5);
        const totalAmount = Math.floor(baseAmount * (1 + bonus));

        const user = await addBalance(userId, guildId, totalAmount, 'Daily reward', octokit, owner, repo);
        user.lastDaily = now.toISOString();
        user.dailyStreak = streak;

        const embed = new EmbedBuilder()
            .setColor(0x00FF00)
            .setTitle('Daily Reward Claimed!')
            .addFields(
                { name: 'Amount', value: `${currency} ${totalAmount.toLocaleString()}`, inline: true },
                { name: 'Streak', value: `${streak} day${streak === 1 ? '' : 's'}`, inline: true },
                { name: 'Bonus', value: `+${Math.floor(bonus * 100)}%`, inline: true },
                { name: 'New Balance', value: `${currency} ${user.balance.toLocaleString()}` }
            )
            .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
    },
};
