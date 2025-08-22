require('dotenv').config();
const { Client, GatewayIntentBits, Collection } = require('discord.js');
const fs = require('fs');
const path = require('path');
const database = require('./utils/database');

console.log('Starting initialization...');

// Initialize database first
const startBot = async () => {
    console.log('Initializing database...');
    
    try {
        const dbInitialized = await database.init();
        if (!dbInitialized) {
            console.error('Failed to initialize database. Bot cannot start.');
            process.exit(1);
        }
        console.log('Database initialization successful!');
        
        // Create client after database is ready
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
        const commandsPath = path.join(__dirname, 'commands');
        const eventPath = path.join(__dirname, 'events');

        // Load commands
        const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
        for (const file of commandFiles) {
            const command = require(path.join(commandsPath, file));
            client.commands.set(command.data.name, command);
        }

        // Load events
        const eventFiles = fs.readdirSync(eventPath).filter(file => file.endsWith('.js'));
        for (const file of eventFiles) {
            const event = require(path.join(eventPath, file));
            if (event.once) {
                client.once(event.name, (...args) => event.execute(...args, client, database.octokit, database.owner, database.repo));
            } else {
                client.on(event.name, (...args) => event.execute(...args, client, database.octokit, database.owner, database.repo));
            }
        }

        client.on('interactionCreate', async interaction => {
            if (!interaction.isCommand()) return;

            const command = client.commands.get(interaction.commandName);
            if (!command) return;

            try {
                await command.execute(interaction, database.octokit, database.owner, database.repo);
            } catch (error) {
                console.error('Command execution error:', error);
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

        // Add error handling
        client.on('error', error => {
            console.error('Discord client error:', error);
        });

        process.on('unhandledRejection', error => {
            console.error('Unhandled promise rejection:', error);
        });

        // Login after everything is ready
        await client.login(process.env.DISCORD_TOKEN);
        console.log('Bot logged in successfully!');
    } catch (error) {
        console.error('Startup error:', error);
        process.exit(1);
    }
};

startBot();
