const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { getData, saveData } = require('../utils/github');

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

    async execute(interaction, octokit, owner, repo) {
        const subcommand = interaction.options.getSubcommand();
        const config = await getData(octokit, owner, repo, 'config.json');
        
        if (!config.guilds) config.guilds = {};
        if (!config.guilds[interaction.guild.id]) config.guilds[interaction.guild.id] = {};
        if (!config.guilds[interaction.guild.id].filter) config.guilds[interaction.guild.id].filter = {
            words: {},
            bypassRoles: []
        };

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

                await saveData(octokit, owner, repo, 'config.json', config,
                    `Added filter word: ${word}`);
                
                await interaction.reply({
                    content: `Added "${word}" to filter with action: ${action}`,
                    ephemeral: true
                });
                break;
            }
            case 'remove': {
                const word = interaction.options.getString('word').toLowerCase();
                
                if (filter.words[word]) {
                    delete filter.words[word];
                    await saveData(octokit, owner, repo, 'config.json', config,
                        `Removed filter word: ${word}`);
                    
                    await interaction.reply({
                        content: `Removed "${word}" from filter`,
                        ephemeral: true
                    });
                } else {
                    await interaction.reply({
                        content: `Word "${word}" not found in filter`,
                        ephemeral: true
                    });
                }
                break;
            }
            case 'list': {
                const words = Object.entries(filter.words);
                if (words.length === 0) {
                    await interaction.reply({
                        content: 'No filtered words configured.',
                        ephemeral: true
                    });
                    return;
                }

                const embed = new EmbedBuilder()
                    .setColor(0x0099FF)
                    .setTitle('Filtered Words')
                    .setDescription(words.map(([word, config]) =>
                        `• \`${word}\` - Action: ${config.action}`
                    ).join('\n'))
                    .addFields({
                        name: 'Bypass Roles',
                        value: filter.bypassRoles.length ?
                            filter.bypassRoles.map(id => `<@&${id}>`).join(', ') :
                            'None configured'
                    })
                    .setTimestamp();

                await interaction.reply({
                    embeds: [embed],
                    ephemeral: true
                });
                break;
            }
            case 'bypass': {
                const role = interaction.options.getRole('role');
                
                if (role) {
                    if (!filter.bypassRoles.includes(role.id)) {
                        filter.bypassRoles.push(role.id);
                        await saveData(octokit, owner, repo, 'config.json', config,
                            `Added filter bypass role: ${role.name}`);
                        
                        await interaction.reply({
                            content: `Added ${role} as filter bypass role`,
                            ephemeral: true
                        });
                    } else {
                        filter.bypassRoles = filter.bypassRoles.filter(id => id !== role.id);
                        await saveData(octokit, owner, repo, 'config.json', config,
                            `Removed filter bypass role: ${role.name}`);
                        
                        await interaction.reply({
                            content: `Removed ${role} from filter bypass roles`,
                            ephemeral: true
                        });
                    }
                } else {
                    await interaction.reply({
                        content: `Current bypass roles: ${filter.bypassRoles.length ?
                            filter.bypassRoles.map(id => `<@&${id}>`).join(', ') :
                            'None'}`,
                        ephemeral: true
                    });
                }
                break;
            }
        }
    },
};
