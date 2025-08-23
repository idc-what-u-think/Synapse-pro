const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ChannelType } = require('discord.js');
const { getConfig, saveConfig } = require('../utils/github');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('welcome')
        .setDescription('Manage welcome messages for new members')
        .addSubcommand(subcommand =>
            subcommand.setName('setup')
                .setDescription('Set up welcome messages')
                .addChannelOption(option =>
                    option.setName('channel')
                        .setDescription('Channel to send welcome messages')
                        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('message')
                        .setDescription('Welcome message (use {user} for mention, {server} for server name)')
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand.setName('disable')
                .setDescription('Disable welcome messages'))
        .addSubcommand(subcommand =>
            subcommand.setName('test')
                .setDescription('Test the welcome message with your account'))
        .addSubcommand(subcommand =>
            subcommand.setName('status')
                .setDescription('Show current welcome settings'))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        try {
            await interaction.deferReply({ ephemeral: true });

            if (!interaction.guild) {
                return await interaction.editReply({
                    content: '❌ This command can only be used in a server.'
                });
            }

            const subcommand = interaction.options.getSubcommand();
            const config = await getConfig();
            
            // Initialize guild welcome config
            if (!config.guilds) config.guilds = {};
            if (!config.guilds[interaction.guild.id]) config.guilds[interaction.guild.id] = {};
            if (!config.guilds[interaction.guild.id].welcome) {
                config.guilds[interaction.guild.id].welcome = {
                    enabled: false,
                    channel: null,
                    message: "{user} Welcome to {server}, please read the Rules. Enjoy your stay."
                };
            }

            const welcome = config.guilds[interaction.guild.id].welcome;

            switch (subcommand) {
                case 'setup': {
                    const channel = interaction.options.getChannel('channel');
                    const customMessage = interaction.options.getString('message');
                    
                    // Update welcome config
                    welcome.enabled = true;
                    welcome.channel = channel.id;
                    
                    if (customMessage) {
                        welcome.message = customMessage;
                    }

                    await saveConfig(config, `Welcome system configured for #${channel.name} by ${interaction.user.tag}`);
                    
                    const embed = new EmbedBuilder()
                        .setTitle('✅ Welcome System Configured')
                        .setColor(0x00FF00)
                        .addFields(
                            { name: '📍 Welcome Channel', value: `${channel}`, inline: true },
                            { name: '📝 Message', value: `\`${welcome.message}\``, inline: false },
                            { name: '💡 Variables', value: '`{user}` - User mention\n`{server}` - Server name\n`{count}` - Member count', inline: false }
                        )
                        .setFooter({ text: 'Welcome messages are now enabled!' })
                        .setTimestamp();

                    await interaction.editReply({ embeds: [embed] });
                    break;
                }

                case 'disable': {
                    welcome.enabled = false;
                    await saveConfig(config, `Welcome system disabled by ${interaction.user.tag}`);
                    
                    await interaction.editReply({
                        content: '❌ Welcome messages have been disabled.'
                    });
                    break;
                }

                case 'test': {
                    if (!welcome.enabled || !welcome.channel) {
                        return await interaction.editReply({
                            content: '❌ Welcome system is not configured. Use `/welcome setup` first.'
                        });
                    }

                    const welcomeChannel = interaction.guild.channels.cache.get(welcome.channel);
                    if (!welcomeChannel) {
                        return await interaction.editReply({
                            content: '❌ Welcome channel not found. Please reconfigure with `/welcome setup`.'
                        });
                    }

                    // Send test welcome message
                    await this.sendWelcomeMessage(interaction.member, interaction.guild, welcome, welcomeChannel);
                    
                    await interaction.editReply({
                        content: `✅ Test welcome message sent to ${welcomeChannel}!`
                    });
                    break;
                }

                case 'status': {
                    const welcomeChannel = welcome.channel ? 
                        interaction.guild.channels.cache.get(welcome.channel) : null;

                    const embed = new EmbedBuilder()
                        .setTitle('📋 Welcome System Status')
                        .setColor(welcome.enabled ? 0x00FF00 : 0xFF0000)
                        .addFields(
                            { name: '🔛 Status', value: welcome.enabled ? '✅ Enabled' : '❌ Disabled', inline: true },
                            { name: '📍 Channel', value: welcomeChannel ? `${welcomeChannel}` : '❌ Not set', inline: true },
                            { name: '📝 Current Message', value: `\`${welcome.message}\``, inline: false },
                            { name: '💡 Available Variables', value: '`{user}` - User mention\n`{server}` - Server name\n`{count}` - Member count', inline: false }
                        )
                        .setFooter({ 
                            text: `Requested by ${interaction.user.tag}`,
                            iconURL: interaction.user.displayAvatarURL()
                        })
                        .setTimestamp();

                    await interaction.editReply({ embeds: [embed] });
                    break;
                }
            }

        } catch (error) {
            console.error('Welcome command error:', error);
            
            try {
                const errorMessage = {
                    content: '❌ An error occurred while managing welcome settings.'
                };
                
                if (interaction.deferred) {
                    await interaction.editReply(errorMessage);
                } else {
                    await interaction.reply({ ...errorMessage, ephemeral: true });
                }
            } catch (replyError) {
                console.error('Error sending error response:', replyError);
            }
        }
    },

    // Function to send welcome message (called from guildMemberAdd event)
    async sendWelcomeMessage(member, guild, welcomeConfig, channel) {
        try {
            // Replace variables in message
            let message = welcomeConfig.message
                .replace(/{user}/g, `${member}`)
                .replace(/{server}/g, guild.name)
                .replace(/{count}/g, guild.memberCount);

            const embed = new EmbedBuilder()
                .setColor(0xFF0000) // Red color as requested
                .setTitle('👋 Welcome!')
                .setDescription(message)
                .setFooter({ 
                    text: `You are the ${guild.memberCount}${getOrdinalSuffix(guild.memberCount)} member`,
                    iconURL: member.user.displayAvatarURL()
                })
                .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
                .setTimestamp();

            // Add guild icon if available
            if (guild.iconURL()) {
                embed.setAuthor({
                    name: guild.name,
                    iconURL: guild.iconURL()
                });
            }

            await channel.send({ embeds: [embed] });
            console.log(`Welcome message sent for ${member.user.tag} in ${guild.name}`);
            
        } catch (error) {
            console.error('Error sending welcome message:', error);
        }
    }
};

// Helper function to get ordinal suffix (1st, 2nd, 3rd, etc.)
function getOrdinalSuffix(number) {
    const j = number % 10;
    const k = number % 100;
    if (j == 1 && k != 11) return "st";
    if (j == 2 && k != 12) return "nd";
    if (j == 3 && k != 13) return "rd";
    return "th";
}