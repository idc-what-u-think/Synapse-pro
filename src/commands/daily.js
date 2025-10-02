const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const github = require('../utils/github');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('daily')
        .setDescription('Claim your daily reward of 200 Coins'),

    async execute(interaction) {
        const userId = interaction.user.id;

        try {
            const cooldowns = await github.getDailyCooldowns();
            const economy = await github.getEconomy();

            // Initialize user data
            if (!economy[userId]) {
                economy[userId] = { coins: 0, bucks: 0 };
            }

            const now = Date.now();
            const cooldownTime = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

            // Check if user has a cooldown
            if (cooldowns[userId]) {
                const timeLeft = cooldowns[userId] - now;

                if (timeLeft > 0) {
                    // Still on cooldown
                    const hours = Math.floor(timeLeft / (60 * 60 * 1000));
                    const minutes = Math.floor((timeLeft % (60 * 60 * 1000)) / (60 * 1000));
                    const seconds = Math.floor((timeLeft % (60 * 1000)) / 1000);

                    const timeString = `${hours}h ${minutes}m ${seconds}s`;

                    const cooldownEmbed = new EmbedBuilder()
                        .setColor('#ff0000')
                        .setTitle('⏰ Daily Reward on Cooldown')
                        .setDescription(`You've already claimed your daily reward!\n\nCome back in **${timeString}**`)
                        .addFields({
                            name: 'Next Available',
                            value: `<t:${Math.floor(cooldowns[userId] / 1000)}:R>`
                        })
                        .setTimestamp();

                    return await interaction.reply({ embeds: [cooldownEmbed], ephemeral: true });
                }
            }

            // Grant daily reward
            economy[userId].coins += 200;

            // Set new cooldown (24 hours from now)
            cooldowns[userId] = now + cooldownTime;

            await github.saveEconomy(economy);
            await github.saveDailyCooldowns(cooldowns);

            const rewardEmbed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle('✅ Daily Reward Claimed!')
                .setDescription('You received **200 🪙 Coins**!')
                .addFields(
                    { name: 'New Balance', value: `🪙 ${economy[userId].coins} Coins\n💵 ${economy[userId].bucks} DMP Bucks` },
                    { name: 'Next Daily Reward', value: `<t:${Math.floor(cooldowns[userId] / 1000)}:R>` }
                )
                .setFooter({ text: 'Come back in 24 hours for your next reward!' })
                .setTimestamp();

            await interaction.reply({ embeds: [rewardEmbed], ephemeral: true });

        } catch (error) {
            console.error('Error in daily command:', error);
            await interaction.reply({
                content: '❌ An error occurred while claiming your daily reward.',
                ephemeral: true
            });
        }
    }
};
