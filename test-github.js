require('dotenv').config();
const { Octokit } = require('@octokit/rest');

async function testGitHubToken() {
    console.log('Testing GitHub token permissions...\n');
    
    // Check environment variables
    if (!process.env.GITHUB_TOKEN) {
        console.error('❌ GITHUB_TOKEN not found in environment variables');
        return false;
    }
    
    if (!process.env.GITHUB_OWNER) {
        console.error('❌ GITHUB_OWNER not found in environment variables');
        return false;
    }
    
    if (!process.env.GITHUB_REPO) {
        console.error('❌ GITHUB_REPO not found in environment variables');
        return false;
    }
    
    console.log('✅ Environment variables found');
    console.log(`   Token: ${process.env.GITHUB_TOKEN.substring(0, 10)}...`);
    console.log(`   Owner: ${process.env.GITHUB_OWNER}`);
    console.log(`   Repo: ${process.env.GITHUB_REPO}\n`);
    
    const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
    
    try {
        // Test 1: Check user authentication
        console.log('Test 1: Checking user authentication...');
        const { data: user } = await octokit.rest.users.getAuthenticated();
        console.log(`✅ Authenticated as: ${user.login}`);
        console.log(`   Account type: ${user.type}`);
        console.log(`   Profile: ${user.html_url}\n`);
        
        // Test 2: Check repository access
        console.log('Test 2: Checking repository access...');
        const { data: repo } = await octokit.rest.repos.get({
            owner: process.env.GITHUB_OWNER,
            repo: process.env.GITHUB_REPO
        });
        console.log(`✅ Repository found: ${repo.full_name}`);
        console.log(`   Private: ${repo.private}`);
        console.log(`   Owner: ${repo.owner.login}`);
        console.log(`   Permissions:`);
        console.log(`     - admin: ${repo.permissions?.admin || 'undefined'}`);
        console.log(`     - push: ${repo.permissions?.push || 'undefined'}`);
        console.log(`     - pull: ${repo.permissions?.pull || 'undefined'}\n`);
        
        // Test 3: Check token type and permissions
        console.log('Test 3: Checking token type and permissions...');
        const response = await octokit.rest.users.getAuthenticated();
        const scopes = response.headers['x-oauth-scopes'];
        const tokenType = process.env.GITHUB_TOKEN.startsWith('github_pat_') ? 'Fine-grained' : 'Classic';
        console.log(`✅ Token type: ${tokenType}`);
        console.log(`✅ Token scopes: ${scopes || 'Fine-grained token (no scopes header)'}\n`);
        
        // Test 4: Try to create a test file
        console.log('Test 4: Testing write permissions...');
        const testFileName = 'test-permissions.json';
        const testContent = {
            test: true,
            timestamp: new Date().toISOString(),
            message: 'This file was created to test GitHub API permissions'
        };
        
        try {
            await octokit.rest.repos.createOrUpdateFileContents({
                owner: process.env.GITHUB_OWNER,
                repo: process.env.GITHUB_REPO,
                path: testFileName,
                message: 'Test file - can be deleted',
                content: Buffer.from(JSON.stringify(testContent, null, 2)).toString('base64')
            });
            console.log(`✅ Successfully created test file: ${testFileName}`);
            
            // Try to read it back
            const { data: fileData } = await octokit.rest.repos.getContent({
                owner: process.env.GITHUB_OWNER,
                repo: process.env.GITHUB_REPO,
                path: testFileName
            });
            console.log(`✅ Successfully read test file`);
            
            // Clean up - delete the test file
            await octokit.rest.repos.deleteFile({
                owner: process.env.GITHUB_OWNER,
                repo: process.env.GITHUB_REPO,
                path: testFileName,
                message: 'Clean up test file',
                sha: fileData.sha
            });
            console.log(`✅ Successfully deleted test file\n`);
            
        } catch (writeError) {
            console.error(`❌ Write test failed: ${writeError.message}`);
            console.error(`   Status: ${writeError.status}`);
            if (writeError.status === 403) {
                console.error('   This indicates insufficient permissions!');
                console.error('   For fine-grained tokens: Check Contents permission is "Read and write"');
                console.error('   For classic tokens: Check "repo" scope is selected');
            }
            return false;
        }
        
        console.log('🎉 All tests passed! Your GitHub token is properly configured.\n');
        return true;
        
    } catch (error) {
        console.error(`❌ Test failed: ${error.message}`);
        console.error(`   Status: ${error.status}`);
        
        if (error.status === 401) {
            console.error('   This indicates invalid or expired token!');
        } else if (error.status === 404) {
            console.error('   This indicates repository not found or no access!');
            console.error('   Make sure the repository exists and is selected in your token permissions');
        } else if (error.status === 403) {
            console.error('   This indicates insufficient permissions!');
            console.error('   For fine-grained tokens: Ensure Contents permission is "Read and write"');
            console.error('   For classic tokens: Ensure "repo" scope is selected');
        }
        
        return false;
    }
}

// Run the test
testGitHubToken().then(success => {
    if (success) {
        console.log('✅ GitHub token test completed successfully!');
        console.log('You can now run your bot with confidence!');
        process.exit(0);
    } else {
        console.log('❌ GitHub token test failed!');
        console.log('\nTroubleshooting steps:');
        console.log('1. For fine-grained tokens:');
        console.log('   - Ensure repository is selected');
        console.log('   - Set Contents permission to "Read and write"');
        console.log('2. For classic tokens:');
        console.log('   - Ensure "repo" scope is selected');
        console.log('3. Update your .env file with the correct token');
        console.log('4. Restart your application');
        process.exit(1);
    }
}).catch(error => {
    console.error('Test script error:', error);
    process.exit(1);
});