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
    timers: 'data/features/timers.json'
};

async function initializeRepo(octokit, owner, repo) {
    try {
        // Check if repo exists
        const response = await octokit.rest.repos.get({ owner, repo }); // Fixed: Added .rest
        console.log(`Repository ${owner}/${repo} exists`);
        return response;
    } catch (error) {
        if (error.status === 404) {
            // Create repo if it doesn't exist
            const newRepo = await octokit.rest.repos.createForAuthenticatedUser({ // Fixed: Added .rest
                name: repo,
                auto_init: true,
                private: true,
                description: 'Discord bot data storage'
            });
            console.log(`Created repository ${owner}/${repo}`);
            return newRepo;
        } else {
            throw error;
        }
    }
}

async function ensureDirectory(dirPath) {
    try {
        await octokit.rest.repos.getContent({ // Fixed: Added .rest
            owner,
            repo,
            path: dirPath
        });
    } catch (error) {
        if (error.status === 404) {
            // Directory doesn't exist, create it with a .gitkeep file
            try {
                await octokit.rest.repos.createOrUpdateFileContents({ // Fixed: Added .rest
                    owner,
                    repo,
                    path: `${dirPath}/.gitkeep`,
                    message: `Create directory: ${dirPath}`,
                    content: Buffer.from('').toString('base64')
                });
                console.log(`Created directory: ${dirPath}`);
            } catch (createError) {
                if (createError.status !== 422) { // 422 means file already exists
                    throw createError;
                }
            }
        }
    }
}

async function getData(pathOrKey) {
    try {
        // Validate input
        if (!pathOrKey) {
            console.error('getData called with undefined/null path');
            throw new Error('Path parameter is required');
        }
        
        await initializeRepo(octokit, owner, repo);
        
        // Check if it's a predefined key or a custom path
        const path = FILE_PATHS[pathOrKey] || pathOrKey;
        
        console.log(`Getting data from: ${path}`);
        const response = await octokit.rest.repos.getContent({
            owner,
            repo,
            path,
        });
        
        const data = JSON.parse(Buffer.from(response.data.content, 'base64').toString());
        console.log(`Successfully retrieved data from: ${path}`);
        return data;
    } catch (error) {
        if (error.status === 404) {
            console.log(`File ${pathOrKey} not found, returning empty object`);
            return {};
        }
        console.error(`Error getting data from ${pathOrKey}:`, error.message);
        throw error;
    }
}

async function saveData(pathOrKey, content, message = 'Update data') {
    try {
        await initializeRepo(octokit, owner, repo);
        
        // Check if it's a predefined key or a custom path
        const path = FILE_PATHS[pathOrKey] || pathOrKey;
        
        console.log(`Saving data to: ${path}`);
        
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
        
        let sha;
        try {
            const existing = await octokit.rest.repos.getContent({ // Fixed: Added .rest
                owner,
                repo,
                path,
            });
            sha = existing.data.sha;
            console.log(`File exists, will update: ${path}`);
        } catch (error) {
            if (error.status === 404) {
                console.log(`File doesn't exist, will create: ${path}`);
            } else {
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

        const result = await octokit.rest.repos.createOrUpdateFileContents(params); // Fixed: Added .rest
        console.log(`Successfully saved data to: ${path}`);
        return result;
    } catch (error) {
        console.error(`Error saving data to ${pathOrKey}:`, error.message);
        if (error.status === 403) {
            console.error('Permission denied. Check your GitHub token permissions.');
            console.error('Required permissions: repo (full control) or contents:write');
        }
        throw error;
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

// Test function to verify permissions
async function testPermissions() {
    const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
    const owner = process.env.GITHUB_OWNER;
    const repo = process.env.GITHUB_REPO;

    try {
        console.log(`Testing access to ${owner}/${repo}...`);
        
        // Verify token authentication - Fixed: Added .rest
        const { data: tokenData } = await octokit.rest.users.getAuthenticated();
        console.log('Authenticated as:', tokenData.login);

        // Verify repository access - Fixed: Added .rest
        const { data: repoData } = await octokit.rest.repos.get({ owner, repo });
        console.log('Repository access verified:', repoData.full_name);

        // Test write access by creating a temporary file
        const testFilePath = '.github/test-write-access';
        try {
            await octokit.rest.repos.createOrUpdateFileContents({ // Fixed: Added .rest
                owner,
                repo,
                path: testFilePath,
                message: 'Test write access',
                content: Buffer.from('test').toString('base64'),
            });
            console.log('✓ Write permission verified');
            
            // Clean up test file
            const { data: fileData } = await octokit.rest.repos.getContent({ // Fixed: Added .rest
                owner,
                repo,
                path: testFilePath,
            });
            await octokit.rest.repos.deleteFile({ // Fixed: Added .rest
                owner,
                repo,
                path: testFilePath,
                message: 'Remove test write access file',
                sha: fileData.sha,
            });
            console.log('✓ Test file cleaned up');
            return true;
        } catch (writeError) {
            console.error('Write permission test failed:', writeError.message);
            console.error('Ensure your token has the "repo" scope for private repositories.');
            
            // Additional error analysis for fine-grained tokens
            if (writeError.message.includes('Resource not accessible by integration')) {
                console.error('\n🔍 SPECIFIC ISSUE DETECTED:');
                console.error('You are using a fine-grained personal access token.');
                console.error('Fine-grained tokens need specific repository permissions.');
                console.error('\nRECOMMENDED FIX:');
                console.error('1. Go to https://github.com/settings/tokens');
                console.error('2. Click "Generate new token (classic)"');
                console.error('3. Select "repo" scope');
                console.error('4. Replace your current token with the classic one');
            }
            
            return false;
        }
    } catch (error) {
        console.error('Permission test failed:', error.message);
        if (error.status === 401) {
            console.error('Invalid or expired token.');
        } else if (error.status === 403) {
            console.error('Token lacks required permissions.');
        } else if (error.status === 404) {
            console.error('Repository not found or no access.');
        }
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
    
    // Path mapping
    FILE_PATHS
};