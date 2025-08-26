const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getConfig, getBalances, saveBalances, getBankData, saveBankData } = require('../utils/github');

const DICE_EMOJIS = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];

module.exports = {
    data: new SlashCommandBuilder()
        .setName('dice')
        .setDescription('Roll a dice and bet coins on two numbers with different multipliers')
        .addIntegerOption(option =>
            option.setName('bet')
                .setDescription('Amount to bet')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('number1')
                .setDescription('First number to bet on (1-6)')
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(6))
        .addIntegerOption(option =>
            option.setName('number2')
                .setDescription('Second number to bet on (1-6)')
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(6))
        .addStringOption(option =>
            option.setName('multipliers')
                .setDescription('Choose multiplier pair')
                .setRequired(true)
                .addChoices(
                    { name: '4x,1x - Higher risk/reward', value: '4x,1x' },
                    { name: '3x,2x - Medium risk/reward', value: '3x,2x' },
                    { name: '6x,4x - Highest risk/reward (Min bet 1500)', value: '6x,4x' }
                )),

    async execute(interaction) {
        try {
            // Defer immediately with ephemeral response
            await interaction.deferReply({ 
                flags: 64 // InteractionResponseFlags.Ephemeral
            });

            if (!interaction.guild) {
                return await interaction.editReply({
                    content: '❌ This command can only be used in a server, not in DMs.'
                });
            }

            const bet = interaction.options.getInteger('bet');
            const number1 = interaction.options.getInteger('number1');
            const number2 = interaction.options.getInteger('number2');
            const multipliersChoice = interaction.options.getString('multipliers');

            // Check if numbers are different
            if (number1 === number2) {
                return await interaction.editReply({
                    content: '❌ You must pick two different numbers!'
                });
            }

            // Parse multipliers
            const [mult1Str, mult2Str] = multipliersChoice.split(',');
            const multiplier1 = parseInt(mult1Str.replace('x', ''));
            const multiplier2 = parseInt(mult2Str.replace('x', ''));

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

            // Validate bet amount (minimum 100 for dice, 1500 for 6x,4x)
            let actualMinBet = Math.max(minBet, 100);
            if (multipliersChoice === '6x,4x') {
                actualMinBet = Math.max(actualMinBet, 1500);
            }

            if (bet < actualMinBet || bet > maxBet) {
                return await interaction.editReply({
                    content: `❌ Bet must be between ${actualMinBet} and ${maxBet} coins${multipliersChoice === '6x,4x' ? ' (minimum 1500 for 6x,4x)' : ''}`
                });
            }

            const userBalance = balancesData[interaction.user.id] || 0;
            if (userBalance < bet) {
                return await interaction.editReply({
                    content: `❌ You don't have enough coins! Balance: ${currency} ${userBalance.toLocaleString()}`
                });
            }

            // Check bank balance for potential maximum winnings
            const currentBankBalance = bankData.balance || 10000000;
            const maxMultiplier = Math.max(multiplier1, multiplier2);
            const maxPotentialWinnings = bet * (maxMultiplier - 1); // Net winnings (subtract original bet)
            
            if (currentBankBalance < maxPotentialWinnings) {
                return await interaction.editReply({
                    content: '❌ The server bank doesn\'t have enough funds for this potential payout!'
                });
            }

            console.log(`${interaction.user.tag} betting ${bet} on ${number1}(${multiplier1}x) and ${number2}(${multiplier2}x) - balance: ${userBalance}`);

            // Animated dice roll
            await interaction.editReply(`🎲 Rolling dice... You picked: **${number1}** (${multiplier1}x) and **${number2}** (${multiplier2}x)`);
            await new Promise(resolve => setTimeout(resolve, 400));
            await interaction.editReply('🎲 Rolling... ' + DICE_EMOJIS[Math.floor(Math.random() * 6 + 1)]);
            await new Promise(resolve => setTimeout(resolve, 400));
            
            const roll = Math.floor(Math.random() * 6) + 1;
            
            let win = false;
            let winMultiplier = 0;
            let netWinnings = 0;
            let newBalance;

            // Check if player won
            if (roll === number1) {
                win = true;
                winMultiplier = multiplier1;
                netWinnings = bet * (multiplier1 - 1); // Net winnings (total payout - original bet)
            } else if (roll === number2) {
                win = true;
                winMultiplier = multiplier2;
                netWinnings = bet * (multiplier2 - 1); // Net winnings (total payout - original bet)
            }

            let updatedBankData = {
                balance: currentBankBalance,
                lastUpdated: new Date().toISOString(),
                totalDistributed: bankData.totalDistributed || 0,
                transactions: bankData.transactions || []
            };

            if (win) {
                // Player wins: gets net winnings, bank loses that amount
                newBalance = userBalance + netWinnings;
                updatedBankData.balance -= netWinnings;
                updatedBankData.totalDistributed += netWinnings;
                updatedBankData.transactions.push({
                    type: 'dice_win',
                    userId: interaction.user.id,
                    username: interaction.user.tag,
                    amount: netWinnings,
                    multiplier: winMultiplier,
                    rolledNumber: roll,
                    selectedNumbers: `${number1},${number2}`,
                    multiplierChoice: multipliersChoice,
                    timestamp: new Date().toISOString()
                });
            } else {
                // Player loses: loses bet amount, money goes to bank
                newBalance = userBalance - bet;
                updatedBankData.balance += bet;
                updatedBankData.transactions.push({
                    type: 'dice_loss',
                    userId: interaction.user.id,
                    username: interaction.user.tag,
                    amount: -bet,
                    rolledNumber: roll,
                    selectedNumbers: `${number1},${number2}`,
                    multiplierChoice: multipliersChoice,
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
                saveBalances(balancesData, `Dice roll: ${interaction.user.tag} ${win ? 'won' : 'lost'} ${win ? netWinnings : bet} coins`),
                saveBankData(updatedBankData, `Dice ${win ? 'payout' : 'collection'}: ${win ? netWinnings : bet} coins`)
            ]);

            console.log(`${interaction.user.tag} rolled ${roll}, ${win ? `won ${winMultiplier}x` : 'lost'}. New balance: ${newBalance}`);

            // Send ephemeral result to user
            await interaction.editReply({
                content: `${win ? '🎉 You won!' : '😢 You lost!'} Check the game channel for details.`
            });

            // Create result embed for game channel
            const embed = new EmbedBuilder()
                .setColor(win ? 0x00FF00 : 0xFF0000)
                .setTitle(win ? '🎉 Dice Winner!' : '😢 Dice Loss')
                .setDescription(`🎲 ${DICE_EMOJIS[roll]} Rolled **${roll}**!\n<@${interaction.user.id}> picked: **${number1}** (${multiplier1}x) and **${number2}** (${multiplier2}x)`)
                .addFields(
                    { name: 'Selected Numbers', value: `${number1} (${multiplier1}x), ${number2} (${multiplier2}x)`, inline: true },
                    { name: 'Rolled', value: `${DICE_EMOJIS[roll]} (${roll})`, inline: true },
                    { name: 'Result', value: win ? `Hit ${roll} for ${winMultiplier}x!` : 'No match', inline: true },
                    { name: 'Bet Amount', value: `${currency} ${bet}`, inline: true },
                    { name: win ? `Winnings (${winMultiplier}x total)` : 'Lost', value: `${currency} ${(win ? netWinnings : bet).toLocaleString()}`, inline: true },
                    { name: 'New Balance', value: `${currency} ${newBalance.toLocaleString()}`, inline: true }
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
            console.error('Dice command error:', error);
            
            try {
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({
                        content: '❌ An error occurred while rolling the dice.',
                        flags: 64 // Ephemeral flag
                    });
                } else {
                    await interaction.editReply({
                        content: '❌ An error occurred while rolling the dice.'
                    });
                }
            } catch (replyError) {
                console.error('Error sending error response:', replyError);
            }
        }
    },
};
