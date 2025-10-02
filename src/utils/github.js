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
    wyr_questions: 'data/games/wyr_questions.json'
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
    getData,
    saveData,
    testPermissions,
    
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
    
    FILE_PATHS
};
