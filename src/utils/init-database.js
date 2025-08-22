require('dotenv').config();
const { Octokit } = require('@octokit/rest');

const initialFiles = {
    'config.json': {
        guilds: {}
    },
    'moderation.json': {
        messageLog: [],
        kicks: [],
        bans: [],
        mutes: [],
        warnings: {}
    },
    'levels.json': {
        guilds: {}
    },
    'economy.json': {
        guilds: {}
    },
    'timers.json': {
        timers: [],
        reminders: []
    }
};

async function initializeDatabase() {
    if (!process.env.GITHUB_TOKEN) {
        console.error('GITHUB_TOKEN not found in environment variables');
        process.exit(1);
    }

    const octokit = new Octokit({ 
        auth: process.env.GITHUB_TOKEN,
        previews: ['jean-grey', 'symmetra']
    });
    const { GITHUB_OWNER: owner, GITHUB_REPO: repo } = process.env;

    console.log('Verifying token permissions...');
    try {
        // Check token permissions
        const { data: { permissions } } = await octokit.rest.users.getAuthenticated();
        
        if (!permissions || !permissions.contents || permissions.contents !== 'write') {
            console.error('\nToken lacks required permissions!');
            console.error('Please ensure your token has these permissions:');
            console.error('- repo');
            console.error('- contents (write)');
            console.error('\nCreate a new token at: https://github.com/settings/tokens/new');
            process.exit(1);
        }

        console.log('✓ Token has required permissions');
    } catch (error) {
        console.error('Failed to verify token permissions:', error.message);
        process.exit(1);
    }

    console.log(`\nInitializing database in ${owner}/${repo}...`);

    try {
        // Test repository access with more detailed error handling
        try {
            const { data: repoData } = await octokit.repos.get({ 
                owner, 
                repo,
                headers: {
                    accept: 'application/vnd.github.v3+json'
                }
            });
            console.log(`Repository found: ${repoData.full_name} (${repoData.visibility})`);
        } catch (error) {
            if (error.status === 404) {
                console.error(`Repository ${owner}/${repo} not found`);
                console.error('Please create the repository first');
            } else if (error.status === 401) {
                console.error('Token is invalid or expired');
            } else if (error.status === 403) {
                console.error('Token lacks required permissions');
                console.error('Please ensure the token has the "repo" scope');
            }
            throw error;
        }

        // Modify file creation to use different approach
        for (const [filename, content] of Object.entries(initialFiles)) {
            try {
                console.log(`Processing ${filename}...`);
                
                const contentBase64 = Buffer.from(JSON.stringify(content, null, 2)).toString('base64');
                
                try {
                    // Try to update existing file
                    const { data: existingFile } = await octokit.rest.repos.getContent({
                        owner,
                        repo,
                        path: filename,
                    });

                    await octokit.rest.repos.createOrUpdateFileContents({
                        owner,
                        repo,
                        path: filename,
                        message: `Update ${filename}`,
                        content: contentBase64,
                        sha: existingFile.sha
                    });
                    console.log(`Updated ${filename}`);
                } catch (error) {
                    if (error.status === 404) {
                        // File doesn't exist, create it
                        await octokit.rest.repos.createOrUpdateFileContents({
                            owner,
                            repo,
                            path: filename,
                            message: `Create ${filename}`,
                            content: contentBase64
                        });
                        console.log(`Created ${filename}`);
                    } else {
                        throw error;
                    }
                }
            } catch (error) {
                console.error(`\nError processing ${filename}:`);
                console.error('Status:', error.status);
                console.error('Message:', error.message);
                if (error.response?.data?.message) {
                    console.error('API Message:', error.response.data.message);
                }
                throw error;
            }
        }

        console.log('Database initialization complete!');
    } catch (error) {
        console.error('\nDetailed error information:');
        console.error('Status:', error.status);
        console.error('Message:', error.message);
        console.error('Documentation:', error.documentation_url);
        process.exit(1);
    }
}

initializeDatabase();
