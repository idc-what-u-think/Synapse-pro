const { Events } = require('discord.js');
const { getConfig } = require('../utils/github');

module.exports = {
    name: Events.GuildMemberAdd,
    async execute(member, client) {
        try {
            console.log(`New member joined: ${member.user.tag} in ${member.guild.name}`);
            
            // Get welcome configuration
            const config = await getConfig();
            const guildConfig = config?.guilds?.[member.guild.id];
            const welcomeConfig = guildConfig?.welcome;

            // Check if welcome system is enabled
            if (!welcomeConfig?.enabled || !welcomeConfig.channel) {
                console.log(`Welcome system not configured for ${member.guild.name}`);
                return;
            }

            // Get welcome channel
            const welcomeChannel = member.guild.channels.cache.get(welcomeConfig.channel);
            if (!welcomeChannel) {
                console.log(`Welcome channel not found for ${member.guild.name}`);
                return;
            }

            // Check bot permissions
            const botMember = member.guild.members.cache.get(client.user.id);
            if (!welcomeChannel.permissionsFor(botMember).has(['SendMessages', 'EmbedLinks'])) {
                console.error(`Missing permissions to send welcome message in #${welcomeChannel.name}`);
                return;
            }

            // Get the welcome command to use its sendWelcomeMessage function
            const welcomeCommand = client.commands.get('welcome');
            if (welcomeCommand && typeof welcomeCommand.sendWelcomeMessage === 'function') {
                await welcomeCommand.sendWelcomeMessage(member, member.guild, welcomeConfig, welcomeChannel);
            } else {
                console.error('Welcome command not found or sendWelcomeMessage function missing');
            }

        } catch (error) {
            console.error('Error in guildMemberAdd event:', error);
        }
    },
};