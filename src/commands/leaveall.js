const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getData } = require('../utils/github');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('leaveall')
        .setDescription('Leave all non-whitelisted servers (Owner only)'),
    
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
            const serversToLeave = [];

            for (const [guildId, guild] of allServers) {
                if (!whitelist.includes(guildId)) {
                    serversToLeave.push({ id: guildId, name: guild.name, members: guild.memberCount });
                }
            }

            if (serversToLeave.length === 0) {
                return await interaction.editReply({ 
                    content: '✅ All current servers are whitelisted! No servers to leave.' 
                });
            }

            const embed = new EmbedBuilder()
                .setTitle('👋 Leaving Non-Whitelisted Servers')
                .setDescription(`Found **${serversToLeave.length}** non-whitelisted server(s). Leaving now...`)
                .addFields(
                    serversToLeave.slice(0, 10).map(s => ({
                        name: s.name,
                        value: `ID: \`${s.id}\` | Members: ${s.members}`,
                        inline: false
                    }))
                )
                .setColor(0xFF0000)
                .setTimestamp();

            if (serversToLeave.length > 10) {
                embed.setFooter({ text: `Showing 10 of ${serversToLeave.length} servers` });
            }

            await interaction.editReply({ embeds: [embed] });

            // Leave servers one by one
            let leftCount = 0;
            for (const server of serversToLeave) {
                try {
                    const guild = interaction.client.guilds.cache.get(server.id);
                    if (guild) {
                        // Try to DM the server owner
                        try {
                            const owner = await guild.fetchOwner();
                            await owner.send({
                                embeds: [{
                                    title: '🔒 Private Bot',
                                    description: `Thank you for having my bot in **${guild.name}**!\n\nHowever, this bot is **private** and only available for authorized servers. The bot is now leaving your server.\n\nIf you believe this is a mistake or would like to request access, please contact the bot owner.`,
                                    color: 0xFF6B6B,
                                    timestamp: new Date()
                                }]
                            });
                        } catch (dmError) {
                            console.log(`[LEAVEALL] Could not DM owner of ${guild.name}`);
                        }

                        await guild.leave();
                        leftCount++;
                        console.log(`[LEAVEALL] Left: ${server.name} (${server.id})`);
                    }
                } catch (error) {
                    console.error(`[LEAVEALL] Error leaving ${server.name}:`, error.message);
                }
            }

            const finalEmbed = new EmbedBuilder()
                .setTitle('✅ Cleanup Complete')
                .setDescription(`Successfully left **${leftCount}** out of **${serversToLeave.length}** non-whitelisted servers.`)
                .setColor(0x00FF00)
                .setTimestamp();

            await interaction.followUp({ embeds: [finalEmbed], ephemeral: true });

        } catch (error) {
            console.error('Leave all error:', error);
            await interaction.editReply({ 
                content: '❌ An error occurred while leaving servers.' 
            });
        }
    },
};
