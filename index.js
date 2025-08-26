require('dotenv').config();
const { Client, GatewayIntentBits, Collection, Routes, EmbedBuilder } = require('discord.js');
const { REST } = require('@discordjs/rest');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const database = require('./src/utils/database');
const github = require('./src/utils/github');

// Port configuration
const PORT = process.env.PORT || 3000;

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

// Bank auto-update function
async function updateBankMessage() {
    try {
        const bankChannelId = process.env.BANK_CHANNEL_ID;
        if (!bankChannelId) return;

        const bankChannel = client.channels.cache.get(bankChannelId);
        if (!bankChannel) return;

        const bankData = await github.getBankData();
        const balance = bankData.balance || 10000000;

        const embed = new EmbedBuilder()
            .setColor(0x00FF00)
            .setTitle('Firekid Project Server Trust Fund')
            .setDescription(`Balance: **${balance.toLocaleString()}** coins`)
            .setFooter({ text: 'funded by firekid' })
            .setTimestamp();

        // Try to find and update existing message, or send new one
        try {
            const messages = await bankChannel.messages.fetch({ limit: 10 });
            const bankMessage = messages.find(msg => 
                msg.author.id === client.user.id && 
                msg.embeds.length > 0 && 
                msg.embeds[0].title === 'Firekid Project Server Trust Fund'
            );

            if (bankMessage) {
                await bankMessage.edit({ embeds: [embed] });
            } else {
                await bankChannel.send({ embeds: [embed] });
            }
        } catch (error) {
            console.error('Error updating bank message:', error);
        }
    } catch (error) {
        console.error('Error in updateBankMessage:', error);
    }
}

// Improved self-ping function
const startSelfPing = () => {
    const RENDER_URL = process.env.RENDER_EXTERNAL_URL;
    if (!RENDER_URL) {
        console.log('No RENDER_EXTERNAL_URL found, skipping self-ping');
        return;
    }
    
    const ping = () => {
        const url = new URL(RENDER_URL);
        const options = {
            hostname: url.hostname,
            port: url.port || (url.protocol === 'https:' ? 443 : 80),
            path: url.pathname || '/',
            method: 'GET',
            timeout: 10000 // Reduced timeout to 10 seconds
        };

        const requestModule = url.protocol === 'https:' ? https : http;
        
        const req = requestModule.request(options, (res) => {
            // Only log once every hour to reduce spam
            const now = new Date();
            if (now.getMinutes() === 0) {
                console.log(`Self-ping successful at ${now.toLocaleTimeString()}`);
            }
        });

        req.on('error', () => {
            // Silently fail, no need to spam logs
        });

        req.on('timeout', () => {
            req.destroy();
        });

        req.end();
    };

    // Start pinging after 1 minute, then every 10 minutes
    setTimeout(() => {
        ping();
        setInterval(ping, 10 * 60 * 1000);
    }, 60 * 1000);
};

// Simple HTTP server
const startHealthServer = () => {
    const server = http.createServer((req, res) => {
        if (req.url === '/' || req.url === '/health') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                status: 'ok',
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),
                bot: client.user ? `${client.user.tag}` : 'Not logged in'
            }));
        } else {
            res.writeHead(404);
            res.end('Not Found');
        }
    });

    server.listen(PORT, () => {
        console.log(`Health server listening on port ${PORT}`);
    });
};

// Initialize the bot
async function initialize() {
    try {
        const permissionsOk = await github.testPermissions();
        if (!permissionsOk) {
            console.error('GitHub setup required - check your token permissions');
            process.exit(1);
        }
        
        if (database && typeof database === 'object') {
            console.log('Database module loaded');
        } else {
            console.error('Database module not loaded');
            process.exit(1);
        }
        
    } catch (error) {
        console.error('Initialization failed:', error);
        process.exit(1);
    }
}

// Load commands
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
const commands = [];

for (const file of commandFiles) {
    try {
        const command = require(path.join(commandsPath, file));
        client.commands.set(command.data.name, command);
        commands.push(command.data.toJSON());
        console.log(`Loaded: ${command.data.name}`);
    } catch (error) {
        console.error(`Error loading ${file}:`, error.message);
    }
}

// Register commands
async function registerCommands() {
    const clientId = process.env.CLIENT_ID || process.env.DISCORD_CLIENT_ID;
    
    if (!process.env.DISCORD_TOKEN || !clientId) {
        console.error('Missing DISCORD_TOKEN or CLIENT_ID');
        return false;
    }

    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

    try {
        await rest.put(
            Routes.applicationCommands(clientId),
            { body: commands }
        );
        
        console.log(`Registered ${commands.length} slash commands`);
        return true;
    } catch (error) {
        console.error('Failed to register commands:', error.message);
        return false;
    }
}

// Load events
const eventFiles = fs.readdirSync(eventPath).filter(file => file.endsWith('.js'));
for (const file of eventFiles) {
    try {
        const event = require(path.join(eventPath, file));
        if (event.once) {
            client.once(event.name, (...args) => event.execute(...args, client));
        } else {
            client.on(event.name, (...args) => event.execute(...args, client));
        }
    } catch (error) {
        console.error(`Error loading event ${file}:`, error.message);
    }
}

// Handle interactions
client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand()) return;

    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    try {
        await command.execute(interaction);
    } catch (error) {
        console.error(`Command ${interaction.commandName} error:`, error.message);
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
    console.log(`Ready! Logged in as ${client.user.tag}`);
    console.log(`Serving ${client.guilds.cache.size} guilds`);
    
    await registerCommands();
    
    client.user.setActivity('slash commands', { type: 'LISTENING' });
    
    startHealthServer();
    startSelfPing();
    
    // Start bank auto-update every 6 hours
    updateBankMessage(); // Initial update
    setInterval(updateBankMessage, 6 * 60 * 60 * 1000); // Every 6 hours
});

// Error handling
client.on('error', error => {
    console.error('Discord error:', error.message);
});

process.on('unhandledRejection', error => {
    console.error('Promise rejection:', error.message);
});

process.on('SIGINT', () => {
    console.log('Shutting down...');
    client.destroy();
    process.exit(0);
});

// Start the bot
async function start() {
    await initialize();
    await client.login(process.env.DISCORD_TOKEN);
}

start().catch(error => {
    console.error('Failed to start:', error);
    process.exit(1);
});
