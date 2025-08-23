const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ChannelType } = require('discord.js');
const { getConfig, saveConfig } = require('../utils/github');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('levelchannel')
        .setDescription('Configure level-up message channel')
        .addSubcommand(subcommand =>
            subcommand.setName('set')
                .setDescription('Set the channel for level-up messages')
                .addChannelOption(option =>
                    option.setName('channel')
                        .setDescription('Channel to send level-up messages')
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand.setName('remove')
                .setDescription('Remove level-up channel (messages will appear in current channel)'))
        .addSubcommand(subcommand =>
            subcommand.setName('view')
                .setDescription('View current level-up channel configuration'))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        try {
            const subcommand = interaction.options.getSubcommand();
            const data = await getConfig();
            
            // Ensure data structure exists
            if (!data.guilds) data.guilds = {};
            if (!data.guilds[interaction.guild.id]) data.guilds[interaction.guild.id] = {};

            const guildConfig = data.guilds[interaction.guild.id];

            switch (subcommand) {
                case 'set': {
                    const channel = interaction.options.getChannel('channel');
                    
                    // Validation checks
                    if (!channel) {
                        return await interaction.reply({
                            content: '❌ Invalid channel specified!',
                            ephemeral: true
                        });
                    }

                    // Check if bot can send messages in this channel
                    const botPermissions = channel.permissionsFor(interaction.client.user);
                    if (!botPermissions.has(['SendMessages', 'ViewChannel'])) {
                        return await interaction.reply({
                            content: `❌ I don't have permission to send messages in ${channel}! Please ensure I have \`Send Messages\` and \`View Channel\` permissions.`,
                            ephemeral: true
                        });
                    }
                    
                    // Set the level-up channel
                    guildConfig.levelUpChannel = channel.id;
                    await saveConfig(data, `Set level-up channel to #${channel.name}`);
                    
                    await interaction.reply({
                        content: `✅ Level-up messages will now be sent to ${channel}`,
                        ephemeral: true
                    });
                    break;
                }
                
                case 'remove': {
                    if (guildConfig.levelUpChannel) {
                        const oldChannelId = guildConfig.levelUpChannel;
                        const oldChannel = interaction.guild.channels.cache.get(oldChannelId);
                        const channelName = oldChannel ? `#${oldChannel.name}` : 'Unknown Channel';
                        
                        delete guildConfig.levelUpChannel;
                        await saveConfig(data, `Removed level-up channel configuration`);
                        
                        await interaction.reply({
                            content: `✅ Removed level-up channel configuration. Messages will now appear in the channel where users level up.\n\n**Previous channel:** ${channelName}`,
                            ephemeral: true
                        });
                    } else {
                        await interaction.reply({
                            content: `❌ No level-up channel is currently configured.`,
                            ephemeral: true
                        });
                    }
                    break;
                }
                
                case 'view': {
                    const embed = new EmbedBuilder()
                        .setColor(0x8e44ad)
                        .setTitle('📢 Level-Up Channel Configuration')
                        .setFooter({ 
                            text: interaction.guild.name,
                            iconURL: interaction.guild.iconURL()
                        })
                        .setTimestamp();

                    if (guildConfig.levelUpChannel) {
                        const channel = interaction.guild.channels.cache.get(guildConfig.levelUpChannel);
                        if (channel) {
                            embed.setDescription(`✅ **Current Channel:** ${channel}\n\n*Level-up messages will be sent to this channel when users level up.*`);
                            embed.setColor(0x00FF00);
                        } else {
                            embed.setDescription(`❌ **Configured Channel Not Found**\n\nChannel ID: \`${guildConfig.levelUpChannel}\`\n*The configured channel may have been deleted. Use \`/levelchannel set\` to configure a new channel.*`);
                            embed.setColor(0xFF0000);
                        }
                    } else {
                        embed.setDescription(`❌ **No Channel Configured**\n\n*Level-up messages will appear in the channel where users level up.*\n\nUse \`/levelchannel set\` to configure a dedicated channel.`);
                        embed.setColor(0xFFFF00);
                    }

                    await interaction.reply({ embeds: [embed], ephemeral: true });
                    break;
                }
            }
            
        } catch (error) {
            console.error('Error in levelchannel command:', error);
            await interaction.reply({
                content: 'An error occurred while managing level-up channel configuration. Please try again.',
                ephemeral: true
            });
        }
    },
};