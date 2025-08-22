const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getData } = require('../utils/github');
const { addBalance } = require('../utils/economy');

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

    async execute(interaction, octokit, owner, repo) {
        const bet = interaction.options.getInteger('bet');
        const targetNumber = interaction.options.getInteger('number');

        // Validate bet
        const data = await getData(octokit, owner, repo, 'economy.json');
        const settings = data?.guilds?.[interaction.guild.id]?.settings?.gambling || {};
        const minBet = settings.minBet || 10;
        const maxBet = settings.maxBet || 10000;
        const currency = data?.guilds?.[interaction.guild.id]?.settings?.currency || '💰';

        if (bet < minBet || bet > maxBet) {
            return interaction.reply({
                content: `Bet must be between ${minBet} and ${maxBet} coins`,
                ephemeral: true
            });
        }

        const balance = data?.guilds?.[interaction.guild.id]?.economy?.[interaction.user.id]?.balance || 0;
        if (balance < bet) {
            return interaction.reply({
                content: `You don't have enough coins! Balance: ${balance}`,
                ephemeral: true
            });
        }

        await interaction.deferReply();

        // Animated dice roll
        await interaction.editReply('🎲 Rolling...');
        await new Promise(resolve => setTimeout(resolve, 700));
        await interaction.editReply('🎲 Rolling... ' + DICE_EMOJIS[Math.floor(Math.random() * 6 + 1)]);
        await new Promise(resolve => setTimeout(resolve, 700));
        
        const roll = Math.floor(Math.random() * 6) + 1;
        const win = roll === targetNumber;
        const amount = win ? bet * 5 : -bet; // 5x payout for correct guess

        const user = await addBalance(interaction.user.id, interaction.guild.id, amount,
            `Dice: ${win ? 'won' : 'lost'} ${Math.abs(amount)}`, octokit, owner, repo);

        const embed = new EmbedBuilder()
            .setColor(win ? 0x00FF00 : 0xFF0000)
            .setTitle(win ? 'You Won! 🎉' : 'You Lost! 😢')
            .addFields(
                { name: 'Your Number', value: targetNumber.toString(), inline: true },
                { name: 'Rolled', value: `${DICE_EMOJIS[roll]} (${roll})`, inline: true },
                { name: amount > 0 ? 'Won' : 'Lost', value: `${currency} ${Math.abs(amount)}`, inline: true },
                { name: 'New Balance', value: `${currency} ${user.balance}`, inline: true }
            )
            .setTimestamp();

        await interaction.editReply({ content: null, embeds: [embed] });
    },
};
