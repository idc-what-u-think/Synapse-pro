require('dotenv').config();
const { Client, GatewayIntentBits, Collection, Routes, EmbedBuilder } = require('discord.js');
const { REST } = require('@discordjs/rest');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const database = require('./src/utils/database');
const github = require('./src/utils/github');
const roomHandler = require('./src/utils/roomHandler');

const PORT = process.env.PORT || 3000;
const ALLOWED_SERVER_ID = process.env.SERVER_ID;

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildPresences,
        GatewayIntentBits.GuildInvites,
        GatewayIntentBits.MessageContent
    ]
});

client.commands = new Collection();
const commandsPath = path.join(__dirname, 'src/commands');
const eventPath = path.join(__dirname, 'src/events');

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

        req.on('error', () => {});
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

async function checkReminders() {
    try {
        const data = await github.getData('data/reminders.json');
        if (!data || !Array.isArray(data.reminders) || data.reminders.length === 0) {
            return;
        }

        const now = Date.now();
        const dueReminders = data.reminders.filter(r => r.reminderTime <= now);
        
        if (dueReminders.length === 0) return;

        for (const reminder of dueReminders) {
            try {
                const channel = await client.channels.fetch(reminder.channelId);
                const user = await client.users.fetch(reminder.userId);

                const embed = new EmbedBuilder()
                    .setTitle('⏰ Reminder!')
                    .setDescription(reminder.message)
                    .setColor(0xFFAA00)
                    .setFooter({ text: `Set ${new Date(reminder.setAt).toLocaleString()}` })
                    .setTimestamp();

                await channel.send({ content: `${user}`, embeds: [embed] });
                console.log(`Sent reminder to ${user.tag}`);
            } catch (error) {
                console.error('Error sending reminder:', error);
            }
        }

        data.reminders = data.reminders.filter(r => r.reminderTime > now);
        await github.saveData('data/reminders.json', data, 'Processed reminders');

    } catch (error) {
        console.error('Error checking reminders:', error);
    }
}

async function initializeGameData() {
    try {
        console.log('Checking game data initialization...');
        
        let rewards = await github.getGameRewards();
        if (!rewards || Object.keys(rewards).length === 0) {
            console.log('Initializing default game rewards...');
            rewards = {
                typing_race_round: { coins: 50, bucks: 0 },
                wyr_winner: { coins: 300, bucks: 2 },
                reaction_winner: { coins: 100, bucks: 1 }
            };
            await github.saveGameRewards(rewards);
            console.log('✅ Game rewards initialized');
        } else {
            console.log('✅ Game rewards already exist');
        }
        
        let wyr = await github.getWYRQuestions();
        if (!wyr || !wyr.questions || wyr.questions.length === 0) {
            console.log('Initializing default WYR questions...');
            wyr = {
                questions: [
                    { optionA: "Have the ability to fly", optionB: "Have the ability to turn invisible" },
                    { optionA: "Live in a mansion in the city", optionB: "Live in a cabin in the woods" },
                    { optionA: "Always be 10 minutes late", optionB: "Always be 20 minutes early" },
                    { optionA: "Have unlimited money", optionB: "Have unlimited time" },
                    { optionA: "Never use social media again", optionB: "Never watch another movie or TV show" }
                ]
            };
            await github.saveWYRQuestions(wyr);
            console.log('✅ WYR questions initialized');
        } else {
            console.log('✅ WYR questions already exist');
        }
        
        console.log('✅ Game data initialization complete!');
    } catch (error) {
        console.error('Error initializing game data:', error);
    }
}

async function cacheServerInvites() {
    try {
        console.log('Caching server invites...');
        client.inviteCache = new Map();
        
        for (const guild of client.guilds.cache.values()) {
            try {
                const invites = await guild.invites.fetch();
                const inviteMap = new Map();
                invites.forEach(invite => {
                    inviteMap.set(invite.code, { 
                        uses: invite.uses, 
                        inviterId: invite.inviter?.id 
                    });
                });
                client.inviteCache.set(guild.id, inviteMap);
                console.log(`✅ Cached ${invites.size} invites for ${guild.name}`);
            } catch (error) {
                console.error(`Could not cache invites for ${guild.name}:`, error.message);
            }
        }
        
        console.log('✅ Invite cache initialized');
    } catch (error) {
        console.error('Error caching invites:', error);
    }
}

async function initialize() {
    try {
        if (!ALLOWED_SERVER_ID) {
            console.error('SERVER_ID not set in environment variables!');
            console.error('Please add SERVER_ID=your_server_id to your .env file');
            process.exit(1);
        }
        
        console.log(`Bot restricted to server ID: ${ALLOWED_SERVER_ID}`);
        
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

client.on('interactionCreate', async interaction => {
    if (!interaction.guild || interaction.guild.id !== ALLOWED_SERVER_ID) {
        return;
    }

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
            try {
                await interaction.respond([]);
            } catch (respondError) {
                console.error('Failed to respond to autocomplete:', respondError);
            }
        }
        return;
    }

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
    
    else if (interaction.isButton()) {
        try {
            const customId = interaction.customId;
            
            if (customId === 'buy_roomcard') {
                const shopHandler = require('./src/commands/shop');
                await shopHandler.handlePurchase(interaction, 'roomcard');
            }
            
            else if (customId === 'giveaway_setup_btn') {
                const giveawayHandler = require('./src/commands/giveaway');
                await giveawayHandler.handleSetupButton(interaction);
            }
            else if (customId.startsWith('giveaway_participate_')) {
                const giveawayId = customId.replace('giveaway_participate_', '');
                const giveawayHandler = require('./src/commands/giveaway');
                await giveawayHandler.handleParticipate(interaction, giveawayId);
            }
            
            else if (customId.startsWith('room_join_')) {
                const roomId = customId.replace('room_join_', '');
                await roomHandler.handleJoinRoom(interaction, roomId);
            }
            else if (customId.startsWith('room_leave_')) {
                const roomId = customId.replace('room_leave_', '');
                await roomHandler.handleLeaveRoom(interaction, roomId);
            }
            else if (customId.startsWith('room_kick_')) {
                const roomId = customId.replace('room_kick_', '');
                await roomHandler.handleKickPlayer(interaction, roomId);
            }
            else if (customId.startsWith('room_settings_')) {
                const roomId = customId.replace('room_settings_', '');
                await roomHandler.handleRoomSettings(interaction, roomId);
            }
            else if (customId.startsWith('room_change_password_')) {
                const roomId = customId.replace('room_change_password_', '');
                await roomHandler.handleChangePassword(interaction, roomId);
            }
            else if (customId.startsWith('room_remove_password_')) {
                const roomId = customId.replace('room_remove_password_', '');
                await roomHandler.handleRemovePassword(interaction, roomId);
            }
            else if (customId.startsWith('room_cancel_')) {
                const roomId = customId.replace('room_cancel_', '');
                await roomHandler.handleCancelRoom(interaction, roomId);
            }
            else if (customId.startsWith('room_start_')) {
                const roomId = customId.replace('room_start_', '');
                await roomHandler.handleStartGame(interaction, roomId);
            }
            else if (customId.startsWith('room_add_password_')) {
                const gameId = customId.replace('room_add_password_', '');
                const useCommand = require('./src/commands/use');
                await useCommand.handlePasswordButton(interaction, gameId, true);
            }
            else if (customId.startsWith('room_no_password_')) {
                const gameId = customId.replace('room_no_password_', '');
                const useCommand = require('./src/commands/use');
                await useCommand.handlePasswordButton(interaction, gameId, false);
            }
            
            else if (customId.startsWith('typing_config_')) {
                const roomId = customId.replace('typing_config_', '');
                const typingRace = require('./src/games/typingrace');
                await typingRace.handleConfig(interaction, roomId);
            }
            
            else {
                console.log(`Unhandled button: ${customId}`);
            }
        } catch (error) {
            console.error('Button interaction error:', error);
            
            try {
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({ 
                        content: '❌ There was an error processing this button!', 
                        ephemeral: true 
                    });
                }
            } catch (replyError) {
                console.error('Failed to send button error reply:', replyError);
            }
        }
    }
    
    else if (interaction.isStringSelectMenu()) {
        try {
            const customId = interaction.customId;
            
            if (customId.startsWith('room_kick_select_')) {
                const roomId = customId.replace('room_kick_select_', '');
                await roomHandler.handleKickSelect(interaction, roomId);
            }
            else if (customId === 'select_game') {
                const useCommand = require('./src/commands/use');
                await useCommand.handleGameSelection(interaction);
            }
            else {
                console.log(`Unhandled select menu: ${customId}`);
            }
        } catch (error) {
            console.error('Select menu interaction error:', error);
            
            try {
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({ 
                        content: '❌ There was an error processing this selection!', 
                        ephemeral: true 
                    });
                }
            } catch (replyError) {
                console.error('Failed to send select menu error reply:', replyError);
            }
        }
    }
    
    else if (interaction.isModalSubmit()) {
        try {
            const customId = interaction.customId;
            
            if (customId === 'login_modal') {
                const loginHandler = require('./src/commands/login');
                await loginHandler.handleLoginModal(interaction);
            } 
            else if (customId === 'giveaway_setup_modal') {
                const giveawayHandler = require('./src/commands/giveaway');
                await giveawayHandler.handleSetupModal(interaction);
            }
            
            else if (customId.startsWith('room_password_verify_')) {
                const roomId = customId.replace('room_password_verify_', '');
                await roomHandler.handleVerifyPassword(interaction, roomId);
            }
            else if (customId.startsWith('room_new_password_')) {
                const roomId = customId.replace('room_new_password_', '');
                await roomHandler.handleNewPassword(interaction, roomId);
            }
            else if (customId.startsWith('room_password_modal_')) {
                const gameId = customId.replace('room_password_modal_', '');
                const useCommand = require('./src/commands/use');
                await useCommand.handlePasswordModal(interaction, gameId);
            }
            
            else if (customId.startsWith('typing_rounds_')) {
                const roomId = customId.replace('typing_rounds_', '');
                const typingRace = require('./src/games/typingrace');
                await typingRace.handleRoundsModal(interaction, roomId);
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
});

client.once('ready', async () => {
    console.log(`Ready! Logged in as ${client.user.tag}`);
    console.log(`Serving ${client.guilds.cache.size} guilds`);
    console.log(`✅ Bot restricted to server ID: ${ALLOWED_SERVER_ID}`);
    
    await registerCommands();
    await initializeGameData();
    await cacheServerInvites();
    
    client.user.setActivity('slash commands', { type: 'LISTENING' });
    
    startHealthServer();
    startSelfPing();
    
    setInterval(() => checkReminders(), 60000);
    console.log('Reminder checker started (every 60 seconds)');
});

client.on('inviteCreate', async (invite) => {
    try {
        if (!client.inviteCache) {
            client.inviteCache = new Map();
        }
        
        const guildInvites = client.inviteCache.get(invite.guild.id) || new Map();
        guildInvites.set(invite.code, { 
            uses: invite.uses, 
            inviterId: invite.inviter?.id 
        });
        client.inviteCache.set(invite.guild.id, guildInvites);
    } catch (error) {
        console.error('Error updating invite cache on create:', error);
    }
});

client.on('inviteDelete', async (invite) => {
    try {
        if (!client.inviteCache) return;
        
        const guildInvites = client.inviteCache.get(invite.guild.id);
        if (guildInvites) {
            guildInvites.delete(invite.code);
        }
    } catch (error) {
        console.error('Error updating invite cache on delete:', error);
    }
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
