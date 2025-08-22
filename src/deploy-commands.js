require('dotenv').config();
const { REST, Routes } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');

console.log('Started refreshing application (/) commands.');

const commands = [];
const commandsPath = path.join(__dirname, 'commands');

try {
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
    console.log(`Found ${commandFiles.length} command files:`, commandFiles);

    for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file);
        const command = require(filePath);
        
        if ('data' in command && 'execute' in command) {
            commands.push(command.data.toJSON());
            console.log(`Loaded command: ${command.data.name}`);
        } else {
            console.log(`Warning: Command at ${filePath} missing required properties`);
        }
    }
} catch (error) {
    console.error('Error loading commands:', error);
    process.exit(1);
}

const rest = new REST().setToken(process.env.DISCORD_TOKEN);

(async () => {
    try {
        console.log(`Registering ${commands.length} commands to guild ${process.env.GUILD_ID}`);

        // Register commands to specific guild for development
        const data = await rest.put(
            Routes.applicationGuildCommands(
                process.env.DISCORD_CLIENT_ID,
                process.env.GUILD_ID
            ),
            { body: commands }
        );

        console.log(`Successfully registered ${data.length} commands`);
        console.log('Commands:', data.map(cmd => cmd.name).join(', '));
    } catch (error) {
        console.error('Error registering commands:', error);
    }
})();
