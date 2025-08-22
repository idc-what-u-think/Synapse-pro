const { getData, saveData } = require('./github');

async function getBalance(userId, guildId, data) {
    return data?.guilds?.[guildId]?.economy?.[userId]?.balance || 0;
}

async function addBalance(userId, guildId, amount, reason, octokit, owner, repo) {
    const data = await getData(octokit, owner, repo, 'economy.json');
    if (!data.guilds) data.guilds = {};
    if (!data.guilds[guildId]) data.guilds[guildId] = {};
    if (!data.guilds[guildId].economy) data.guilds[guildId].economy = {};
    if (!data.guilds[guildId].economy[userId]) {
        data.guilds[guildId].economy[userId] = {
            balance: 0,
            totalEarned: 0,
            totalSpent: 0,
            lastDaily: null,
            dailyStreak: 0
        };
    }

    const user = data.guilds[guildId].economy[userId];
    user.balance += amount;
    if (amount > 0) user.totalEarned += amount;
    if (amount < 0) user.totalSpent += Math.abs(amount);

    await saveData(octokit, owner, repo, 'economy.json', data,
        `${reason}: ${amount} for user ${userId}`);
        
    return user;
}

module.exports = { getBalance, addBalance };
