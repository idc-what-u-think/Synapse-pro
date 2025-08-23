const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ChannelType } = require('discord.js');
const { getConfig, saveConfig } = require('../utils/github');

// URL detection regex patterns
const URL_PATTERNS = [
    /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/gi,
    /discord\.gg\/[a-zA-Z0-9]+/gi,
    /discordapp\.com\/invite\/[a-zA-Z0-9]+/gi,
    /www\.[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/gi,
    /[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/gi
];

function containsLink(message) {
    return URL_PATTERNS.some(pattern => pattern.test(message));
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('antilink')
        .setDescription('Manage antilink protection for channels')
        .addSubcommand(subcommand =>
            subcommand.setName('add')
                .setDescription('Add antilink protection to channels')
                .addChannelOption(option =>
                    option.setName('channel')
                        .setDescription('Channel to protect (leave empty to select multiple)')
                        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand.setName('remove')
                .setDescription('Remove antilink protection from channels')
                .addChannelOption(option =>
                    option.setName('channel')
                        .setDescription('Channel to unprotect (leave empty to select multiple)')
                        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand.setName('list')
                .setDescription('List all protected channels'))
        .addSubcommand(subcommand =>
            subcommand.setName('bypass')
                .setDescription('Manage bypass roles')
                .addRoleOption(option =>
                    option.setName('role')
                        .setDescription('Role that can bypass antilink (toggles on/off)')
                        .setRequired(false)))
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
            
            // Initialize guild antilink config
            if (!config.guilds) config.guilds = {};
            if (!config.guilds[interaction.guild.id]) config.guilds[interaction.guild.id] = {};
            if (!config.guilds[interaction.guild.id].antilink) {
                config.guilds[interaction.guild.id].antilink = {
                    enabled: true,
                    protectedChannels: [],
                    bypassRoles: [],
                    message: "please refrain from sending links in this channel"
                };
            }

            const antilink = config.guilds[interaction.guild.id].antilink;

            switch (subcommand) {
                case 'add': {
                    const channel = interaction.options.getChannel('channel');
                    
                    if (channel) {
                        // Single channel mode
                        if (antilink.protectedChannels.includes(channel.id)) {
                            return await interaction.editReply({
                                content: `❌ ${channel} is already protected by antilink.`
                            });
                        }
                        
                        antilink.protectedChannels.push(channel.id);
                        await saveConfig(config, `Added antilink protection to #${channel.name} by ${interaction.user.tag}`);
                        
                        await interaction.editReply({
                            content: `✅ Added antilink protection to ${channel}`
                        });
                    } else {
                        // Multi-channel selection mode
                        const textChannels = interaction.guild.channels.cache
                            .filter(ch => ch.type === ChannelType.GuildText || ch.type === ChannelType.GuildAnnouncement)
                            .filter(ch => !antilink.protectedChannels.includes(ch.id))
                            .sort((a, b) => a.position - b.position)
                            .first(25); // Discord limit for select menu

                        if (textChannels.length === 0) {
                            return await interaction.editReply({
                                content: '❌ All text channels are already protected or no text channels available.'
                            });
                        }

                        const embed = new EmbedBuilder()
                            .setTitle('🔗 Select Channels to Protect')
                            .setDescription('React with the numbers to select channels for antilink protection:')
                            .setColor(0x0099FF);

                        let description = '';
                        const channelMap = {};
                        
                        textChannels.forEach((channel, index) => {
                            const emoji = String.fromCharCode(0x0031 + index, 0xFE0F, 0x20E3); // 1️⃣, 2️⃣, etc.
                            description += `${emoji} ${channel}\n`;
                            channelMap[emoji] = channel.id;
                        });

                        embed.setDescription(description + '\n✅ React with ✅ when done selecting');

                        const message = await interaction.editReply({ embeds: [embed] });

                        // Add reactions
                        for (let i = 0; i < textChannels.length; i++) {
                            const emoji = String.fromCharCode(0x0031 + i, 0xFE0F, 0x20E3);
                            await message.react(emoji);
                        }
                        await message.react('✅');

                        // Collect reactions
                        const filter = (reaction, user) => user.id === interaction.user.id;
                        const collector = message.createReactionCollector({ filter, time: 60000 });
                        const selectedChannels = [];

                        collector.on('collect', (reaction, user) => {
                            if (reaction.emoji.name === '✅') {
                                collector.stop();
                                return;
                            }
                            
                            const channelId = channelMap[reaction.emoji.name];
                            if (channelId && !selectedChannels.includes(channelId)) {
                                selectedChannels.push(channelId);
                            }
                        });

                        collector.on('end', async () => {
                            if (selectedChannels.length === 0) {
                                return await interaction.editReply({
                                    content: '❌ No channels selected. Operation cancelled.',
                                    embeds: []
                                });
                            }

                            // Add selected channels to protection
                            selectedChannels.forEach(channelId => {
                                if (!antilink.protectedChannels.includes(channelId)) {
                                    antilink.protectedChannels.push(channelId);
                                }
                            });

                            await saveConfig(config, `Added antilink protection to ${selectedChannels.length} channels by ${interaction.user.tag}`);

                            const channelMentions = selectedChannels.map(id => `<#${id}>`).join(', ');
                            await interaction.editReply({
                                content: `✅ Added antilink protection to:\n${channelMentions}`,
                                embeds: []
                            });
                        });
                    }
                    break;
                }

                case 'remove': {
                    const channel = interaction.options.getChannel('channel');
                    
                    if (channel) {
                        // Single channel mode
                        if (!antilink.protectedChannels.includes(channel.id)) {
                            return await interaction.editReply({
                                content: `❌ ${channel} is not protected by antilink.`
                            });
                        }
                        
                        antilink.protectedChannels = antilink.protectedChannels.filter(id => id !== channel.id);
                        await saveConfig(config, `Removed antilink protection from #${channel.name} by ${interaction.user.tag}`);
                        
                        await interaction.editReply({
                            content: `✅ Removed antilink protection from ${channel}`
                        });
                    } else {
                        // Multi-channel selection mode
                        const protectedChannels = antilink.protectedChannels
                            .map(id => interaction.guild.channels.cache.get(id))
                            .filter(ch => ch) // Remove null/undefined channels
                            .slice(0, 25); // Discord limit

                        if (protectedChannels.length === 0) {
                            return await interaction.editReply({
                                content: '❌ No channels are currently protected by antilink.'
                            });
                        }

                        const embed = new EmbedBuilder()
                            .setTitle('🔗 Select Channels to Unprotect')
                            .setDescription('React with the numbers to remove antilink protection:')
                            .setColor(0xFF6B6B);

                        let description = '';
                        const channelMap = {};
                        
                        protectedChannels.forEach((channel, index) => {
                            const emoji = String.fromCharCode(0x0031 + index, 0xFE0F, 0x20E3);
                            description += `${emoji} ${channel}\n`;
                            channelMap[emoji] = channel.id;
                        });

                        embed.setDescription(description + '\n✅ React with ✅ when done selecting');

                        const message = await interaction.editReply({ embeds: [embed] });

                        // Add reactions
                        for (let i = 0; i < protectedChannels.length; i++) {
                            const emoji = String.fromCharCode(0x0031 + i, 0xFE0F, 0x20E3);
                            await message.react(emoji);
                        }
                        await message.react('✅');

                        // Collect reactions
                        const filter = (reaction, user) => user.id === interaction.user.id;
                        const collector = message.createReactionCollector({ filter, time: 60000 });
                        const selectedChannels = [];

                        collector.on('collect', (reaction, user) => {
                            if (reaction.emoji.name === '✅') {
                                collector.stop();
                                return;
                            }
                            
                            const channelId = channelMap[reaction.emoji.name];
                            if (channelId && !selectedChannels.includes(channelId)) {
                                selectedChannels.push(channelId);
                            }
                        });

                        collector.on('end', async () => {
                            if (selectedChannels.length === 0) {
                                return await interaction.editReply({
                                    content: '❌ No channels selected. Operation cancelled.',
                                    embeds: []
                                });
                            }

                            // Remove selected channels from protection
                            antilink.protectedChannels = antilink.protectedChannels.filter(id => !selectedChannels.includes(id));

                            await saveConfig(config, `Removed antilink protection from ${selectedChannels.length} channels by ${interaction.user.tag}`);

                            const channelMentions = selectedChannels.map(id => `<#${id}>`).join(', ');
                            await interaction.editReply({
                                content: `✅ Removed antilink protection from:\n${channelMentions}`,
                                embeds: []
                            });
                        });
                    }
                    break;
                }

                case 'list': {
                    const protectedChannels = antilink.protectedChannels
                        .map(id => interaction.guild.channels.cache.get(id))
                        .filter(ch => ch); // Remove deleted channels

                    // Clean up deleted channels from config
                    if (protectedChannels.length !== antilink.protectedChannels.length) {
                        antilink.protectedChannels = protectedChannels.map(ch => ch.id);
                        await saveConfig(config, `Cleaned up deleted channels from antilink config`);
                    }

                    const embed = new EmbedBuilder()
                        .setTitle('🔗 Antilink Protection Status')
                        .setColor(antilink.enabled ? 0x00FF00 : 0xFF0000)
                        .addFields(
                            {
                                name: '🛡️ Protected Channels',
                                value: protectedChannels.length > 0 ?
                                    protectedChannels.map(ch => `• ${ch}`).join('\n') :
                                    'No channels protected',
                                inline: false
                            },
                            {
                                name: '🚫 Bypass Roles',
                                value: antilink.bypassRoles.length > 0 ?
                                    antilink.bypassRoles.map(id => `<@&${id}>`).join(', ') :
                                    'No bypass roles',
                                inline: false
                            },
                            {
                                name: '⚙️ Settings',
                                value: `Status: ${antilink.enabled ? '✅ Enabled' : '❌ Disabled'}\nMessage: "${antilink.message}"`,
                                inline: false
                            }
                        )
                        .setFooter({ 
                            text: `${protectedChannels.length} protected channel(s) • Requested by ${interaction.user.tag}`,
                            iconURL: interaction.user.displayAvatarURL()
                        })
                        .setTimestamp();

                    await interaction.editReply({ embeds: [embed] });
                    break;
                }

                case 'bypass': {
                    const role = interaction.options.getRole('role');
                    
                    if (role) {
                        if (!antilink.bypassRoles.includes(role.id)) {
                            antilink.bypassRoles.push(role.id);
                            await saveConfig(config, `Added antilink bypass role: ${role.name} by ${interaction.user.tag}`);
                            
                            await interaction.editReply({
                                content: `✅ Added ${role} as antilink bypass role`
                            });
                        } else {
                            antilink.bypassRoles = antilink.bypassRoles.filter(id => id !== role.id);
                            await saveConfig(config, `Removed antilink bypass role: ${role.name} by ${interaction.user.tag}`);
                            
                            await interaction.editReply({
                                content: `✅ Removed ${role} from antilink bypass roles`
                            });
                        }
                    } else {
                        await interaction.editReply({
                            content: `🛡️ Current bypass roles: ${antilink.bypassRoles.length ?
                                antilink.bypassRoles.map(id => `<@&${id}>`).join(', ') :
                                'None configured'}`
                        });
                    }
                    break;
                }
            }

        } catch (error) {
            console.error('Antilink command error:', error);
            
            try {
                const errorMessage = {
                    content: '❌ An error occurred while managing antilink protection.'
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

    // Message handler function to be called from your message event
    async handleMessage(message, config) {
        try {
            // Skip if no guild or bot message
            if (!message.guild || message.author.bot) return false;

            const guildConfig = config?.guilds?.[message.guild.id];
            const antilink = guildConfig?.antilink;

            // Skip if antilink not configured or disabled
            if (!antilink || !antilink.enabled) return false;

            // Skip if channel not protected
            if (!antilink.protectedChannels.includes(message.channel.id)) return false;

            // Skip if user has bypass role
            if (antilink.bypassRoles.some(roleId => message.member.roles.cache.has(roleId))) return false;

            // Skip if user has admin permissions
            if (message.member.permissions.has(PermissionFlagsBits.Administrator)) return false;

            // Check for links
            if (containsLink(message.content)) {
                // Delete the message
                await message.delete();
                
                // Send warning message
                const warningMessage = await message.channel.send(
                    `${message.author}, ${antilink.message}`
                );
                
                // Auto-delete warning after 5 seconds
                setTimeout(() => {
                    warningMessage.delete().catch(() => {});
                }, 5000);
                
                console.log(`Deleted link from ${message.author.tag} in #${message.channel.name}`);
                return true;
            }

            return false;
        } catch (error) {
            console.error('Antilink message handler error:', error);
            return false;
        }
    }
};