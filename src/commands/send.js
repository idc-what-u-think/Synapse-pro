const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getConfig, getBalances, saveBalances, getBankData, saveBankData } = require('../utils/github');

// Generate unique transaction ID
function generateTransactionId() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = 'TXN-';
    for (let i = 0; i < 5; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

// Format date for receipt
function formatDate(date) {
    const options = {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    };
    return date.toLocaleDateString('en-US', options);
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('send')
        .setDescription('Send coins to another player')
        .addIntegerOption(option =>
            option.setName('amount')
                .setDescription('Amount of coins to send')
                .setRequired(true)
                .setMinValue(1))
        .addUserOption(option =>
            option.setName('player')
                .setDescription('Player to send coins to')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Reason for the transfer')
                .setRequired(true)
                .setMaxLength(200))
        .addBooleanOption(option =>
            option.setName('send_receipt')
                .setDescription('Send a receipt to the receiver via DM')
                .setRequired(true)),

    async execute(interaction) {
        try {
            await interaction.deferReply({ ephemeral: true });

            const senderId = interaction.user.id;
            const receiver = interaction.options.getUser('player');
            const amount = interaction.options.getInteger('amount');
            const reason = interaction.options.getString('reason');
            const sendReceipt = interaction.options.getBoolean('send_receipt');

            // Prevent sending to self
            if (senderId === receiver.id) {
                return await interaction.editReply({
                    content: '❌ You cannot send coins to yourself!'
                });
            }

            // Prevent sending to bots
            if (receiver.bot) {
                return await interaction.editReply({
                    content: '❌ You cannot send coins to bots!'
                });
            }

            // Get all necessary data
            const [config, balancesData, bankData] = await Promise.all([
                getConfig(),
                getBalances(),
                getBankData()
            ]);

            // Get guild settings
            const guildSettings = config?.guilds?.[interaction.guild.id]?.settings || {};
            const currency = guildSettings.currency || '💰';

            // Check sender balance
            const senderBalance = balancesData[senderId] || 0;
            if (senderBalance < amount) {
                return await interaction.editReply({
                    content: `❌ You don't have enough coins! Your balance: ${currency} ${senderBalance.toLocaleString()}`
                });
            }

            // Update balances
            const receiverBalance = balancesData[receiver.id] || 0;
            balancesData[senderId] = senderBalance - amount;
            balancesData[receiver.id] = receiverBalance + amount;

            // Generate transaction details
            const transactionId = generateTransactionId();
            const timestamp = new Date();
            const formattedDate = formatDate(timestamp);

            // Update bank data with transaction record
            const updatedBankData = {
                balance: bankData.balance || 10000000,
                lastUpdated: timestamp.toISOString(),
                totalDistributed: bankData.totalDistributed || 0,
                transactions: bankData.transactions || []
            };

            // Add transaction record
            updatedBankData.transactions.push({
                type: 'transfer',
                transactionId: transactionId,
                senderId: senderId,
                senderUsername: interaction.user.tag,
                receiverId: receiver.id,
                receiverUsername: receiver.tag,
                amount: amount,
                reason: reason,
                timestamp: timestamp.toISOString()
            });

            // Keep only last 100 transactions
            if (updatedBankData.transactions.length > 100) {
                updatedBankData.transactions = updatedBankData.transactions.slice(-100);
            }

            // Save updated data
            await Promise.all([
                saveBalances(balancesData, `Transfer: ${interaction.user.tag} sent ${amount} coins to ${receiver.tag}`),
                saveBankData(updatedBankData, `Transfer logged: ${transactionId}`)
            ]);

            // Create receipt content
            const receiptContent = `🪙 **Coin Transfer Receipt**
────────────────────────────
📤 **Sender:** ${interaction.user}
📥 **Receiver:** ${receiver}
💰 **Amount:** ${amount.toLocaleString()} coins
📝 **Reason:** ${reason}
🆔 **Transaction ID:** ${transactionId}
📅 **Date:** ${formattedDate}
────────────────────────────
⚡ This is an automated receipt.
| From ${interaction.guild.name}`;

            // Always log to private channel
            try {
                const logChannelId = process.env.TRANSACTION_LOG_CHANNEL_ID;
                if (logChannelId) {
                    const logChannel = interaction.client.channels.cache.get(logChannelId);
                    if (logChannel) {
                        const logEmbed = new EmbedBuilder()
                            .setColor(0x00FF00)
                            .setTitle('💸 Coin Transfer')
                            .setDescription(receiptContent)
                            .addFields(
                                { 
                                    name: '📊 Balance Changes', 
                                    value: `**${interaction.user.tag}:** ${senderBalance.toLocaleString()} → ${balancesData[senderId].toLocaleString()}\n**${receiver.tag}:** ${receiverBalance.toLocaleString()} → ${balancesData[receiver.id].toLocaleString()}`,
                                    inline: false 
                                }
                            )
                            .setFooter({ text: `Server: ${interaction.guild.name}` })
                            .setTimestamp();

                        await logChannel.send({ embeds: [logEmbed] });
                    }
                }
            } catch (logError) {
                console.error('Error logging transfer to private channel:', logError);
                // Don't fail the transaction if logging fails
            }

            // Send DM receipt if requested
            if (sendReceipt) {
                try {
                    const dmEmbed = new EmbedBuilder()
                        .setColor(0x00FF00)
                        .setTitle('🪙 Coin Transfer Receipt')
                        .setDescription(`You received **${amount.toLocaleString()} coins** from **${interaction.user.tag}**!`)
                        .addFields(
                            { name: '📝 Reason', value: reason, inline: false },
                            { name: '💰 Your New Balance', value: `${currency} ${balancesData[receiver.id].toLocaleString()}`, inline: true },
                            { name: '🆔 Transaction ID', value: transactionId, inline: true },
                            { name: '📅 Date', value: formattedDate, inline: true }
                        )
                        .setFooter({ text: `From ${interaction.guild.name}` })
                        .setTimestamp();

                    await receiver.send({ embeds: [dmEmbed] });
                } catch (dmError) {
                    console.error('Error sending DM receipt:', dmError);
                    // Don't fail the transaction if DM fails
                }
            }

            // Send confirmation to sender
            const confirmEmbed = new EmbedBuilder()
                .setColor(0x00FF00)
                .setTitle('✅ Transfer Successful!')
                .addFields(
                    { name: '📤 Sent To', value: `${receiver.tag}`, inline: true },
                    { name: '💰 Amount', value: `${currency} ${amount.toLocaleString()}`, inline: true },
                    { name: '🆔 Transaction ID', value: transactionId, inline: true },
                    { name: '📝 Reason', value: reason, inline: false },
                    { name: '💳 Your New Balance', value: `${currency} ${balancesData[senderId].toLocaleString()}`, inline: true },
                    { name: '📨 Receipt Sent', value: sendReceipt ? '✅ Yes (DM)' : '❌ No', inline: true }
                )
                .setFooter({ text: 'Transfer completed successfully' })
                .setTimestamp();

            await interaction.editReply({ embeds: [confirmEmbed] });

        } catch (error) {
            console.error('Send command error:', error);
            
            try {
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({
                        content: '❌ An error occurred while processing the transfer.',
                        ephemeral: true
                    });
                } else {
                    await interaction.editReply({
                        content: '❌ An error occurred while processing the transfer.'
                    });
                }
            } catch (replyError) {
                console.error('Error sending error response:', replyError);
            }
        }
    },
};
