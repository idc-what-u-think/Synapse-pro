const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getConfig, getBalances, saveBalances } = require('../utils/github');

const DICE_EMOJIS = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];

module.exports = {
    data: new SlashCommandBuilder()
        .setName('dice')
        .setDescription('Roll a dice and bet coins')
        .addIntegerOption(option =>
            option.setName('bet')
                .setDescription('Amount to bet')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('number')
                .setDescription('Number to bet on (1-6)')
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(6)),

    async execute(interaction) {
        try {
            // Defer immediately to prevent timeout
            await interaction.deferReply();

            const bet = interaction.options.getInteger('bet');
            const targetNumber = interaction.options.getInteger('number');

            // Get config and balance data
            const [config, balancesData] = await Promise.all([
                getConfig(),
                getBalances()
            ]);

            // Get settings with defaults
            const guildSettings = config?.guilds?.[interaction.guild.id]?.settings || {};
            const gamblingSettings = guildSettings.gambling || {};
            const minBet = gamblingSettings.minBet || 10;
            const maxBet = gamblingSettings.maxBet || 10000;
            const currency = guildSettings.currency || '💰';

            // Validate bet amount
            if (bet < minBet || bet > maxBet) {
                return await interaction.editReply({
                    content: `Bet must be between ${minBet} and ${maxBet} coins`
                });
            }

            const userBalance = balancesData[interaction.user.id] || 0;
            if (userBalance < bet) {
                return await interaction.editReply({
                    content: `You don't have enough coins! Balance: ${currency} ${userBalance.toLocaleString()}`
                });
            }

            console.log(`${interaction.user.tag} betting ${bet} on ${targetNumber} (balance: ${userBalance})`);

            // Animated dice roll
            await interaction.editReply('🎲 Rolling...');
            await new Promise(resolve => setTimeout(resolve, 700));
            await interaction.editReply('🎲 Rolling... ' + DICE_EMOJIS[Math.floor(Math.random() * 6 + 1)]);
            await new Promise(resolve => setTimeout(resolve, 700));
            
            const roll = Math.floor(Math.random() * 6) + 1;
            const win = roll === targetNumber;
            const winnings = win ? bet * 5 : 0; // 5x payout for correct guess
            const newBalance = win ? userBalance + winnings : userBalance - bet;

            // Update balance
            balancesData[interaction.user.id] = newBalance;
            await saveBalances(balancesData, `Dice roll: ${interaction.user.tag} ${win ? 'won' : 'lost'} ${win ? winnings : bet} coins`);

            console.log(`${interaction.user.tag} rolled ${roll}, ${win ? 'won' : 'lost'}. New balance: ${newBalance}`);

            const embed = new EmbedBuilder()
                .setColor(win ? 0x00FF00 : 0xFF0000)
                .setTitle(win ? 'You Won! 🎉' : 'You Lost! 😢')
                .addFields(
                    { name: 'Your Number', value: targetNumber.toString(), inline: true },
                    { name: 'Rolled', value: `${DICE_EMOJIS[roll]} (${roll})`, inline: true },
                    { name: win ? 'Won' : 'Lost', value: `${currency} ${(win ? winnings : bet).toLocaleString()}`, inline: true },
                    { name: 'New Balance', value: `${currency} ${newBalance.toLocaleString()}`, inline: true }
                )
                .setFooter({ text: `${interaction.user.tag}` })
                .setTimestamp();

            await interaction.editReply({ content: null, embeds: [embed] });

        } catch (error) {
            console.error('Dice command error:', error);
            
            try {
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({
                        content: 'An error occurred while rolling the dice.',
                        ephemeral: true
                    });
                } else {
                    await interaction.editReply({
                        content: 'An error occurred while rolling the dice.'
                    });
                }
            } catch (replyError) {
                console.error('Error sending error response:', replyError);
            }
        }
    },
};