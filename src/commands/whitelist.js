const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getData, saveData } = require('../utils/github');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('whitelist')
        .setDescription('Whitelist this server (Owner only)'),
    
    async execute(interaction) {
        const ownerId = process.env.OWNER_ID;
        
        if (interaction.user.id !== ownerId) {
            return await interaction.reply({ 
                content: '❌ This command can only be used by the bot owner!', 
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

            const serverId = interaction.guild.id;
            
            if (whitelist.includes(serverId)) {
                return await interaction.editReply({ 
                    content: '⚠️ This server is already whitelisted!' 
                });
            }

            whitelist.push(serverId);
            await saveData('whitelist.json', { servers: whitelist }, `Whitelisted ${interaction.guild.name}`);

            const embed = new EmbedBuilder()
                .setTitle('✅ Server Whitelisted')
                .setDescription(`**${interaction.guild.name}** has been added to the whitelist.`)
                .addFields(
                    { name: 'Server ID', value: serverId, inline: true },
                    { name: 'Server Members', value: interaction.guild.memberCount.toString(), inline: true },
                    { name: 'Total Whitelisted', value: whitelist.length.toString(), inline: true }
                )
                .setColor(0x00FF00)
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

            console.log(`[WHITELIST] Added server: ${interaction.guild.name} (${serverId})`);

        } catch (error) {
            console.error('Whitelist error:', error);
            await interaction.editReply({ 
                content: '❌ An error occurred while whitelisting the server.' 
            });
        }
    },
};
