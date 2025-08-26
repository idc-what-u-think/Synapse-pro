const { EmbedBuilder } = require('discord.js');
const { getBankData, saveBankData } = require('./github');

// Initialize bank with starting balance
async function initializeBank(startingBalance = 10000000) {
    try {
        const bankData = await getBankData();
        
        // If bank doesn't exist or has no balance, initialize it
        if (!bankData.balance && bankData.balance !== 0) {
            const initialData = {
                balance: startingBalance,
                initialBalance: startingBalance,
                totalDistributed: 0,
                lastUpdated: new Date().toISOString(),
                createdAt: new Date().toISOString(),
                transactions: []
            };
            
            await saveBankData(initialData, 'Initialize bank with starting balance');
            return initialData;
        }
        
        return bankData;
    } catch (error) {
        console.error('Error initializing bank:', error);
        throw error;
    }
}

// Get current bank balance
async function getBankBalance() {
    try {
        const bankData = await getBankData();
        return bankData.balance || 0;
    } catch (error) {
        console.error('Error getting bank balance:', error);
        return 0;
    }
}

// Deduct money from bank (for daily rewards, game wins, etc.)
async function deductFromBank(amount, reason, userId = null, username = null) {
    try {
        const bankData = await getBankData();
        const currentBalance = bankData.balance || 0;
        
        if (currentBalance < amount) {
            throw new Error('Insufficient bank funds');
        }
        
        const newBalance = currentBalance - amount;
        const updatedData = {
            ...bankData,
            balance: newBalance,
            totalDistributed: (bankData.totalDistributed || 0) + amount,
            lastUpdated: new Date().toISOString(),
            transactions: bankData.transactions || []
        };
        
        // Add transaction record
        updatedData.transactions.push({
            type: 'deduction',
            amount: amount,
            reason: reason,
            userId: userId,
            username: username,
            timestamp: new Date().toISOString(),
            balanceAfter: newBalance
        });
        
        // Keep only last 100 transactions
        if (updatedData.transactions.length > 100) {
            updatedData.transactions = updatedData.transactions.slice(-100);
        }
        
        await saveBankData(updatedData, `Bank deduction: ${amount} - ${reason}`);
        return newBalance;
    } catch (error) {
        console.error('Error deducting from bank:', error);
        throw error;
    }
}

// Add money to bank (for losses, donations, etc.)
async function addToBank(amount, reason, userId = null, username = null) {
    try {
        const bankData = await getBankData();
        const currentBalance = bankData.balance || 0;
        const newBalance = currentBalance + amount;
        
        const updatedData = {
            ...bankData,
            balance: newBalance,
            lastUpdated: new Date().toISOString(),
            transactions: bankData.transactions || []
        };
        
        // Add transaction record
        updatedData.transactions.push({
            type: 'addition',
            amount: amount,
            reason: reason,
            userId: userId,
            username: username,
            timestamp: new Date().toISOString(),
            balanceAfter: newBalance
        });
        
        // Keep only last 100 transactions
        if (updatedData.transactions.length > 100) {
            updatedData.transactions = updatedData.transactions.slice(-100);
        }
        
        await saveBankData(updatedData, `Bank addition: ${amount} - ${reason}`);
        return newBalance;
    } catch (error) {
        console.error('Error adding to bank:', error);
        throw error;
    }
}

// Create bank message embed
async function createBankEmbed() {
    try {
        const bankData = await getBankData();
        const balance = bankData.balance || 0;
        const totalDistributed = bankData.totalDistributed || 0;
        
        const embed = new EmbedBuilder()
            .setColor(0x00FF00)
            .setTitle('Firekid Project Server Trust Fund')
            .setDescription(`**Balance: ${balance.toLocaleString()} coins**`)
            .addFields(
                { name: 'Total Distributed', value: `${totalDistributed.toLocaleString()} coins`, inline: true },
                { name: 'Last Updated', value: `<t:${Math.floor(new Date(bankData.lastUpdated || Date.now()).getTime() / 1000)}:R>`, inline: true }
            )
            .setFooter({ text: 'funded by firekid' })
            .setTimestamp();
            
        return embed;
    } catch (error) {
        console.error('Error creating bank embed:', error);
        return new EmbedBuilder()
            .setColor(0xFF0000)
            .setTitle('Bank Error')
            .setDescription('Unable to fetch bank data');
    }
}

// Update bank message in channel
async function updateBankMessage(client) {
    try {
        const bankChannelId = process.env.BANK_CHANNEL_ID;
        if (!bankChannelId) {
            console.log('No BANK_CHANNEL_ID set in environment');
            return false;
        }

        const bankChannel = client.channels.cache.get(bankChannelId);
        if (!bankChannel) {
            console.log('Bank channel not found');
            return false;
        }

        const embed = await createBankEmbed();

        // Try to find existing bank message
        try {
            const messages = await bankChannel.messages.fetch({ limit: 10 });
            const bankMessage = messages.find(msg => 
                msg.author.id === client.user.id && 
                msg.embeds.length > 0 && 
                msg.embeds[0].title === 'Firekid Project Server Trust Fund'
            );

            if (bankMessage) {
                await bankMessage.edit({ embeds: [embed] });
                return true;
            } else {
                await bankChannel.send({ embeds: [embed] });
                return true;
            }
        } catch (error) {
            console.error('Error updating bank message:', error);
            return false;
        }
    } catch (error) {
        console.error('Error in updateBankMessage:', error);
        return false;
    }
}

// Get bank statistics
async function getBankStats() {
    try {
        const bankData = await getBankData();
        
        return {
            balance: bankData.balance || 0,
            initialBalance: bankData.initialBalance || 10000000,
            totalDistributed: bankData.totalDistributed || 0,
            transactionCount: bankData.transactions ? bankData.transactions.length : 0,
            lastUpdated: bankData.lastUpdated,
            createdAt: bankData.createdAt
        };
    } catch (error) {
        console.error('Error getting bank stats:', error);
        return null;
    }
}

module.exports = {
    initializeBank,
    getBankBalance,
    deductFromBank,
    addToBank,
    createBankEmbed,
    updateBankMessage,
    getBankStats
};
