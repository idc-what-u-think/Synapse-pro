require('dotenv').config();
const { Client, GatewayIntentBits, Collection, Routes } = require('discord.js');
const { REST } = require('@discordjs/rest');
const fs = require('fs');
const path = require('path');
const database = require('./src/utils/database');
const github = require('./src/utils/github'); // Fixed: Import entire module

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
        const permissionsOk = await github.testPermissions();
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
        
        // Simply test if database module is accessible
        if (database && typeof database === 'object') {
            console.log('✓ Database module loaded successfully');
            
            // If your database has specific initialization requirements,
            // add them here. For now, just verify it's loaded.
            if (database.octokit) {
                console.log('✓ Database has octokit instance');
            }
            if (database.owner && database.repo) {
                console.log(`✓ Database configured for ${database.owner}/${database.repo}`);
            }
        } else {
            console.error('Database module not properly loaded!');
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
const commands = [];

for (const file of commandFiles) {
    try {
        const command = require(path.join(commandsPath, file));
        client.commands.set(command.data.name, command);
        commands.push(command.data.toJSON());
        console.log(`Loaded command: ${command.data.name}`);
    } catch (error) {
        console.error(`Error loading command ${file}:`, error);
    }
}

// Auto-register slash commands
async function registerCommands() {
    const clientId = process.env.CLIENT_ID || process.env.DISCORD_CLIENT_ID;
    
    if (!process.env.DISCORD_TOKEN || !clientId) {
        console.error('Missing DISCORD_TOKEN or CLIENT_ID/DISCORD_CLIENT_ID in .env file');
        console.error('Your CLIENT_ID should be: DISCORD_CLIENT_ID=1408214555418427393 (already set)');
        return false;
    }

    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

    try {
        console.log(`\nRegistering ${commands.length} slash commands...`);
        
        // Register commands globally
        await rest.put(
            Routes.applicationCommands(clientId),
            { body: commands }
        );
        
        console.log('✓ Successfully registered global slash commands!');
        return true;
    } catch (error) {
        console.error('Failed to register slash commands:', error);
        
        // Provide helpful error messages
        if (error.code === 50001) {
            console.error('Bot is missing access. Make sure the bot is invited with the applications.commands scope.');
        } else if (error.code === 10002) {
            console.error('Invalid CLIENT_ID. Check your CLIENT_ID in the .env file.');
        } else if (error.status === 401) {
            console.error('Invalid DISCORD_TOKEN. Check your token in the .env file.');
        }
        
        return false;
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
        
        // All commands now use the new single-parameter system
        await command.execute(interaction);
        
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
    
    // Auto-register commands on startup
    console.log('\nChecking slash command registration...');
    const registered = await registerCommands();
    if (!registered) {
        console.log('⚠️  Command registration failed, but bot will continue running');
        console.log('Commands may not work properly until registration succeeds');
    }
    
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
