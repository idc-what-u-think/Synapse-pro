const { Octokit } = require('@octokit/rest');

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
const owner = process.env.GITHUB_OWNER;
const repo = process.env.GITHUB_REPO;

const FILE_PATHS = {
    config: 'data/config.json',
    warnings: 'data/moderation/warnings.json',
    bans: 'data/moderation/bans.json',
    mutes: 'data/moderation/mutes.json',
    levels: 'data/leveling/levels.json',
    timers: 'data/features/timers.json',
    active_giveaways: 'data/giveaways/active.json',
    giveaway_history: 'data/giveaways/history.json',
    economy: 'data/economy/balances.json',
    inventory: 'data/economy/inventory.json',
    daily_cooldowns: 'data/economy/daily_cooldowns.json',
    active_rooms: 'data/games/active_rooms.json',
    game_rewards: 'data/games/rewards.json',
    wyr_questions: 'data/games/wyr_questions.json',
    referral_links: 'data/referrals/links.json',
    referral_tracking: 'data/referrals/tracking.json',
    setup_cooldowns: 'data/setup/cooldowns.json',
    
    // NEW: Sensitivity Generator Data
    sensi_users: 'data/sensitivity/users.json',
    sensi_generations: 'data/sensitivity/generations.json',
    sensi_servers: 'data/sensitivity/servers.json',
    sensi_config: 'data/sensitivity/config.json',
    sensi_api_keys: 'data/sensitivity/api_keys.json',
    sensi_notifications: 'data/sensitivity/notifications.json',
    sensi_broadcast_history: 'data/sensitivity/broadcast_history.json',
};

async function initializeRepo(octokit, owner, repo) {
    try {
        await octokit.rest.repos.get({ owner, repo });
        return true;
    } catch (error) {
        if (error.status === 404) {
            const newRepo = await octokit.rest.repos.createForAuthenticatedUser({
                name: repo,
                auto_init: true,
                private: true,
                description: 'Discord bot data storage'
            });
            return newRepo;
        } else {
            throw error;
        }
    }
}

async function ensureDirectory(dirPath) {
    try {
        await octokit.rest.repos.getContent({
            owner,
            repo,
            path: dirPath
        });
    } catch (error) {
        if (error.status === 404) {
            try {
                await octokit.rest.repos.createOrUpdateFileContents({
                    owner,
                    repo,
                    path: `${dirPath}/.gitkeep`,
                    message: `Create directory: ${dirPath}`,
                    content: Buffer.from('').toString('base64')
                });
            } catch (createError) {
                if (createError.status !== 422) {
                    throw createError;
                }
            }
        }
    }
}

async function getData(pathOrKey) {
    try {
        if (!pathOrKey) {
            throw new Error('Path parameter is required');
        }
        
        await initializeRepo(octokit, owner, repo);
        const path = FILE_PATHS[pathOrKey] || pathOrKey;
        
        const response = await octokit.rest.repos.getContent({
            owner,
            repo,
            path,
        });
        
        const data = JSON.parse(Buffer.from(response.data.content, 'base64').toString());
        return data;
    } catch (error) {
        if (error.status === 404) {
            return {};
        }
        console.error(`Error getting data from ${pathOrKey}:`, error.message);
        throw error;
    }
}

async function saveData(pathOrKey, content, message = 'Update data', maxRetries = 3) {
    let attempt = 0;
    
    while (attempt < maxRetries) {
        try {
            await initializeRepo(octokit, owner, repo);
            const path = FILE_PATHS[pathOrKey] || pathOrKey;
            
            const pathParts = path.split('/');
            if (pathParts.length > 1) {
                for (let i = 1; i < pathParts.length; i++) {
                    const dirPath = pathParts.slice(0, i).join('/');
                    if (dirPath) {
                        await ensureDirectory(dirPath);
                    }
                }
            }
            
            let sha;
            try {
                const existing = await octokit.rest.repos.getContent({
                    owner,
                    repo,
                    path,
                });
                sha = existing.data.sha;
            } catch (error) {
                if (error.status !== 404) {
                    throw error;
                }
            }

            const params = {
                owner,
                repo,
                path,
                message: message || `Update ${path}`,
                content: Buffer.from(JSON.stringify(content, null, 2)).toString('base64'),
            };
            
            if (sha) params.sha = sha;

            const result = await octokit.rest.repos.createOrUpdateFileContents(params);
            return result;
            
        } catch (error) {
            if (error.status === 409 && attempt < maxRetries - 1) {
                attempt++;
                await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
                continue;
            }
            
            console.error(`Error saving data to ${pathOrKey}:`, error.message);
            if (error.status === 403) {
                console.error('Permission denied. Check your GitHub token permissions.');
            }
            throw error;
        }
    }
}

// ============================================
// EXISTING FUNCTIONS (kept as-is)
// ============================================

async function getConfig() {
    return await getData('config');
}

async function saveConfig(config, message = 'Update config') {
    return await saveData('config', config, message);
}

async function getWarnings() {
    return await getData('warnings');
}

async function saveWarnings(warnings, message = 'Update warnings') {
    return await saveData('warnings', warnings, message);
}

async function getBans() {
    return await getData('bans');
}

async function saveBans(bans, message = 'Update bans') {
    return await saveData('bans', bans, message);
}

async function getMutes() {
    return await getData('mutes');
}

async function saveMutes(mutes, message = 'Update mutes') {
    return await saveData('mutes', mutes, message);
}

async function getLevels() {
    return await getData('levels');
}

async function saveLevels(levels, message = 'Update levels') {
    return await saveData('levels', levels, message);
}

async function getTimers() {
    return await getData('timers');
}

async function saveTimers(timers, message = 'Update timers') {
    return await saveData('timers', timers, message);
}

async function getActiveGiveaways() {
    return await getData('active_giveaways');
}

async function saveActiveGiveaways(activeGiveaways, message = 'Update active giveaways') {
    return await saveData('active_giveaways', activeGiveaways, message);
}

async function getGiveawayHistory() {
    return await getData('giveaway_history');
}

async function saveGiveawayHistory(giveawayHistory, message = 'Update giveaway history') {
    return await saveData('giveaway_history', giveawayHistory, message);
}

async function getEconomy() {
    const data = await getData('economy');
    return data || {};
}

async function saveEconomy(economy, message = 'Update economy') {
    return await saveData('economy', economy, message);
}

async function getInventory() {
    const data = await getData('inventory');
    return data || {};
}

async function saveInventory(inventory, message = 'Update inventory') {
    return await saveData('inventory', inventory, message);
}

async function getDailyCooldowns() {
    const data = await getData('daily_cooldowns');
    return data || {};
}

async function saveDailyCooldowns(cooldowns, message = 'Update daily cooldowns') {
    return await saveData('daily_cooldowns', cooldowns, message);
}

async function getActiveRooms() {
    const data = await getData('active_rooms');
    return data || {};
}

async function saveActiveRooms(rooms, message = 'Update active rooms') {
    return await saveData('active_rooms', rooms, message);
}

async function getGameRewards() {
    const data = await getData('game_rewards');
    return data || {
        typing_race_round: { coins: 50, bucks: 0 },
        wyr_winner: { coins: 300, bucks: 2 },
        reaction_winner: { coins: 100, bucks: 1 }
    };
}

async function saveGameRewards(rewards, message = 'Update game rewards') {
    return await saveData('game_rewards', rewards, message);
}

async function getWYRQuestions() {
    const data = await getData('wyr_questions');
    if (!data || !data.questions || data.questions.length === 0) {
        return {
            questions: [
                { optionA: "Have the ability to fly", optionB: "Have the ability to turn invisible" },
                { optionA: "Live in a mansion in the city", optionB: "Live in a cabin in the woods" },
                { optionA: "Always be 10 minutes late", optionB: "Always be 20 minutes early" },
                { optionA: "Have unlimited money", optionB: "Have unlimited time" },
                { optionA: "Never use social media again", optionB: "Never watch another movie or TV show" }
            ]
        };
    }
    return data;
}

async function saveWYRQuestions(questions, message = 'Update WYR questions') {
    return await saveData('wyr_questions', questions, message);
}

async function getSetupCooldowns() {
    const data = await getData('setup_cooldowns');
    return data || {};
}

async function saveSetupCooldowns(cooldowns, message = 'Update setup cooldowns') {
    return await saveData('setup_cooldowns', cooldowns, message);
}

// ============================================
// NEW: SENSITIVITY GENERATOR FUNCTIONS
// ============================================

// Users Management
async function getSensiUsers() {
    const data = await getData('sensi_users');
    return data || { users: {} };
}

async function saveSensiUsers(users, message = 'Update sensitivity users') {
    return await saveData('sensi_users', users, message);
}

async function getSensiUser(userId) {
    const data = await getSensiUsers();
    return data.users[userId] || null;
}

async function updateSensiUser(userId, updates, message = 'Update user') {
    const data = await getSensiUsers();
    if (data.users[userId]) {
        data.users[userId] = { ...data.users[userId], ...updates };
        await saveSensiUsers(data, message);
        return data.users[userId];
    }
    return null;
}

async function createSensiUser(userId, username) {
    const data = await getSensiUsers();
    data.users[userId] = {
        userId: userId,
        username: username,
        role: 'free',
        totalGenerations: 0,
        generationsToday: 0,
        lastGenerationDate: null,
        createdAt: new Date().toISOString(),
        lastLogin: new Date().toISOString(),
        vipGrantedBy: null,
        vipGrantedAt: null,
        vipExpiresAt: null,
        isBanned: false,
        banReason: null,
        bannedBy: null,
        bannedAt: null
    };
    await saveSensiUsers(data, `Created user ${username}`);
    return data.users[userId];
}

async function grantVIP(userId, duration, grantedBy) {
    const data = await getSensiUsers();
    if (!data.users[userId]) return null;
    
    let expiresAt = null;
    if (duration !== 'permanent') {
        const days = parseInt(duration);
        expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
    }
    
    data.users[userId].role = 'vip';
    data.users[userId].vipGrantedBy = grantedBy;
    data.users[userId].vipGrantedAt = new Date().toISOString();
    data.users[userId].vipExpiresAt = expiresAt;
    
    await saveSensiUsers(data, `Granted VIP to ${data.users[userId].username}`);
    return data.users[userId];
}

async function revokeVIP(userId) {
    const data = await getSensiUsers();
    if (!data.users[userId]) return null;
    
    data.users[userId].role = 'free';
    data.users[userId].vipGrantedBy = null;
    data.users[userId].vipGrantedAt = null;
    data.users[userId].vipExpiresAt = null;
    
    await saveSensiUsers(data, `Revoked VIP from ${data.users[userId].username}`);
    return data.users[userId];
}

async function banUser(userId, reason, bannedBy) {
    const data = await getSensiUsers();
    if (!data.users[userId]) return null;
    
    data.users[userId].isBanned = true;
    data.users[userId].banReason = reason;
    data.users[userId].bannedBy = bannedBy;
    data.users[userId].bannedAt = new Date().toISOString();
    
    await saveSensiUsers(data, `Banned user ${data.users[userId].username}`);
    return data.users[userId];
}

async function unbanUser(userId) {
    const data = await getSensiUsers();
    if (!data.users[userId]) return null;
    
    data.users[userId].isBanned = false;
    data.users[userId].banReason = null;
    data.users[userId].bannedBy = null;
    data.users[userId].bannedAt = null;
    
    await saveSensiUsers(data, `Unbanned user ${data.users[userId].username}`);
    return data.users[userId];
}

// Generation Logs
async function getSensiGenerations() {
    const data = await getData('sensi_generations');
    return data || { logs: [] };
}

async function saveSensiGenerations(generations, message = 'Update sensitivity generations') {
    return await saveData('sensi_generations', generations, message);
}

async function addGenerationLog(logData) {
    const data = await getSensiGenerations();
    data.logs.push({
        id: Date.now().toString(),
        ...logData,
        generatedAt: new Date().toISOString()
    });
    await saveSensiGenerations(data, 'Log generation');
    return data.logs[data.logs.length - 1];
}

async function getGenerationsByUser(userId, limit = 50) {
    const data = await getSensiGenerations();
    return data.logs
        .filter(log => log.userId === userId)
        .slice(-limit)
        .reverse();
}

async function getGenerationsByGame(game, limit = 100) {
    const data = await getSensiGenerations();
    return data.logs
        .filter(log => log.game === game)
        .slice(-limit)
        .reverse();
}

async function getGenerationsToday() {
    const data = await getSensiGenerations();
    const today = new Date().toISOString().split('T')[0];
    return data.logs.filter(log => log.generatedAt.startsWith(today));
}

// Server Management
async function getSensiServers() {
    const data = await getData('sensi_servers');
    return data || { servers: {} };
}

async function saveSensiServers(servers, message = 'Update sensitivity servers') {
    return await saveData('sensi_servers', servers, message);
}

async function updateServerInfo(serverId, serverName, memberCount) {
    const data = await getSensiServers();
    if (!data.servers[serverId]) {
        data.servers[serverId] = {
            serverId: serverId,
            serverName: serverName,
            memberCount: memberCount,
            isVip: false,
            isBlacklisted: false,
            vipGrantedBy: null,
            vipGrantedAt: null,
            vipExpiresAt: null,
            blacklistReason: null,
            blacklistedBy: null,
            blacklistedAt: null,
            joinedAt: new Date().toISOString(),
            totalGenerations: 0,
            activeUsers: 0
        };
    } else {
        data.servers[serverId].serverName = serverName;
        data.servers[serverId].memberCount = memberCount;
    }
    await saveSensiServers(data, `Updated server ${serverName}`);
    return data.servers[serverId];
}

async function grantServerVIP(serverId, duration, grantedBy) {
    const data = await getSensiServers();
    if (!data.servers[serverId]) return null;
    
    let expiresAt = null;
    if (duration !== 'permanent') {
        const days = parseInt(duration);
        expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
    }
    
    data.servers[serverId].isVip = true;
    data.servers[serverId].vipGrantedBy = grantedBy;
    data.servers[serverId].vipGrantedAt = new Date().toISOString();
    data.servers[serverId].vipExpiresAt = expiresAt;
    
    await saveSensiServers(data, `Granted VIP to server ${data.servers[serverId].serverName}`);
    return data.servers[serverId];
}

async function revokeServerVIP(serverId) {
    const data = await getSensiServers();
    if (!data.servers[serverId]) return null;
    
    data.servers[serverId].isVip = false;
    data.servers[serverId].vipGrantedBy = null;
    data.servers[serverId].vipGrantedAt = null;
    data.servers[serverId].vipExpiresAt = null;
    
    await saveSensiServers(data, `Revoked VIP from server ${data.servers[serverId].serverName}`);
    return data.servers[serverId];
}

async function blacklistServer(serverId, reason, blacklistedBy) {
    const data = await getSensiServers();
    if (!data.servers[serverId]) return null;
    
    data.servers[serverId].isBlacklisted = true;
    data.servers[serverId].blacklistReason = reason;
    data.servers[serverId].blacklistedBy = blacklistedBy;
    data.servers[serverId].blacklistedAt = new Date().toISOString();
    
    await saveSensiServers(data, `Blacklisted server ${data.servers[serverId].serverName}`);
    return data.servers[serverId];
}

async function unblacklistServer(serverId) {
    const data = await getSensiServers();
    if (!data.servers[serverId]) return null;
    
    data.servers[serverId].isBlacklisted = false;
    data.servers[serverId].blacklistReason = null;
    data.servers[serverId].blacklistedBy = null;
    data.servers[serverId].blacklistedAt = null;
    
    await saveSensiServers(data, `Unblacklisted server ${data.servers[serverId].serverName}`);
    return data.servers[serverId];
}

// Bot Configuration
async function getSensiConfig() {
    const data = await getData('sensi_config');
    return data || {
        maintenanceMode: false,
        botStatus: 'online',
        features: {
            allowSignups: true,
            allowGenerations: true,
            requireAccountForGeneration: true
        },
        notifications: {
            newUserSignup: { enabled: true, webhookUrl: null, email: null },
            vipGranted: { enabled: true, webhookUrl: null, email: null },
            userBanned: { enabled: true, webhookUrl: null, email: null },
            dailySummary: { enabled: true, webhookUrl: null, email: null },
            generationMilestone: { enabled: true, webhookUrl: null, email: null }
        }
    };
}

async function saveSensiConfig(config, message = 'Update sensitivity config') {
    return await saveData('sensi_config', config, message);
}

// API Keys
async function getSensiApiKeys() {
    const data = await getData('sensi_api_keys');
    return data || { keys: [] };
}

async function saveSensiApiKeys(keys, message = 'Update API keys') {
    return await saveData('sensi_api_keys', keys, message);
}

async function createApiKey(name, createdBy) {
    const data = await getSensiApiKeys();
    const keyValue = `sk_${crypto.randomUUID().replace(/-/g, '')}`;
    
    data.keys.push({
        id: crypto.randomUUID(),
        name: name,
        keyValue: keyValue,
        createdBy: createdBy,
        createdAt: new Date().toISOString(),
        lastUsed: null,
        isActive: true,
        rateLimit: 100,
        requestsToday: 0,
        totalRequests: 0
    });
    
    await saveSensiApiKeys(data, `Created API key: ${name}`);
    return data.keys[data.keys.length - 1];
}

async function deleteApiKey(keyId) {
    const data = await getSensiApiKeys();
    data.keys = data.keys.filter(k => k.id !== keyId);
    await saveSensiApiKeys(data, `Deleted API key ${keyId}`);
    return true;
}

// Broadcast History
async function getSensiBroadcastHistory() {
    const data = await getData('sensi_broadcast_history');
    return data || { broadcasts: [] };
}

async function saveSensiBroadcastHistory(history, message = 'Update broadcast history') {
    return await saveData('sensi_broadcast_history', history, message);
}

async function addBroadcast(broadcastData) {
    const data = await getSensiBroadcastHistory();
    data.broadcasts.push({
        id: Date.now().toString(),
        ...broadcastData,
        sentAt: new Date().toISOString()
    });
    await saveSensiBroadcastHistory(data, 'Log broadcast');
    return data.broadcasts[data.broadcasts.length - 1];
}

// Statistics & Analytics
async function getSensiStats() {
    const users = await getSensiUsers();
    const generations = await getSensiGenerations();
    const servers = await getSensiServers();
    
    const userList = Object.values(users.users);
    const today = new Date().toISOString().split('T')[0];
    
    return {
        totalUsers: userList.length,
        vipUsers: userList.filter(u => u.role === 'vip').length,
        freeUsers: userList.filter(u => u.role === 'free').length,
        bannedUsers: userList.filter(u => u.isBanned).length,
        totalServers: Object.keys(servers.servers || {}).length,
        vipServers: Object.values(servers.servers || {}).filter(s => s.isVip).length,
        blacklistedServers: Object.values(servers.servers || {}).filter(s => s.isBlacklisted).length,
        generationsToday: generations.logs.filter(l => l.generatedAt.startsWith(today)).length,
        generationsTotal: generations.logs.length,
        popularDevices: getPopularDevices(generations.logs, 10),
        gameStats: getGameStats(generations.logs),
        dailyGenerations: getDailyGenerations(generations.logs, 7)
    };
}

function getPopularDevices(logs, limit = 10) {
    const deviceCounts = {};
    logs.forEach(log => {
        deviceCounts[log.deviceName] = (deviceCounts[log.deviceName] || 0) + 1;
    });
    return Object.entries(deviceCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map(([device, count]) => ({ device, count }));
}

function getGameStats(logs) {
    const stats = { freefire: 0, codm: 0 };
    logs.forEach(log => {
        stats[log.game] = (stats[log.game] || 0) + 1;
    });
    return stats;
}

function getDailyGenerations(logs, days = 7) {
    const daily = {};
    const now = Date.now();
    
    for (let i = 0; i < days; i++) {
        const date = new Date(now - i * 24 * 60 * 60 * 1000);
        const dateStr = date.toISOString().split('T')[0];
        daily[dateStr] = 0;
    }
    
    logs.forEach(log => {
        const date = log.generatedAt.split('T')[0];
        if (daily.hasOwnProperty(date)) {
            daily[date]++;
        }
    });
    
    return Object.entries(daily)
        .map(([date, count]) => ({ date, count }))
        .reverse();
}

// Test Permissions
async function testPermissions() {
    try {
        const { data: tokenData } = await octokit.rest.users.getAuthenticated();
        const { data: repoData } = await octokit.rest.repos.get({ owner, repo });

        const testFilePath = '.github/test-write-access';
        try {
            await octokit.rest.repos.createOrUpdateFileContents({
                owner,
                repo,
                path: testFilePath,
                message: 'Test write access',
                content: Buffer.from('test').toString('base64'),
            });
            
            const { data: fileData } = await octokit.rest.repos.getContent({
                owner,
                repo,
                path: testFilePath,
            });
            await octokit.rest.repos.deleteFile({
                owner,
                repo,
                path: testFilePath,
                message: 'Remove test write access file',
                sha: fileData.sha,
            });
            return true;
        } catch (writeError) {
            console.error('Write permission test failed:', writeError.message);
            return false;
        }
    } catch (error) {
        console.error('Permission test failed:', error.message);
        return false;
    }
}

module.exports = {
    // Core functions
    getData,
    saveData,
    testPermissions,
    
    // Existing functions
    getConfig,
    saveConfig,
    getWarnings,
    saveWarnings,
    getBans,
    saveBans,
    getMutes,
    saveMutes,
    getLevels,
    saveLevels,
    getTimers,
    saveTimers,
    getActiveGiveaways,
    saveActiveGiveaways,
    getGiveawayHistory,
    saveGiveawayHistory,
    getEconomy,
    saveEconomy,
    getInventory,
    saveInventory,
    getDailyCooldowns,
    saveDailyCooldowns,
    getActiveRooms,
    saveActiveRooms,
    getGameRewards,
    saveGameRewards,
    getWYRQuestions,
    saveWYRQuestions,
    getSetupCooldowns,
    saveSetupCooldowns,
    
    // NEW: Sensitivity Generator Functions
    // Users
    getSensiUsers,
    saveSensiUsers,
    getSensiUser,
    updateSensiUser,
    createSensiUser,
    grantVIP,
    revokeVIP,
    banUser,
    unbanUser,
    
    // Generations
    getSensiGenerations,
    saveSensiGenerations,
    addGenerationLog,
    getGenerationsByUser,
    getGenerationsByGame,
    getGenerationsToday,
    
    // Servers
    getSensiServers,
    saveSensiServers,
    updateServerInfo,
    grantServerVIP,
    revokeServerVIP,
    blacklistServer,
    unblacklistServer,
    
    // Config
    getSensiConfig,
    saveSensiConfig,
    
    // API Keys
    getSensiApiKeys,
    saveSensiApiKeys,
    createApiKey,
    deleteApiKey,
    
    // Broadcast
    getSensiBroadcastHistory,
    saveSensiBroadcastHistory,
    addBroadcast,
    
    // Stats
    getSensiStats,
    
    FILE_PATHS
};
