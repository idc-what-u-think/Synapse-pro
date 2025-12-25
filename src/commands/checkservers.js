const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getData } = require('../utils/github');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('checkservers')
        .setDescription('List all servers and their whitelist status (Owner only)'),
    
    async execute(interaction) {
        const ownerId = process.env.OWNER_ID;
        
        if (interaction.user.id !== ownerId) {
            return await interaction.reply({ 
                content: '❌ Owner only command!', 
                ephemeral: true 
            });
        }

        await interaction.deferReply({ ephemeral: true });

        try {
            let whitelist = [];
            try {
                const data = await getData('whitelist.json');
                whitelist = data.servers || [];
            } catch (error) {
                whitelist = [];
            }

            const allServers = interaction.client.guilds.cache;
            
            if (allServers.size === 0) {
                return await interaction.editReply({ content: '📋 Bot is not in any servers!' });
            }

            const whitelistedServers = [];
            const nonWhitelistedServers = [];

            for (const [guildId, guild] of allServers) {
                const serverInfo = `• **${guild.name}**\n  ID: \`${guildId}\`\n  Members: ${guild.memberCount}\n  Owner: <@${guild.ownerId}>`;
                
                if (whitelist.includes(guildId)) {
                    whitelistedServers.push(serverInfo);
                } else {
                    nonWhitelistedServers.push(serverInfo);
                }
            }

            const embed = new EmbedBuilder()
                .setTitle('🌐 Server Status Report')
                .setColor(0x3498DB)
                .setFooter({ text: `Total: ${allServers.size} servers | Whitelisted: ${whitelistedServers.length} | Non-Whitelisted: ${nonWhitelistedServers.length}` })
                .setTimestamp();

            if (whitelistedServers.length > 0) {
                embed.addFields({ 
                    name: '✅ Whitelisted Servers', 
                    value: whitelistedServers.join('\n\n').substring(0, 1024) 
                });
            }

            if (nonWhitelistedServers.length > 0) {
                embed.addFields({ 
                    name: '⚠️ Non-Whitelisted Servers (Will be removed on restart/leaveall)', 
                    value: nonWhitelistedServers.join('\n\n').substring(0, 1024) 
                });
            }

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('Check servers error:', error);
            await interaction.editReply({ 
                content: '❌ An error occurred while checking servers.' 
            });
        }
    },
};
