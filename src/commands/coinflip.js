const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getConfig, getBalances, saveBalances, getBankData, saveBankData } = require('../utils/github');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('coinflip')
        .setDescription('Flip a coin and bet coins')
        .addIntegerOption(option =>
            option.setName('bet')
                .setDescription('Amount to bet')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('choice')
                .setDescription('Choose heads or tails')
                .setRequired(true)
                .addChoices(
                    { name: 'Heads', value: 'heads' },
                    { name: 'Tails', value: 'tails' }
                )),

    async execute(interaction) {
        try {
            // Acknowledge the interaction immediately with ephemeral response
            await interaction.deferReply({ 
                flags: 64 // InteractionResponseFlags.Ephemeral
            });

            if (!interaction.guild) {
                return await interaction.editReply({
                    content: '❌ This command can only be used in a server, not in DMs.'
                });
            }

            const bet = interaction.options.getInteger('bet');
            const userChoice = interaction.options.getString('choice');
            
            if (!userChoice) {
                return await interaction.editReply({
                    content: '❌ Please use the updated command: `/coinflip bet:<amount> choice:<heads/tails>`'
                });
            }
            
            // Get config, balance and bank data
            const [config, balancesData, bankData] = await Promise.all([
                getConfig(),
                getBalances(),
                getBankData()
            ]);
            
            // Get settings with defaults
            const guildSettings = config?.guilds?.[interaction.guild.id]?.settings || {};
            const gamblingSettings = guildSettings.gambling || {};
            const minBet = gamblingSettings.minBet || 10;
            const maxBet = gamblingSettings.maxBet || 10000;
            const currency = guildSettings.currency || '💰';

            // Validate bet amount (minimum 100 for coinflip)
            const actualMinBet = Math.max(minBet, 100);
            if (bet < actualMinBet || bet > maxBet) {
                return await interaction.editReply({
                    content: `❌ Bet must be between ${actualMinBet} and ${maxBet} coins`
                });
            }

            // Get user's current balance
            const userBalance = balancesData[interaction.user.id] || 0;
            
            if (userBalance < bet) {
                return await interaction.editReply({
                    content: `❌ You don't have enough coins! Balance: ${currency} ${userBalance}`
                });
            }

            // Check bank balance for potential winnings (1x bet)
            const currentBankBalance = bankData.balance || 10000000;
            const potentialWinnings = bet; // 1x payout (user doubles their money: bet back + bet winnings)
            
            if (currentBankBalance < potentialWinnings) {
                return await interaction.editReply({
                    content: '❌ The server bank doesn\'t have enough funds for this bet!'
                });
            }

            // Shorter animated coin flip to avoid timeout
            await interaction.editReply(`🪙 Flipping coin... You chose **${userChoice.charAt(0).toUpperCase() + userChoice.slice(1)}**!`);
            await new Promise(resolve => setTimeout(resolve, 500));
            await interaction.editReply('🌕 Flipping...');
            await new Promise(resolve => setTimeout(resolve, 400));
            await interaction.editReply('🌓 Flipping...');
            await new Promise(resolve => setTimeout(resolve, 400));
            
            // Determine the actual result
            const coinResult = Math.random() < 0.5 ? 'heads' : 'tails';
            const win = userChoice === coinResult;
            
            let newBalance;
            let updatedBankData = {
                balance: currentBankBalance,
                lastUpdated: new Date().toISOString(),
                totalDistributed: bankData.totalDistributed || 0,
                transactions: bankData.transactions || []
            };

            if (win) {
                // User wins: gets bet amount (doubling their money), bank loses bet amount
                newBalance = userBalance + potentialWinnings;
                updatedBankData.balance -= potentialWinnings;
                updatedBankData.totalDistributed += potentialWinnings;
                updatedBankData.transactions.push({
                    type: 'coinflip_win',
                    userId: interaction.user.id,
                    username: interaction.user.tag,
                    amount: potentialWinnings,
                    timestamp: new Date().toISOString()
                });
            } else {
                // User loses: loses bet amount, money goes to bank
                newBalance = userBalance - bet;
                updatedBankData.balance += bet;
                updatedBankData.transactions.push({
                    type: 'coinflip_loss',
                    userId: interaction.user.id,
                    username: interaction.user.tag,
                    amount: -bet,
                    timestamp: new Date().toISOString()
                });
            }

            // Keep only last 100 transactions
            if (updatedBankData.transactions.length > 100) {
                updatedBankData.transactions = updatedBankData.transactions.slice(-100);
            }
            
            // Update balance and bank
            balancesData[interaction.user.id] = newBalance;
            await Promise.all([
                saveBalances(balancesData, `Coinflip: ${interaction.user.tag} ${win ? 'won' : 'lost'} ${win ? potentialWinnings : bet} coins`),
                saveBankData(updatedBankData, `Coinflip ${win ? 'payout' : 'collection'}: ${win ? potentialWinnings : bet} coins`)
            ]);

            // Send ephemeral result to user
            await interaction.editReply({
                content: `${win ? '🎉 You won!' : '😢 You lost!'} Check the game channel for details.`
            });

            // Create result embed for game channel
            const resultDisplay = coinResult.charAt(0).toUpperCase() + coinResult.slice(1);
            const choiceDisplay = userChoice.charAt(0).toUpperCase() + userChoice.slice(1);
            const coinEmoji = coinResult === 'heads' ? '🪙' : '🥈';
            
            const embed = new EmbedBuilder()
                .setColor(win ? 0x00FF00 : 0xFF0000)
                .setTitle(win ? '🎉 Coinflip Winner!' : '😢 Coinflip Loss')
                .setDescription(`${coinEmoji} The coin landed on **${resultDisplay}**!\n<@${interaction.user.id}> chose **${choiceDisplay}**.`)
                .addFields(
                    { name: 'Player Choice', value: choiceDisplay, inline: true },
                    { name: 'Coin Result', value: resultDisplay, inline: true },
                    { name: 'Bet Amount', value: `${currency} ${bet}`, inline: true },
                    { name: win ? 'Winnings' : 'Lost', value: `${currency} ${win ? potentialWinnings : bet}`, inline: true },
                    { name: 'New Balance', value: `${currency} ${newBalance}`, inline: true },
                    { name: 'Bank Balance', value: `${currency} ${updatedBankData.balance.toLocaleString()}`, inline: true }
                )
                .setFooter({ text: `${interaction.user.tag}` })
                .setTimestamp();

            // Send detailed result to game channel
            try {
                const gameChannelId = process.env.GAME_CHANNEL_ID;
                if (gameChannelId) {
                    const gameChannel = interaction.client.channels.cache.get(gameChannelId);
                    if (gameChannel) {
                        await gameChannel.send({ embeds: [embed] });
                    } else {
                        console.log('Game channel not found in cache');
                    }
                } else {
                    console.log('GAME_CHANNEL_ID not set in environment variables');
                }
            } catch (channelError) {
                console.error('Error sending to game channel:', channelError);
            }

        } catch (error) {
            console.error('Coinflip command error:', error);
            
            try {
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({
                        content: '❌ An error occurred while flipping the coin.',
                        flags: 64 // Ephemeral flag
                    });
                } else {
                    await interaction.editReply({
                        content: '❌ An error occurred while flipping the coin.'
                    });
                }
            } catch (replyError) {
                console.error('Error sending error response:', replyError);
            }
        }
    },
};
