const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getData } = require('../utils/github');
const { addBalance } = require('../utils/economy');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('coinflip')
        .setDescription('Flip a coin and bet coins')
        .addIntegerOption(option =>
            option.setName('bet')
                .setDescription('Amount to bet')
                .setRequired(true)),

    async execute(interaction, octokit, owner, repo) {
        const bet = interaction.options.getInteger('bet');
        
        // Validate bet amount
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
        
        // Animated coin flip
        const flipMsg = await interaction.editReply('Flipping coin... 🌕');
        await new Promise(resolve => setTimeout(resolve, 500));
        await flipMsg.edit('Flipping coin... 🌓');
        await new Promise(resolve => setTimeout(resolve, 500));
        await flipMsg.edit('Flipping coin... 🌑');
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const win = Math.random() < 0.5;
        const amount = win ? bet : -bet;
        
        const user = await addBalance(interaction.user.id, interaction.guild.id, amount,
            `Coinflip: ${win ? 'won' : 'lost'} ${Math.abs(amount)}`, octokit, owner, repo);

        const embed = new EmbedBuilder()
            .setColor(win ? 0x00FF00 : 0xFF0000)
            .setTitle(win ? 'You Won! 🎉' : 'You Lost! 😢')
            .addFields(
                { name: 'Result', value: win ? 'Heads' : 'Tails', inline: true },
                { name: amount > 0 ? 'Won' : 'Lost', value: `${currency} ${Math.abs(amount)}`, inline: true },
                { name: 'New Balance', value: `${currency} ${user.balance}`, inline: true }
            )
            .setTimestamp();

        await interaction.editReply({ content: null, embeds: [embed] });
    },
};
