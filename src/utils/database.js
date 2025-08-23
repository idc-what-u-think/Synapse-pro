const { Octokit } = require('@octokit/rest');

class GitHubDebugger {
    constructor() {
        this.octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
        this.owner = process.env.GITHUB_OWNER;
        this.repo = process.env.GITHUB_REPO;
    }

    async comprehensiveDebug() {
        console.log('🔍 Starting comprehensive GitHub debugging...\n');
        
        try {
            // 1. Check token type and basic info
            await this.checkTokenInfo();
            
            // 2. Check repository access
            await this.checkRepositoryAccess();
            
            // 3. Check specific permissions
            await this.checkDetailedPermissions();
            
            // 4. Test different write operations
            await this.testWriteOperations();
            
            // 5. Check repository settings
            await this.checkRepositorySettings();
            
        } catch (error) {
            console.error('❌ Debug process failed:', error.message);
        }
    }

    async checkTokenInfo() {
        console.log('📊 TOKEN INFORMATION:');
        console.log('=' .repeat(50));
        
        try {
            const { data: user } = await this.octokit.rest.users.getAuthenticated();
            console.log(`✅ Authenticated as: ${user.login}`);
            console.log(`   Account type: ${user.type}`);
            console.log(`   Account ID: ${user.id}`);
            
            // Check if it's a fine-grained token by looking at headers
            const response = await this.octokit.request('GET /user');
            const tokenType = response.headers['x-github-api-version-selected'] || 'classic';
            console.log(`   Token type: ${tokenType}`);
            
        } catch (error) {
            console.error('❌ Failed to get user info:', error.message);
            if (error.status === 401) {
                console.error('   This suggests the token is invalid or expired');
            }
        }
        console.log('');
    }

    async checkRepositoryAccess() {
        console.log('🏢 REPOSITORY ACCESS:');
        console.log('=' .repeat(50));
        
        try {
            const { data: repo } = await this.octokit.rest.repos.get({
                owner: this.owner,
                repo: this.repo
            });
            
            console.log(`✅ Repository: ${repo.full_name}`);
            console.log(`   Private: ${repo.private}`);
            console.log(`   Owner type: ${repo.owner.type}`);
            console.log(`   Your permissions:`);
            console.log(`     admin: ${repo.permissions?.admin}`);
            console.log(`     maintain: ${repo.permissions?.maintain}`);
            console.log(`     push: ${repo.permissions?.push}`);
            console.log(`     triage: ${repo.permissions?.triage}`);
            console.log(`     pull: ${repo.permissions?.pull}`);
            
            // Check if you're the owner
            const { data: user } = await this.octokit.rest.users.getAuthenticated();
            console.log(`   Are you the owner: ${repo.owner.login === user.login}`);
            
        } catch (error) {
            console.error('❌ Failed to get repository info:', error.message);
            if (error.status === 404) {
                console.error('   Repository not found or no access');
            }
        }
        console.log('');
    }

    async checkDetailedPermissions() {
        console.log('🔐 DETAILED PERMISSIONS:');
        console.log('=' .repeat(50));
        
        try {
            // Try to list repository contents
            const { data: contents } = await this.octokit.rest.repos.getContent({
                owner: this.owner,
                repo: this.repo,
                path: ''
            });
            console.log(`✅ Can read repository contents (${contents.length} items)`);
            
            // Try to get a commit (tests read access)
            try {
                const { data: commits } = await this.octokit.rest.repos.listCommits({
                    owner: this.owner,
                    repo: this.repo,
                    per_page: 1
                });
                console.log(`✅ Can read commits (latest: ${commits[0]?.sha?.substring(0, 7)})`);
            } catch (e) {
                console.error(`❌ Cannot read commits: ${e.message}`);
            }
            
        } catch (error) {
            console.error('❌ Failed to check detailed permissions:', error.message);
        }
        console.log('');
    }

    async testWriteOperations() {
        console.log('✍️  WRITE OPERATION TESTS:');
        console.log('=' .repeat(50));
        
        // Test 1: Try to create a simple file
        await this.testCreateFile();
        
        // Test 2: Try to create in a subdirectory
        await this.testCreateFileInDirectory();
        
        // Test 3: Try different API approaches
        await this.testAlternativeWriteMethods();
        
        console.log('');
    }

    async testCreateFile() {
        console.log('📝 Test 1: Create simple file');
        try {
            const testContent = {
                test: true,
                timestamp: new Date().toISOString(),
                message: 'Debug test file'
            };

            const response = await this.octokit.rest.repos.createOrUpdateFileContents({
                owner: this.owner,
                repo: this.repo,
                path: 'debug-test.json',
                message: 'Debug test file creation',
                content: Buffer.from(JSON.stringify(testContent, null, 2)).toString('base64')
            });

            console.log(`   ✅ Successfully created file: ${response.data.commit.sha}`);
            
            // Clean up
            await this.cleanupFile('debug-test.json', response.data.content.sha);
            
        } catch (error) {
            console.error(`   ❌ Failed to create file: ${error.message}`);
            if (error.status === 403) {
                console.error('      This is a permission issue');
            } else if (error.status === 422) {
                console.error('      Validation error - check repository state');
            }
        }
    }

    async testCreateFileInDirectory() {
        console.log('📁 Test 2: Create file in directory');
        try {
            const testContent = { nested: true };

            const response = await this.octokit.rest.repos.createOrUpdateFileContents({
                owner: this.owner,
                repo: this.repo,
                path: 'debug/nested-test.json',
                message: 'Debug nested file creation',
                content: Buffer.from(JSON.stringify(testContent, null, 2)).toString('base64')
            });

            console.log(`   ✅ Successfully created nested file: ${response.data.commit.sha}`);
            
            // Clean up
            await this.cleanupFile('debug/nested-test.json', response.data.content.sha);
            
        } catch (error) {
            console.error(`   ❌ Failed to create nested file: ${error.message}`);
        }
    }

    async testAlternativeWriteMethods() {
        console.log('🔄 Test 3: Alternative write methods');
        
        // Method 1: Try with different API endpoint
        try {
            console.log('   Testing with repos.createFile (if it exists)...');
            // This is actually the same endpoint, but checking anyway
            const response = await this.octokit.request('PUT /repos/{owner}/{repo}/contents/{path}', {
                owner: this.owner,
                repo: this.repo,
                path: 'debug-alt-test.json',
                message: 'Alternative method test',
                content: Buffer.from('{"alt": true}').toString('base64')
            });
            
            console.log(`   ✅ Alternative method worked: ${response.data.commit.sha}`);
            await this.cleanupFile('debug-alt-test.json', response.data.content.sha);
            
        } catch (error) {
            console.error(`   ❌ Alternative method failed: ${error.message}`);
        }
    }

    async cleanupFile(path, sha) {
        try {
            await this.octokit.rest.repos.deleteFile({
                owner: this.owner,
                repo: this.repo,
                path: path,
                message: `Cleanup debug file: ${path}`,
                sha: sha
            });
            console.log(`   🧹 Cleaned up: ${path}`);
        } catch (error) {
            console.log(`   ⚠️  Could not cleanup ${path}: ${error.message}`);
        }
    }

    async checkRepositorySettings() {
        console.log('⚙️  REPOSITORY SETTINGS:');
        console.log('=' .repeat(50));
        
        try {
            const { data: repo } = await this.octokit.rest.repos.get({
                owner: this.owner,
                repo: this.repo
            });
            
            console.log(`   Default branch: ${repo.default_branch}`);
            console.log(`   Has issues: ${repo.has_issues}`);
            console.log(`   Has wiki: ${repo.has_wiki}`);
            console.log(`   Has pages: ${repo.has_pages}`);
            console.log(`   Archived: ${repo.archived}`);
            console.log(`   Disabled: ${repo.disabled}`);
            console.log(`   Allow merge commit: ${repo.allow_merge_commit}`);
            console.log(`   Allow squash merge: ${repo.allow_squash_merge}`);
            console.log(`   Allow rebase merge: ${repo.allow_rebase_merge}`);
            
            // Check branch protection if applicable
            try {
                const { data: protection } = await this.octokit.rest.repos.getBranchProtection({
                    owner: this.owner,
                    repo: this.repo,
                    branch: repo.default_branch
                });
                console.log(`   Branch protection: ENABLED`);
                console.log(`     Required status checks: ${protection.required_status_checks?.strict || false}`);
                console.log(`     Enforce admins: ${protection.enforce_admins?.enabled || false}`);
                console.log(`     Restrict pushes: ${protection.restrictions?.users?.length > 0 || protection.restrictions?.teams?.length > 0}`);
            } catch (protectionError) {
                if (protectionError.status === 404) {
                    console.log(`   Branch protection: DISABLED`);
                } else {
                    console.log(`   Branch protection: ERROR - ${protectionError.message}`);
                }
            }
            
        } catch (error) {
            console.error('❌ Failed to check repository settings:', error.message);
        }
        console.log('');
    }

    // Utility method for quick fixes
    async suggestFixes() {
        console.log('💡 SUGGESTED FIXES:');
        console.log('=' .repeat(50));
        console.log('1. If using fine-grained tokens:');
        console.log('   • Switch to classic personal access token');
        console.log('   • Or ensure fine-grained token has "Contents" write permission');
        console.log('');
        console.log('2. If repository is an organization repo:');
        console.log('   • Check organization third-party access restrictions');
        console.log('   • Verify you have appropriate role in organization');
        console.log('');
        console.log('3. Check token scopes (for classic tokens):');
        console.log('   • repo (full control of private repositories)');
        console.log('   • public_repo (for public repositories only)');
        console.log('');
        console.log('4. Repository-specific issues:');
        console.log('   • Branch protection rules may prevent direct commits');
        console.log('   • Repository may be archived');
        console.log('   • You may not have push access');
        console.log('');
    }
}

// Usage function
async function runDebug() {
    const debug = new GitHubDebugger();
    await debug.comprehensiveDebug();
    await debug.suggestFixes();
}

// Export for use
module.exports = { GitHubDebugger, runDebug };

// If running directly
if (require.main === module) {
    runDebug().catch(console.error);
}