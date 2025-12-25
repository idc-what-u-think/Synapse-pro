const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('leaveserver')
        .setDescription('Make the bot leave a specific server (Owner only)')
        .addStringOption(option =>
            option.setName('server_id')
                .setDescription('Server ID to leave')
                .setRequired(true)),
    
    async execute(interaction) {
        const ownerId = process.env.OWNER_ID;
        
        if (interaction.user.id !== ownerId) {
            return await interaction.reply({ 
                content: '❌ Owner only command!', 
                ephemeral: true 
            });
        }

        const serverId = interaction.options.getString('server_id');
        const guild = interaction.client.guilds.cache.get(serverId);

        if (!guild) {
            return await interaction.reply({ 
                content: '❌ Bot is not in that server or invalid server ID!', 
                ephemeral: true 
            });
        }

        const embed = new EmbedBuilder()
            .setTitle('👋 Leaving Server')
            .setDescription(`Bot will leave **${guild.name}**`)
            .addFields(
                { name: 'Server ID', value: `\`${guild.id}\``, inline: true },
                { name: 'Members', value: guild.memberCount.toString(), inline: true },
                { name: 'Owner', value: `<@${guild.ownerId}>`, inline: true }
            )
            .setColor(0xFF0000)
            .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });

        setTimeout(async () => {
            try {
                await guild.leave();
                console.log(`[LEAVE] Left server: ${guild.name} (${guild.id})`);
            } catch (error) {
                console.error(`[LEAVE] Error leaving ${guild.name}:`, error);
            }
        }, 2000);
    },
};
