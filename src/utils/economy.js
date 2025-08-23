const { getBalances, saveBalances, getConfig } = require('./github');

async function getUserBalance(userId) {
    try {
        const balances = await getBalances();
        return balances[userId] || 0;
    } catch (error) {
        console.error('Error getting user balance:', error);
        return 0;
    }
}

async function setUserBalance(userId, amount, reason = 'Balance update') {
    try {
        const balances = await getBalances();
        balances[userId] = Math.max(0, amount); // Prevent negative balances
        await saveBalances(balances, reason);
        return balances[userId];
    } catch (error) {
        console.error('Error setting user balance:', error);
        throw error;
    }
}

async function addUserBalance(userId, amount, reason = 'Balance change') {
    try {
        const currentBalance = await getUserBalance(userId);
        const newBalance = Math.max(0, currentBalance + amount); // Prevent negative balances
        return await setUserBalance(userId, newBalance, reason);
    } catch (error) {
        console.error('Error adding to user balance:', error);
        throw error;
    }
}

async function getEconomySettings(guildId) {
    try {
        const config = await getConfig();
        const guildSettings = config?.guilds?.[guildId]?.settings || {};
        
        return {
            currency: guildSettings.currency || '💰',
            gambling: {
                minBet: guildSettings.gambling?.minBet || 10,
                maxBet: guildSettings.gambling?.maxBet || 10000,
                enabled: guildSettings.gambling?.enabled !== false
            },
            daily: {
                amount: guildSettings.daily?.amount || 100,
                enabled: guildSettings.daily?.enabled !== false
            }
        };
    } catch (error) {
        console.error('Error getting economy settings:', error);
        return {
            currency: '💰',
            gambling: { minBet: 10, maxBet: 10000, enabled: true },
            daily: { amount: 100, enabled: true }
        };
    }
}

module.exports = {
    getUserBalance,
    setUserBalance,
    addUserBalance,
    getEconomySettings
};