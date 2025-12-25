const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getData, saveData } = require('../utils/github');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('removewhitelist')
        .setDescription('Remove a server from whitelist (Owner only)')
        .addStringOption(option =>
            option.setName('server_id')
                .setDescription('Server ID to remove (leave empty for current server)')
                .setRequired(false)),
    
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

            const serverId = interaction.options.getString('server_id') || interaction.guild.id;
            
            if (!whitelist.includes(serverId)) {
                return await interaction.editReply({ 
                    content: '⚠️ That server is not in the whitelist!' 
                });
            }

            whitelist = whitelist.filter(id => id !== serverId);
            await saveData('whitelist.json', { servers: whitelist }, `Removed ${serverId} from whitelist`);

            const guild = interaction.client.guilds.cache.get(serverId);
            const serverName = guild ? guild.name : 'Unknown Server';

            const embed = new EmbedBuilder()
                .setTitle('❌ Server Removed from Whitelist')
                .setDescription(`**${serverName}** has been removed from the whitelist.`)
                .addFields(
                    { name: 'Server ID', value: serverId, inline: true },
                    { name: 'Remaining Whitelisted', value: whitelist.length.toString(), inline: true }
                )
                .setColor(0xFF0000)
                .setFooter({ text: 'Bot will leave this server on next restart or /leaveall' })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

            console.log(`[WHITELIST] Removed server: ${serverName} (${serverId})`);

        } catch (error) {
            console.error('Remove whitelist error:', error);
            await interaction.editReply({ 
                content: '❌ An error occurred while removing from whitelist.' 
            });
        }
    },
};
