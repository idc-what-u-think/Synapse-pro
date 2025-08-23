const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getData } = require('../utils/github');
const { formatDuration } = require('../utils/time');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('botinfo')
        .setDescription('Show bot information and statistics'),

    async execute(interaction) {
        try {
            // Defer reply for better user experience
            await interaction.deferReply();
            
            const client = interaction.client;
            const uptime = formatDuration(client.uptime);
            
            // Get JSON storage stats using the new github utils
            let commandsToday = 0;
            let storageFiles = 0;
            
            try {
                const [statsData, economyData, levelsData] = await Promise.all([
                    getData('stats.json').catch(() => ({})),
                    getData('balances').catch(() => ({})),
                    getData('levels').catch(() => ({}))
                ]);
                
                commandsToday = statsData?.daily?.[new Date().toDateString()] || 0;
                
                // Count storage files that have data
                if (Object.keys(economyData).length > 0) storageFiles++;
                if (Object.keys(levelsData).length > 0) storageFiles++;
                if (Object.keys(statsData).length > 0) storageFiles++;
                
            } catch (error) {
                console.error('Error fetching bot stats:', error);
                // Continue with default values
            }

            const embed = new EmbedBuilder()
                .setTitle('🤖 Bot Information')
                .setDescription('Synapse Bot Statistics and Information')
                .addFields(
                    { name: '⏱️ Uptime', value: uptime, inline: true },
                    { name: '🏠 Servers', value: client.guilds.cache.size.toString(), inline: true },
                    { name: '👥 Users', value: client.users.cache.size.toString(), inline: true },
                    { name: '📊 Commands Today', value: commandsToday.toString(), inline: true },
                    { name: '💾 Memory Usage', value: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`, inline: true },
                    { name: '📁 Data Files', value: storageFiles.toString(), inline: true },
                    { name: '🔗 Ping', value: `${Math.round(client.ws.ping)}ms`, inline: true },
                    { name: '⚡ Node.js', value: process.version, inline: true },
                    { name: '📦 Version', value: process.env.npm_package_version || '1.0.0', inline: true }
                )
                .setColor(0x5865F2)
                .setFooter({ 
                    text: `Requested by ${interaction.user.tag}`,
                    iconURL: interaction.user.displayAvatarURL()
                })
                .setTimestamp();

            // Add bot avatar if available
            if (client.user.displayAvatarURL()) {
                embed.setThumbnail(client.user.displayAvatarURL());
            }

            await interaction.editReply({ embeds: [embed] });
            
        } catch (error) {
            console.error('Botinfo command error:', error);
            
            try {
                const errorMessage = {
                    content: '❌ An error occurred while fetching bot information.',
                    ephemeral: true
                };
                
                if (interaction.deferred) {
                    await interaction.editReply(errorMessage);
                } else {
                    await interaction.reply(errorMessage);
                }
            } catch (replyError) {
                console.error('Error sending error response:', replyError);
            }
        }
    },
};