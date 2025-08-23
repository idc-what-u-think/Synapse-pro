const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { getConfig, saveConfig } = require('../utils/github');

function convertToRegexPattern(word) {
    return word.replace(/\*/g, '.*').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('filter')
        .setDescription('Manage word filter')
        .addSubcommand(subcommand =>
            subcommand.setName('add')
                .setDescription('Add a word to the filter')
                .addStringOption(option =>
                    option.setName('word')
                        .setDescription('Word or pattern to filter')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('action')
                        .setDescription('Action to take when word is detected')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Delete', value: 'delete' },
                            { name: 'Mute', value: 'mute' },
                            { name: 'Warn', value: 'warn' },
                            { name: 'Ban', value: 'ban' }
                        )))
        .addSubcommand(subcommand =>
            subcommand.setName('remove')
                .setDescription('Remove a word from the filter')
                .addStringOption(option =>
                    option.setName('word')
                        .setDescription('Word to remove')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand.setName('list')
                .setDescription('List all filtered words'))
        .addSubcommand(subcommand =>
            subcommand.setName('bypass')
                .setDescription('Set bypass role')
                .addRoleOption(option =>
                    option.setName('role')
                        .setDescription('Role that can bypass the filter')))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        try {
            // Defer reply to prevent timeout
            await interaction.deferReply({ ephemeral: true });

            // Check if command is used in a guild
            if (!interaction.guild) {
                return await interaction.editReply({
                    content: '❌ This command can only be used in a server, not in DMs.'
                });
            }

            const subcommand = interaction.options.getSubcommand();
            const config = await getConfig();
            
            // Initialize guild config structure
            if (!config.guilds) config.guilds = {};
            if (!config.guilds[interaction.guild.id]) config.guilds[interaction.guild.id] = {};
            if (!config.guilds[interaction.guild.id].filter) {
                config.guilds[interaction.guild.id].filter = {
                    words: {},
                    bypassRoles: []
                };
            }

            const filter = config.guilds[interaction.guild.id].filter;

            switch (subcommand) {
                case 'add': {
                    const word = interaction.options.getString('word').toLowerCase();
                    const action = interaction.options.getString('action');
                    
                    filter.words[word] = {
                        pattern: convertToRegexPattern(word),
                        action,
                        addedBy: interaction.user.id,
                        addedAt: new Date().toISOString()
                    };

                    await saveConfig(config, `Added filter word: ${word} (${action}) by ${interaction.user.tag}`);
                    
                    await interaction.editReply({
                        content: `✅ Added \`${word}\` to filter with action: **${action}**`
                    });
                    break;
                }
                
                case 'remove': {
                    const word = interaction.options.getString('word').toLowerCase();
                    
                    if (filter.words[word]) {
                        delete filter.words[word];
                        await saveConfig(config, `Removed filter word: ${word} by ${interaction.user.tag}`);
                        
                        await interaction.editReply({
                            content: `✅ Removed \`${word}\` from filter`
                        });
                    } else {
                        await interaction.editReply({
                            content: `❌ Word \`${word}\` not found in filter`
                        });
                    }
                    break;
                }
                
                case 'list': {
                    const words = Object.entries(filter.words);
                    if (words.length === 0) {
                        await interaction.editReply({
                            content: '📝 No filtered words configured.'
                        });
                        return;
                    }

                    const embed = new EmbedBuilder()
                        .setColor(0x0099FF)
                        .setTitle('🔍 Filtered Words')
                        .setDescription(words.map(([word, config]) =>
                            `• \`${word}\` - **${config.action}** action`
                        ).join('\n'))
                        .addFields({
                            name: '🛡️ Bypass Roles',
                            value: filter.bypassRoles.length ?
                                filter.bypassRoles.map(id => `<@&${id}>`).join(', ') :
                                'None configured',
                            inline: false
                        })
                        .setFooter({ 
                            text: `${words.length} filtered word(s) • Requested by ${interaction.user.tag}`,
                            iconURL: interaction.user.displayAvatarURL()
                        })
                        .setTimestamp();

                    await interaction.editReply({
                        embeds: [embed]
                    });
                    break;
                }
                
                case 'bypass': {
                    const role = interaction.options.getRole('role');
                    
                    if (role) {
                        if (!filter.bypassRoles.includes(role.id)) {
                            filter.bypassRoles.push(role.id);
                            await saveConfig(config, `Added filter bypass role: ${role.name} by ${interaction.user.tag}`);
                            
                            await interaction.editReply({
                                content: `✅ Added ${role} as filter bypass role`
                            });
                        } else {
                            filter.bypassRoles = filter.bypassRoles.filter(id => id !== role.id);
                            await saveConfig(config, `Removed filter bypass role: ${role.name} by ${interaction.user.tag}`);
                            
                            await interaction.editReply({
                                content: `✅ Removed ${role} from filter bypass roles`
                            });
                        }
                    } else {
                        await interaction.editReply({
                            content: `🛡️ Current bypass roles: ${filter.bypassRoles.length ?
                                filter.bypassRoles.map(id => `<@&${id}>`).join(', ') :
                                'None configured'}`
                        });
                    }
                    break;
                }
            }
            
        } catch (error) {
            console.error('Filter command error:', error);
            
            try {
                const errorMessage = {
                    content: '❌ An error occurred while managing the word filter.'
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
};