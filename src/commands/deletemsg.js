const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('deletemsg')
        .setDescription('Deletes the last message sent by a user in every channel')
        .addUserOption(option => 
            option.setName('user')
                .setDescription('The user whose messages to delete')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
    
    async execute(interaction) {
        try {
            await interaction.deferReply({ ephemeral: true });

            const targetUser = interaction.options.getUser('user');
            const guild = interaction.guild;

            const channels = guild.channels.cache.filter(
                channel => channel.isTextBased() && 
                channel.permissionsFor(guild.members.me).has(PermissionFlagsBits.ViewChannel) &&
                channel.permissionsFor(guild.members.me).has(PermissionFlagsBits.ManageMessages)
            );

            let deletedCount = 0;
            let failedCount = 0;
            const channelResults = [];

            for (const [channelId, channel] of channels) {
                try {
                    const messages = await channel.messages.fetch({ limit: 100 });
                    
                    const userMessages = messages.filter(msg => msg.author.id === targetUser.id);
                    
                    if (userMessages.size > 0) {
                        const lastMessage = userMessages.first();
                        
                        await lastMessage.delete();
                        deletedCount++;
                        channelResults.push({
                            channel: channel.name,
                            success: true
                        });
                    }
                } catch (error) {
                    console.error(`Error deleting message in ${channel.name}:`, error);
                    failedCount++;
                    channelResults.push({
                        channel: channel.name,
                        success: false,
                        error: error.message
                    });
                }
            }

            const resultEmbed = new EmbedBuilder()
                .setColor(deletedCount > 0 ? '#00ff00' : '#ff0000')
                .setTitle('🗑️ Message Deletion Results')
                .setDescription(`Deleted messages from ${targetUser.tag}`)
                .addFields(
                    { name: '✅ Deleted', value: `${deletedCount} messages`, inline: true },
                    { name: '❌ Failed', value: `${failedCount} attempts`, inline: true },
                    { name: '📁 Channels Scanned', value: `${channels.size} channels`, inline: true }
                )
                .setTimestamp();

            if (channelResults.length > 0) {
                const successChannels = channelResults
                    .filter(r => r.success)
                    .map(r => r.channel)
                    .slice(0, 10);
                
                if (successChannels.length > 0) {
                    resultEmbed.addFields({
                        name: 'Channels with Deletions',
                        value: successChannels.join(', ') + (channelResults.filter(r => r.success).length > 10 ? '...' : '')
                    });
                }
            }

            await interaction.editReply({ embeds: [resultEmbed] });

        } catch (error) {
            console.error('Error executing deletemsg command:', error);
            
            const errorMessage = interaction.deferred 
                ? { embeds: [new EmbedBuilder()
                    .setColor('#ff0000')
                    .setTitle('❌ Error')
                    .setDescription('An error occurred while deleting messages.')
                ]}
                : { content: 'An error occurred while deleting messages.', ephemeral: true };
            
            if (interaction.deferred) {
                await interaction.editReply(errorMessage);
            } else {
                await interaction.reply(errorMessage);
            }
        }
    },
};
