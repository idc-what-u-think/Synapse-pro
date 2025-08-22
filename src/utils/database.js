const { Octokit } = require('@octokit/rest');

class Database {
    constructor() {
        this.octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
        this.owner = process.env.GITHUB_OWNER;
        this.repo = process.env.GITHUB_REPO;
        this.cache = new Map();

        // Define initial structure
        this.initialFiles = {
            'data/config.json': { guilds: {} },
            'data/moderation/warnings.json': {},
            'data/moderation/bans.json': {},
            'data/moderation/mutes.json': {},
            'data/economy/balances.json': {},
            'data/economy/daily.json': {},
            'data/leveling/levels.json': { guilds: {} },
            'data/features/timers.json': { timers: [], reminders: [] }
        };
    }

    async checkPermissions() {
        try {
            console.log('Checking GitHub permissions...');
            const { data: repo } = await this.octokit.rest.repos.get({
                owner: this.owner,
                repo: this.repo
            });
            
            console.log(`Repository: ${repo.full_name}`);
            console.log(`Permissions: push=${repo.permissions?.push}, admin=${repo.permissions?.admin}`);
            
            if (!repo.permissions?.push) {
                throw new Error('Token does not have write permissions to the repository');
            }
            
            return true;
        } catch (error) {
            console.error('Permission check failed:', error.message);
            if (error.status === 401) {
                console.error('Authentication failed. Check your GITHUB_TOKEN.');
            } else if (error.status === 404) {
                console.error('Repository not found. Check GITHUB_OWNER and GITHUB_REPO.');
            }
            return false;
        }
    }

    async read(path) {
        try {
            // Check cache first
            if (this.cache.has(path)) {
                console.log(`Reading from cache: ${path}`);
                return this.cache.get(path);
            }

            console.log(`Reading from GitHub: ${path}`);
            const response = await this.octokit.rest.repos.getContent({
                owner: this.owner,
                repo: this.repo,
                path
            });

            // Handle if response is an array (directory) or single file
            if (Array.isArray(response.data)) {
                throw new Error(`Path ${path} is a directory, not a file`);
            }

            const content = JSON.parse(Buffer.from(response.data.content, 'base64').toString());
            this.cache.set(path, content);
            console.log(`Successfully read: ${path}`);
            return content;
        } catch (error) {
            if (error.status === 404) {
                console.log(`File not found: ${path} - returning null for creation`);
                return null;
            }
            console.error(`Error reading ${path}:`, error.message);
            throw error;
        }
    }

    async write(path, data) {
        try {
            let sha;
            try {
                const existing = await this.octokit.repos.getContent({
                    owner: this.owner,
                    repo: this.repo,
                    path
                });
                sha = existing.data.sha;
                console.log(`Updating existing file: ${path}`);
            } catch (error) {
                if (error.status !== 404) throw error;
                console.log(`Creating new file: ${path}`);
            }

            const response = await this.octokit.repos.createOrUpdateFileContents({
                owner: this.owner,
                repo: this.repo,
                path,
                message: `${sha ? 'Update' : 'Create'} ${path}`,
                content: Buffer.from(JSON.stringify(data, null, 2)).toString('base64'),
                ...(sha && { sha })
            });

            console.log(`File ${path} successfully written. Commit SHA: ${response.data.commit.sha}`);
            this.cache.set(path, data);
            return true;
        } catch (error) {
            console.error('Write error:', error.message);
            console.error('Error details:', error);
            throw error;
        }
    }

    async ensureStructure() {
        console.log('Ensuring file structure...');
        let createdCount = 0;
        let existingCount = 0;
        let errorCount = 0;
        
        for (const [path, defaultContent] of Object.entries(this.initialFiles)) {
            try {
                console.log(`\nChecking file: ${path}`);
                
                // Try to read the file
                const existingContent = await this.read(path);
                
                if (existingContent === null) {
                    // File doesn't exist, create it
                    console.log(`Creating new file: ${path}`);
                    const success = await this.write(path, defaultContent);
                    if (success) {
                        createdCount++;
                        console.log(`✅ Created: ${path}`);
                    } else {
                        errorCount++;
                        console.error(`❌ Failed to create: ${path}`);
                    }
                } else {
                    // File exists, check if it's empty
                    const isEmpty = Object.keys(existingContent).length === 0 && 
                                   !Array.isArray(existingContent);
                    
                    if (isEmpty) {
                        console.log(`File exists but is empty, writing default content: ${path}`);
                        const success = await this.write(path, defaultContent);
                        if (success) {
                            createdCount++;
                            console.log(`✅ Populated: ${path}`);
                        } else {
                            errorCount++;
                            console.error(`❌ Failed to populate: ${path}`);
                        }
                    } else {
                        existingCount++;
                        console.log(`✅ File exists with content: ${path}`);
                    }
                }
                
                // Small delay to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 100));
                
            } catch (error) {
                errorCount++;
                console.error(`❌ Error processing ${path}:`, error.message);
                
                // For critical errors, we might want to continue with other files
                if (error.status === 401 || error.status === 403) {
                    console.error('Authentication/permission error - stopping setup');
                    throw error;
                }
            }
        }
        
        console.log(`\n📊 Setup Summary:`);
        console.log(`   Created: ${createdCount}`);
        console.log(`   Existing: ${existingCount}`);
        console.log(`   Errors: ${errorCount}`);
        
        if (errorCount > 0) {
            throw new Error(`Failed to create ${errorCount} required files`);
        }
        
        return true;
    }

    getPath(category, file) {
        const categoryPaths = {
            moderation: 'data/moderation/',
            economy: 'data/economy/',
            leveling: 'data/leveling/',
            features: 'data/features/',
            config: 'data/'
        };
        
        const basePath = categoryPaths[category];
        if (!basePath) throw new Error(`Unknown category: ${category}`);
        return basePath + file;
    }

    clearCache() {
        console.log('Clearing cache...');
        this.cache.clear();
    }

    // Utility method to test a single file creation
    async testCreateFile(path, content = {}) {
        console.log(`Testing file creation: ${path}`);
        try {
            const success = await this.write(path, content);
            if (success) {
                console.log(`✅ Test creation successful: ${path}`);
                return true;
            } else {
                console.log(`❌ Test creation failed: ${path}`);
                return false;
            }
        } catch (error) {
            console.error(`❌ Test creation error for ${path}:`, error.message);
            return false;
        }
    }

    // Debug method to check environment variables
    checkEnvironment() {
        console.log('Environment check:');
        console.log(`GITHUB_TOKEN: ${process.env.GITHUB_TOKEN ? '✅ Set' : '❌ Missing'}`);
        console.log(`GITHUB_OWNER: ${process.env.GITHUB_OWNER || '❌ Missing'}`);
        console.log(`GITHUB_REPO: ${process.env.GITHUB_REPO || '❌ Missing'}`);
        
        if (!process.env.GITHUB_TOKEN || !process.env.GITHUB_OWNER || !process.env.GITHUB_REPO) {
            throw new Error('Missing required environment variables');
        }
    }

    async init() {
        console.log('🚀 Starting database initialization...');
        
        try {
            // Check environment variables first
            this.checkEnvironment();
            
            // Test connection and permissions
            console.log('🔍 Testing GitHub connection and permissions...');
            const hasPermissions = await this.checkPermissions();
            if (!hasPermissions) {
                throw new Error('Insufficient GitHub permissions');
            }
            console.log('✅ GitHub connection and permissions verified');

            // Optional: Test creating a single file first
            console.log('🧪 Testing file creation capability...');
            const testSuccess = await this.testCreateFile('test.json', { test: true });
            if (testSuccess) {
                // Clean up test file
                try {
                    const testFile = await this.octokit.rest.repos.getContent({
                        owner: this.owner,
                        repo: this.repo,
                        path: 'test.json'
                    });
                    await this.octokit.rest.repos.deleteFile({
                        owner: this.owner,
                        repo: this.repo,
                        path: 'test.json',
                        message: 'Delete test file',
                        sha: testFile.data.sha
                    });
                    console.log('✅ Test file cleaned up');
                } catch (e) {
                    console.log('Test file cleanup skipped');
                }
            } else {
                throw new Error('File creation test failed');
            }

            // Create and ensure all required files
            console.log('📁 Creating required file structure...');
            await this.ensureStructure();

            console.log('🎉 Database initialization complete!');
            return true;
        } catch (error) {
            console.error('💥 Database initialization failed:', error.message);
            return false;
        }
    }
}

// Create and initialize database instance
const db = new Database();
module.exports = db;