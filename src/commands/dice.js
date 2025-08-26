const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getConfig, getBalances, saveBalances, getBankData, saveBankData } = require('../utils/github');

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
                .setMaxValue(6))
        .addStringOption(option =>
            option.setName('risk')
                .setDescription('Risk level - affects payout multiplier')
                .setRequired(true)
                .addChoices(
                    { name: '3x Payout (2 numbers win)', value: '3x' },
                    { name: '4x Payout (1 number wins)', value: '4x' },
                    { name: '6x Payout (4 numbers win) - Min bet 1500', value: '6x' }
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
            const targetNumber = interaction.options.getInteger('number');
            const riskLevel = interaction.options.getString('risk');

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

            // Validate bet amount (minimum 100 for dice, 1500 for 6x risk)
            let actualMinBet = Math.max(minBet, 100);
            if (riskLevel === '6x') {
                actualMinBet = Math.max(actualMinBet, 1500);
            }

            if (bet < actualMinBet || bet > maxBet) {
                return await interaction.editReply({
                    content: `❌ Bet must be between ${actualMinBet} and ${maxBet} coins${riskLevel === '6x' ? ' (minimum 1500 for 6x risk)' : ''}`
                });
            }

            const userBalance = balancesData[interaction.user.id] || 0;
            if (userBalance < bet) {
                return await interaction.editReply({
                    content: `❌ You don't have enough coins! Balance: ${currency} ${userBalance.toLocaleString()}`
                });
            }

            // Determine win conditions and multipliers based on risk level
            let winCondition, multiplier, riskDescription;
            switch (riskLevel) {
                case '3x':
                    // 3x payout: win if roll is target number OR target number + 1 (wrapping 6->1)
                    const secondNumber = targetNumber === 6 ? 1 : targetNumber + 1;
                    winCondition = (roll) => roll === targetNumber || roll === secondNumber;
                    multiplier = 2; // Net gain of 2x bet (user gets 3x total: bet back + 2x bet winnings)
                    riskDescription = `${targetNumber} or ${secondNumber}`;
                    break;
                case '4x':
                    // 4x payout: win only on exact number
                    winCondition = (roll) => roll === targetNumber;
                    multiplier = 3; // Net gain of 3x bet (user gets 4x total: bet back + 3x bet winnings)
                    riskDescription = `${targetNumber}`;
                    break;
                case '6x':
                    // 6x payout: win if roll is NOT target number AND NOT opposite number
                    const oppositeNumber = targetNumber <= 3 ? targetNumber + 3 : targetNumber - 3;
                    winCondition = (roll) => roll !== targetNumber && roll !== oppositeNumber;
                    multiplier = 5; // Net gain of 5x bet (user gets 6x total: bet back + 5x bet winnings)
                    riskDescription = `any number except ${targetNumber} and ${oppositeNumber}`;
                    break;
            }

            // Check bank balance for potential winnings
            const currentBankBalance = bankData.balance || 10000000;
            const potentialWinnings = bet * multiplier;
            
            if (currentBankBalance < potentialWinnings) {
                return await interaction.editReply({
                    content: '❌ The server bank doesn\'t have enough funds for this bet!'
                });
            }

            console.log(`${interaction.user.tag} betting ${bet} on ${riskDescription} (${riskLevel}) - balance: ${userBalance}`);

            // Animated dice roll
            await interaction.editReply(`🎲 Rolling dice... You need: **${riskDescription}** (${riskLevel} payout)`);
            await new Promise(resolve => setTimeout(resolve, 400));
            await interaction.editReply('🎲 Rolling... ' + DICE_EMOJIS[Math.floor(Math.random() * 6 + 1)]);
            await new Promise(resolve => setTimeout(resolve, 400));
            
            const roll = Math.floor(Math.random() * 6) + 1;
            const win = winCondition(roll);
            
            let newBalance;
            let updatedBankData = {
                balance: currentBankBalance,
                lastUpdated: new Date().toISOString(),
                totalDistributed: bankData.totalDistributed || 0,
                transactions: bankData.transactions || []
            };

            if (win) {
                // User wins: gets multiplier * bet as winnings, bank loses that amount
                newBalance = userBalance + potentialWinnings;
                updatedBankData.balance -= potentialWinnings;
                updatedBankData.totalDistributed += potentialWinnings;
                updatedBankData.transactions.push({
                    type: 'dice_win',
                    userId: interaction.user.id,
                    username: interaction.user.tag,
                    amount: potentialWinnings,
                    riskLevel: riskLevel,
                    timestamp: new Date().toISOString()
                });
            } else {
                // User loses: loses bet amount, money goes to bank
                newBalance = userBalance - bet;
                updatedBankData.balance += bet;
                updatedBankData.transactions.push({
                    type: 'dice_loss',
                    userId: interaction.user.id,
                    username: interaction.user.tag,
                    amount: -bet,
                    riskLevel: riskLevel,
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
                saveBalances(balancesData, `Dice roll (${riskLevel}): ${interaction.user.tag} ${win ? 'won' : 'lost'} ${win ? potentialWinnings : bet} coins`),
                saveBankData(updatedBankData, `Dice ${win ? 'payout' : 'collection'} (${riskLevel}): ${win ? potentialWinnings : bet} coins`)
            ]);

            console.log(`${interaction.user.tag} rolled ${roll}, ${win ? 'won' : 'lost'}. New balance: ${newBalance}`);

            // Send ephemeral result to user
            await interaction.editReply({
                content: `${win ? '🎉 You won!' : '😢 You lost!'} Check the game channel for details.`
            });

            // Create result embed for game channel
            const embed = new EmbedBuilder()
                .setColor(win ? 0x00FF00 : 0xFF0000)
                .setTitle(win ? '🎉 Dice Winner!' : '😢 Dice Loss')
                .setDescription(`🎲 ${DICE_EMOJIS[roll]} Rolled **${roll}**!\n<@${interaction.user.id}> needed: **${riskDescription}** (${riskLevel} risk)`)
                .addFields(
                    { name: 'Risk Level', value: riskLevel, inline: true },
                    { name: 'Win Condition', value: riskDescription, inline: true },
                    { name: 'Rolled', value: `${DICE_EMOJIS[roll]} (${roll})`, inline: true },
                    { name: 'Bet Amount', value: `${currency} ${bet}`, inline: true },
                    { name: win ? `Winnings (${riskLevel})` : 'Lost', value: `${currency} ${(win ? potentialWinnings : bet).toLocaleString()}`, inline: true },
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
