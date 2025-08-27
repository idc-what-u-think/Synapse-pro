const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getConfig, getBalances, saveBalances, getBankData, saveBankData } = require('../utils/github');

// Global game state
let activeGame = null;

// Probability distribution for crash multipliers
function generateCrashMultiplier() {
    const rand = Math.random() * 100;
    
    if (rand < 35) {
        // 1.00x - 1.49x (35%)
        return 1.00 + Math.random() * 0.49;
    } else if (rand < 60) {
        // 1.50x - 1.99x (25%)
        return 1.50 + Math.random() * 0.49;
    } else if (rand < 80) {
        // 2.00x - 4.99x (20%)
        return 2.00 + Math.random() * 2.99;
    } else if (rand < 88) {
        // 5.00x - 9.99x (8%)
        return 5.00 + Math.random() * 4.99;
    } else if (rand < 95) {
        // 10.00x - 19.99x (7%)
        return 10.00 + Math.random() * 9.99;
    } else if (rand < 98) {
        // 20.00x - 49.99x (3%)
        return 20.00 + Math.random() * 29.99;
    } else {
        // 50.00x+ (2%)
        const baseMultiplier = 50.00 + Math.random() * 50.00; // 50-100x base
        // Rare chance for extreme multipliers
        if (Math.random() < 0.1) {
            return baseMultiplier + Math.random() * 900; // Up to 1000x
        }
        return baseMultiplier;
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('aviator')
        .setDescription('Play the Aviator crash game - plane flies up, cash out before it crashes!')
        .addIntegerOption(option =>
            option.setName('bet')
                .setDescription('Amount to bet')
                .setRequired(true))
        .addNumberOption(option =>
            option.setName('cashout')
                .setDescription('Auto cashout multiplier (1.1x - 50x)')
                .setRequired(true)
                .setMinValue(1.1)
                .setMaxValue(50)),

    async execute(interaction) {
        try {
            await interaction.deferReply({ flags: 64 }); // Ephemeral

            if (!interaction.guild) {
                return await interaction.editReply({
                    content: '❌ This command can only be used in a server, not in DMs.'
                });
            }

            const bet = interaction.options.getInteger('bet');
            const cashoutTarget = interaction.options.getNumber('cashout');

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

            // Validate bet amount (minimum 100 for aviator)
            const actualMinBet = Math.max(minBet, 100);
            if (bet < actualMinBet || bet > maxBet) {
                return await interaction.editReply({
                    content: `❌ Bet must be between ${actualMinBet} and ${maxBet} coins`
                });
            }

            const userBalance = balancesData[interaction.user.id] || 0;
            if (userBalance < bet) {
                return await interaction.editReply({
                    content: `❌ You don't have enough coins! Balance: ${currency} ${userBalance.toLocaleString()}`
                });
            }

            // Check if there's already an active game
            if (activeGame && activeGame.status !== 'finished') {
                return await interaction.editReply({
                    content: '✈️ There\'s already an Aviator game in progress! Wait for it to finish.'
                });
            }

            // Check bank balance for potential winnings
            const currentBankBalance = bankData.balance || 10000000;
            const maxPotentialWinnings = bet * cashoutTarget;
            
            if (currentBankBalance < maxPotentialWinnings) {
                return await interaction.editReply({
                    content: '❌ The server bank doesn\'t have enough funds for this potential payout!'
                });
            }

            // Initialize new game
            const crashPoint = generateCrashMultiplier();
            activeGame = {
                crashPoint: crashPoint,
                status: 'flying',
                startTime: Date.now(),
                players: [{
                    userId: interaction.user.id,
                    username: interaction.user.tag,
                    bet: bet,
                    cashoutTarget: cashoutTarget,
                    cashedOut: false,
                    winnings: 0
                }]
            };

            console.log(`Aviator game started by ${interaction.user.tag} - Crash point: ${crashPoint.toFixed(2)}x`);

            // Send ephemeral confirmation to user
            await interaction.editReply({
                content: `✈️ Joined Aviator! Bet: ${currency}${bet}, Auto-cashout: ${cashoutTarget}x\nCheck the game channel for live updates!`
            });

            // Start the game simulation
            await startAviatorGame(interaction.client, bankData, balancesData, config);

        } catch (error) {
            console.error('Aviator command error:', error);
            
            try {
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({
                        content: '❌ An error occurred while starting the Aviator game.',
                        flags: 64
                    });
                } else {
                    await interaction.editReply({
                        content: '❌ An error occurred while starting the Aviator game.'
                    });
                }
            } catch (replyError) {
                console.error('Error sending error response:', replyError);
            }
        }
    },
};

async function startAviatorGame(client, bankData, balancesData, config) {
    try {
        const gameChannelId = process.env.GAME_CHANNEL_ID;
        if (!gameChannelId) {
            console.log('GAME_CHANNEL_ID not set in environment variables');
            return;
        }

        const gameChannel = client.channels.cache.get(gameChannelId);
        if (!gameChannel) {
            console.log('Game channel not found in cache');
            return;
        }

        const game = activeGame;
        let currentMultiplier = 1.00;
        const startTime = Date.now();
        let lastUpdateTime = startTime;

        // Send initial game start message
        const initialEmbed = new EmbedBuilder()
            .setColor(0x00FF00)
            .setTitle('✈️ Aviator Game Started!')
            .setDescription(`**${currentMultiplier.toFixed(2)}x**\n\nPlayers:\n${game.players.map(p => `• ${p.username}: ${p.bet} coins → ${p.cashoutTarget}x`).join('\n')}`)
            .setFooter({ text: 'Plane is taking off...' })
            .setTimestamp();

        const gameMessage = await gameChannel.send({ embeds: [initialEmbed] });

        // Game loop - update multiplier in real time
        const gameInterval = setInterval(async () => {
            const currentTime = Date.now();
            const elapsedTime = (currentTime - startTime) / 1000; // seconds
            
            // Calculate current multiplier based on time (exponential growth)
            currentMultiplier = 1.00 + (Math.pow(1.08, elapsedTime) - 1) * 0.3;

            // Check if we've reached the crash point
            if (currentMultiplier >= game.crashPoint) {
                clearInterval(gameInterval);
                
                // Game crashed
                game.status = 'crashed';
                
                // Calculate final results
                let winners = [];
                let losers = [];
                let updatedBankData = {
                    balance: bankData.balance,
                    lastUpdated: new Date().toISOString(),
                    totalDistributed: bankData.totalDistributed || 0,
                    transactions: bankData.transactions || []
                };

                for (let player of game.players) {
                    if (player.cashoutTarget <= game.crashPoint) {
                        // Player won - they cashed out before crash
                        const winnings = Math.floor(player.bet * (player.cashoutTarget - 1)); // Net winnings
                        const newBalance = (balancesData[player.userId] || 0) + winnings;
                        
                        balancesData[player.userId] = newBalance;
                        player.winnings = winnings;
                        winners.push(player);

                        // Bank pays out
                        updatedBankData.balance -= winnings;
                        updatedBankData.totalDistributed += winnings;
                        updatedBankData.transactions.push({
                            type: 'aviator_win',
                            userId: player.userId,
                            username: player.username,
                            amount: winnings,
                            cashoutMultiplier: player.cashoutTarget,
                            crashPoint: game.crashPoint,
                            timestamp: new Date().toISOString()
                        });
                    } else {
                        // Player lost - crash happened before their cashout target
                        const newBalance = (balancesData[player.userId] || 0) - player.bet;
                        balancesData[player.userId] = newBalance;
                        losers.push(player);

                        // Bank collects bet
                        updatedBankData.balance += player.bet;
                        updatedBankData.transactions.push({
                            type: 'aviator_loss',
                            userId: player.userId,
                            username: player.username,
                            amount: -player.bet,
                            cashoutMultiplier: player.cashoutTarget,
                            crashPoint: game.crashPoint,
                            timestamp: new Date().toISOString()
                        });
                    }
                }

                // Keep only last 100 transactions
                if (updatedBankData.transactions.length > 100) {
                    updatedBankData.transactions = updatedBankData.transactions.slice(-100);
                }

                // Save updated data
                await Promise.all([
                    saveBalances(balancesData, `Aviator game: ${winners.length} winners, ${losers.length} losers`),
                    saveBankData(updatedBankData, `Aviator game crashed at ${game.crashPoint.toFixed(2)}x`)
                ]);

                // Send final results
                const crashEmbed = new EmbedBuilder()
                    .setColor(0xFF0000)
                    .setTitle('💥 PLANE CRASHED!')
                    .setDescription(`**Crashed at ${game.crashPoint.toFixed(2)}x**`)
                    .addFields(
                        winners.length > 0 ? {
                            name: '🎉 Winners',
                            value: winners.map(p => `• ${p.username}: Won ${p.winnings} coins (${p.cashoutTarget}x)`).join('\n') || 'None',
                            inline: false
                        } : null,
                        losers.length > 0 ? {
                            name: '😢 Losers', 
                            value: losers.map(p => `• ${p.username}: Lost ${p.bet} coins (wanted ${p.cashoutTarget}x)`).join('\n') || 'None',
                            inline: false
                        } : null
                    ).filter(field => field !== null)
                    .setFooter({ text: 'Game finished' })
                    .setTimestamp();

                await gameMessage.edit({ embeds: [crashEmbed] });
                game.status = 'finished';

                console.log(`Aviator game finished - Crashed at ${game.crashPoint.toFixed(2)}x`);
                return;
            }

            // Update message every 3 seconds for Discord rate limits
            if (currentTime - lastUpdateTime >= 3000) {
                lastUpdateTime = currentTime;
                
                const liveEmbed = new EmbedBuilder()
                    .setColor(0x00FF00)
                    .setTitle('✈️ Aviator Flying!')
                    .setDescription(`**${currentMultiplier.toFixed(2)}x**\n\n${game.players.map(p => {
                        if (p.cashoutTarget <= currentMultiplier) {
                            return `• ✅ ${p.username}: Cashed out at ${p.cashoutTarget}x!`;
                        } else {
                            return `• 🎯 ${p.username}: Target ${p.cashoutTarget}x`;
                        }
                    }).join('\n')}`)
                    .setFooter({ text: `Plane climbing... Current: ${currentMultiplier.toFixed(2)}x` })
                    .setTimestamp();

                try {
                    await gameMessage.edit({ embeds: [liveEmbed] });
                } catch (editError) {
                    console.log('Rate limited or edit error:', editError.message);
                }
            }

        }, 500); // Check every 500ms but only update Discord every 3 seconds

    } catch (error) {
        console.error('Error running Aviator game:', error);
        if (activeGame) {
            activeGame.status = 'finished';
        }
    }
}
