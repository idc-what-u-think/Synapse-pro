const { Octokit } = require('@octokit/rest');

// Initialize octokit instance
const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
const owner = process.env.GITHUB_OWNER;
const repo = process.env.GITHUB_REPO;

// Path mapping for consistent file structure
const FILE_PATHS = {
    config: 'data/config.json',
    warnings: 'data/moderation/warnings.json',
    bans: 'data/moderation/bans.json',
    mutes: 'data/moderation/mutes.json',
    balances: 'data/economy/balances.json',
    daily: 'data/economy/daily.json',
    levels: 'data/leveling/levels.json',
    timers: 'data/features/timers.json',
    bank: 'data/economy/bank.json'
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
            
            // Ensure directory exists
            const pathParts = path.split('/');
            if (pathParts.length > 1) {
                for (let i = 1; i < pathParts.length; i++) {
                    const dirPath = pathParts.slice(0, i).join('/');
                    if (dirPath) {
                        await ensureDirectory(dirPath);
                    }
                }
            }
            
            // Get current file info for SHA
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
                // SHA conflict, wait and retry
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

// Helper functions for specific data types
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

async function getBalances() {
    return await getData('balances');
}

async function saveBalances(balances, message = 'Update balances') {
    return await saveData('balances', balances, message);
}

async function getDaily() {
    return await getData('daily');
}

async function saveDaily(daily, message = 'Update daily') {
    return await saveData('daily', daily, message);
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

async function getBankData() {
    return await getData('bank');
}

async function saveBankData(bankData, message = 'Update bank data') {
    return await saveData('bank', bankData, message);
}

// Test function to verify permissions
async function testPermissions() {
    try {
        const { data: tokenData } = await octokit.rest.users.getAuthenticated();
        const { data: repoData } = await octokit.rest.repos.get({ owner, repo });

        // Test write access
        const testFilePath = '.github/test-write-access';
        try {
            await octokit.rest.repos.createOrUpdateFileContents({
                owner,
                repo,
                path: testFilePath,
                message: 'Test write access',
                content: Buffer.from('test').toString('base64'),
            });
            
            // Clean up test file
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
    
    // Specific data type functions
    getConfig,
    saveConfig,
    getWarnings,
    saveWarnings,
    getBans,
    saveBans,
    getMutes,
    saveMutes,
    getBalances,
    saveBalances,
    getDaily,
    saveDaily,
    getLevels,
    saveLevels,
    getTimers,
    saveTimers,
    getBankData,
    saveBankData,
    
    // Path mapping
    FILE_PATHS
};
