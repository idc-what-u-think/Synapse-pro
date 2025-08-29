require('dotenv').config();
const { Client, GatewayIntentBits, Collection, Routes, EmbedBuilder } = require('discord.js');
const { REST } = require('@discordjs/rest');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const database = require('./src/utils/database');
const github = require('./src/utils/github');

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
            timeout: 10000
        };

        const requestModule = url.protocol === 'https:' ? https : http;
        
        const req = requestModule.request(options, (res) => {
            const now = new Date();
            if (now.getMinutes() === 0) {
                console.log(`Self-ping successful at ${now.toLocaleTimeString()}`);
            }
        });

        req.on('error', () => {
        });

        req.on('timeout', () => {
            req.destroy();
        });

        req.end();
    };

    setTimeout(() => {
        ping();
        setInterval(ping, 10 * 60 * 1000);
    }, 60 * 1000);
};

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

// Enhanced interaction handler with autocomplete support
client.on('interactionCreate', async interaction => {
    // Handle autocomplete interactions (NEW)
    if (interaction.isAutocomplete()) {
        const command = client.commands.get(interaction.commandName);
        
        if (!command) {
            console.error(`No command matching ${interaction.commandName} was found for autocomplete.`);
            return;
        }

        try {
            if (command.autocomplete) {
                await command.autocomplete(interaction);
            }
        } catch (error) {
            console.error('Autocomplete error:', error);
            // Always respond to prevent Discord errors
            try {
                await interaction.respond([]);
            } catch (respondError) {
                console.error('Failed to respond to autocomplete:', respondError);
            }
        }
        return;
    }

    // Handle slash commands
    if (interaction.isChatInputCommand()) {
        const command = client.commands.get(interaction.commandName);
        if (!command) return;

        try {
            await command.execute(interaction);
        } catch (error) {
            console.error(`Command ${interaction.commandName} error:`, error);
            
            const errorMessage = {
                content: '❌ There was an error executing this command!',
                ephemeral: true
            };

            try {
                if (interaction.replied) {
                    await interaction.followUp(errorMessage);
                } else if (interaction.deferred) {
                    await interaction.editReply(errorMessage);
                } else {
                    await interaction.reply(errorMessage);
                }
            } catch (replyError) {
                console.error('Failed to send command error reply:', replyError);
            }
        }
    }
    
    // Handle modal submissions
    else if (interaction.isModalSubmit()) {
        try {
            const customId = interaction.customId;
            
            if (customId === 'login_modal') {
                const loginHandler = require('./src/commands/login');
                await loginHandler.handleLoginModal(interaction);
            } 
            else if (customId.startsWith('device_modal_') || customId === 'device_modal') {
                const sensitivityHandler = require('./src/commands/sensitivity');
                await sensitivityHandler.handleDeviceModal(interaction);
            }
            else {
                console.log(`Unhandled modal: ${customId}`);
            }
        } catch (error) {
            console.error('Modal interaction error:', error);
            
            try {
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({ 
                        content: '❌ There was an error processing this form!', 
                        ephemeral: true 
                    });
                }
            } catch (replyError) {
                console.error('Failed to send modal error reply:', replyError);
            }
        }
    }

    // Handle string select menus
    else if (interaction.isStringSelectMenu()) {
        try {
            const customId = interaction.customId;
            
            // Route sensitivity command interactions
            if (customId.startsWith('game_select') || customId === 'game_select') {
                const sensitivityHandler = require('./src/commands/sensitivity');
                await sensitivityHandler.handleGameSelection(interaction);
            }
            else if (customId.startsWith('finger_select') || customId === 'finger_select') {
                const sensitivityHandler = require('./src/commands/sensitivity');
                await sensitivityHandler.handleFingerSelection(interaction);
            }
            else if (customId.startsWith('playstyle_select') || customId === 'playstyle_select') {
                const sensitivityHandler = require('./src/commands/sensitivity');
                await sensitivityHandler.handlePlaystyleSelection(interaction);
            }
            else if (customId.startsWith('device_final_select') || customId === 'device_final_select') {
                const sensitivityHandler = require('./src/commands/sensitivity');
                await sensitivityHandler.handleDeviceFinalSelection(interaction);
            }
            else {
                console.log(`Unhandled select menu: ${customId}`);
            }
        } catch (error) {
            console.error('Select menu interaction error:', error);
            
            try {
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({ 
                        content: '❌ There was an error processing your selection!', 
                        ephemeral: true 
                    });
                }
            } catch (replyError) {
                console.error('Failed to send select menu error reply:', replyError);
            }
        }
    }
});

client.once('ready', async () => {
    console.log(`Ready! Logged in as ${client.user.tag}`);
    console.log(`Serving ${client.guilds.cache.size} guilds`);
    
    await registerCommands();
    
    client.user.setActivity('slash commands', { type: 'LISTENING' });
    
    startHealthServer();
    startSelfPing();
    
    updateBankMessage();
    setInterval(updateBankMessage, 6 * 60 * 60 * 1000);
});

client.on('error', error => {
    console.error('Discord error:', error);
});

process.on('unhandledRejection', error => {
    console.error('Promise rejection:', error);
});

process.on('SIGINT', () => {
    console.log('Shutting down...');
    client.destroy();
    process.exit(0);
});

async function start() {
    await initialize();
    await client.login(process.env.DISCORD_TOKEN);
}

start().catch(error => {
    console.error('Failed to start:', error);
    process.exit(1);
});
