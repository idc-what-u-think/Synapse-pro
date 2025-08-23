const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getConfig, getBalances, saveBalances } = require('../utils/github');

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
            // DEFER IMMEDIATELY to prevent timeout
            await interaction.deferReply();
            console.log(`Coinflip command started by ${interaction.user.tag}`);

            // Check if command is used in a guild
            if (!interaction.guild) {
                return await interaction.editReply({
                    content: '❌ This command can only be used in a server, not in DMs.'
                });
            }

            const bet = interaction.options.getInteger('bet');
            const userChoice = interaction.options.getString('choice');
            
            // Handle case where choice option doesn't exist (old command registration)
            if (!userChoice) {
                return await interaction.editReply({
                    content: '❌ Please use the updated command: `/coinflip bet:<amount> choice:<heads/tails>`\n\nThe bot needs to be restarted or commands re-registered to use the new format.'
                });
            }
            
            // Get config and balance data
            console.log('Fetching config and balance data...');
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
                    content: `❌ Bet must be between ${minBet} and ${maxBet} coins`
                });
            }

            // Get user's current balance
            const userBalance = balancesData[interaction.user.id] || 0;
            
            if (userBalance < bet) {
                return await interaction.editReply({
                    content: `❌ You don't have enough coins! Balance: ${currency} ${userBalance}`
                });
            }

            console.log(`${interaction.user.tag} betting ${bet} coins on ${userChoice} (balance: ${userBalance})`);
            
            // Animated coin flip
            await interaction.editReply(`🪙 Flipping coin... You chose **${userChoice.charAt(0).toUpperCase() + userChoice.slice(1)}**!`);
            await new Promise(resolve => setTimeout(resolve, 800));
            await interaction.editReply('🌕 Flipping coin...');
            await new Promise(resolve => setTimeout(resolve, 600));
            await interaction.editReply('🌓 Flipping coin...');
            await new Promise(resolve => setTimeout(resolve, 600));
            await interaction.editReply('🌑 Flipping coin...');
            await new Promise(resolve => setTimeout(resolve, 800));
            
            // Determine the actual result
            const coinResult = Math.random() < 0.5 ? 'heads' : 'tails';
            const win = userChoice === coinResult;
            const newBalance = win ? userBalance + bet : userBalance - bet;
            
            // Update balance
            balancesData[interaction.user.id] = newBalance;
            await saveBalances(balancesData, `Coinflip: ${interaction.user.tag} ${win ? 'won' : 'lost'} ${bet} coins`);
            
            console.log(`${interaction.user.tag} ${win ? 'won' : 'lost'} ${bet} coins. Coin: ${coinResult}, Choice: ${userChoice}, New balance: ${newBalance}`);

            // Create result embed
            const resultDisplay = coinResult.charAt(0).toUpperCase() + coinResult.slice(1);
            const choiceDisplay = userChoice.charAt(0).toUpperCase() + userChoice.slice(1);
            const coinEmoji = coinResult === 'heads' ? '🪙' : '🥈';
            
            const embed = new EmbedBuilder()
                .setColor(win ? 0x00FF00 : 0xFF0000)
                .setTitle(win ? '🎉 You Won!' : '😢 You Lost!')
                .setDescription(`${coinEmoji} The coin landed on **${resultDisplay}**!\nYou chose **${choiceDisplay}**.`)
                .addFields(
                    { name: 'Your Choice', value: choiceDisplay, inline: true },
                    { name: 'Coin Result', value: resultDisplay, inline: true },
                    { name: 'Bet Amount', value: `${currency} ${bet}`, inline: true },
                    { name: win ? 'Winnings' : 'Lost', value: `${currency} ${bet}`, inline: true },
                    { name: 'New Balance', value: `${currency} ${newBalance}`, inline: true },
                    { name: '\u200B', value: '\u200B', inline: true } // Empty field for formatting
                )
                .setFooter({ text: `${interaction.user.tag}` })
                .setTimestamp();

            await interaction.editReply({ 
                content: null, 
                embeds: [embed] 
            });

        } catch (error) {
            console.error('Coinflip command error:', error);
            
            try {
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({
                        content: '❌ An error occurred while flipping the coin.',
                        ephemeral: true
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