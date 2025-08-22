require('dotenv').config();
const { Client, GatewayIntentBits, Collection } = require('discord.js');
const fs = require('fs');
const path = require('path');
const database = require('./src/utils/database');
const { testPermissions } = require('./src/utils/github');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildPresences,
        GatewayIntentBits.MessageContent
    ]
});

client.commands = new Collection();
const commandsPath = path.join(__dirname, 'src/commands');
const eventPath = path.join(__dirname, 'src/events');

// Initialize the bot
async function initialize() {
    console.log('Starting initialization...');
    
    try {
        // Test GitHub permissions first
        console.log('\nTesting GitHub permissions...');
        const permissionsOk = await testPermissions();
        if (!permissionsOk) {
            console.error('\nGitHub setup instructions:');
            console.error('1. Go to https://github.com/settings/tokens');
            console.error('2. Click "Generate new token (classic)"');
            console.error('3. Select "repo" scope');
            console.error('4. Copy token and update GITHUB_TOKEN in .env');
            process.exit(1);
        }
        console.log('✓ GitHub permissions verified!\n');
        
        // Initialize database
        console.log('Initializing database...');
        const dbInitialized = await database.init();
        if (!dbInitialized) {
            console.error('Database initialization failed!');
            process.exit(1);
        }
        console.log('Database initialization successful!');
        
    } catch (error) {
        console.error('Initialization failed:', error);
        process.exit(1);
    }
}

// Load commands
console.log('Loading commands...');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
for (const file of commandFiles) {
    try {
        const command = require(path.join(commandsPath, file));
        client.commands.set(command.data.name, command);
        console.log(`Loaded command: ${command.data.name}`);
    } catch (error) {
        console.error(`Error loading command ${file}:`, error);
    }
}

// Load events
console.log('Loading events...');
const eventFiles = fs.readdirSync(eventPath).filter(file => file.endsWith('.js'));
for (const file of eventFiles) {
    try {
        const event = require(path.join(eventPath, file));
        if (event.once) {
            client.once(event.name, (...args) => event.execute(...args, client));
        } else {
            client.on(event.name, (...args) => event.execute(...args, client));
        }
        console.log(`Loaded event: ${event.name}`);
    } catch (error) {
        console.error(`Error loading event ${file}:`, error);
    }
}

// Handle interactions
client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand()) return;

    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    try {
        console.log(`Executing command: ${interaction.commandName} by ${interaction.user.tag} in ${interaction.guild?.name || 'DM'}`);
        
        // Check if command uses old or new parameter system
        // Old commands expect (interaction, octokit, owner, repo)
        // New commands expect just (interaction)
        if (command.execute.length > 1) {
            // Old command - pass the database parameters
            await command.execute(interaction, database.octokit, database.owner, database.repo);
        } else {
            // New command - pass only interaction
            await command.execute(interaction);
        }
        
        console.log(`Command executed successfully: ${interaction.commandName}`);
    } catch (error) {
        console.error(`Error executing command ${interaction.commandName}:`, error);
        const errorMessage = {
            content: 'There was an error executing this command!',
            ephemeral: true
        };
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp(errorMessage);
        } else {
            await interaction.reply(errorMessage);
        }
    }
});

// Bot ready event
client.once('ready', async () => {
    console.log('Bot logged in successfully!');
    console.log(`Ready! Logged in as ${client.user.tag}`);
    console.log(`Serving ${client.guilds.cache.size} guilds`);
    console.log(`Loaded ${client.commands.size} commands`);
    
    // Set bot status
    client.user.setActivity('slash commands', { type: 'LISTENING' });
});

// Error handling
client.on('error', error => {
    console.error('Discord client error:', error);
});

process.on('unhandledRejection', error => {
    console.error('Unhandled promise rejection:', error);
});

process.on('uncaughtException', error => {
    console.error('Uncaught exception:', error);
    process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('Received SIGINT, shutting down gracefully...');
    client.destroy();
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('Received SIGTERM, shutting down gracefully...');
    client.destroy();
    process.exit(0);
});

// Start the bot
async function start() {
    await initialize();
    await client.login(process.env.DISCORD_TOKEN);
}

start().catch(error => {
    console.error('Failed to start bot:', error);
    process.exit(1);
});