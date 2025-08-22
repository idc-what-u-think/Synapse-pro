const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { getData, saveData } = require('../utils/github');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('rankrole')
        .setDescription('Manage level-based role rewards')
        .addSubcommand(subcommand =>
            subcommand.setName('add')
                .setDescription('Add a level role reward')
                .addIntegerOption(option =>
                    option.setName('level')
                        .setDescription('Level required')
                        .setRequired(true)
                        .setMinValue(1))
                .addRoleOption(option =>
                    option.setName('role')
                        .setDescription('Role to award')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand.setName('remove')
                .setDescription('Remove a level role reward')
                .addIntegerOption(option =>
                    option.setName('level')
                        .setDescription('Level to remove role from')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand.setName('list')
                .setDescription('List all level role rewards'))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction, octokit, owner, repo) {
        const subcommand = interaction.options.getSubcommand();
        const data = await getData(octokit, owner, repo, 'config.json');
        
        if (!data.guilds) data.guilds = {};
        if (!data.guilds[interaction.guild.id]) data.guilds[interaction.guild.id] = {};
        if (!data.guilds[interaction.guild.id].levelRoles) {
            data.guilds[interaction.guild.id].levelRoles = {};
        }

        const levelRoles = data.guilds[interaction.guild.id].levelRoles;

        switch (subcommand) {
            case 'add': {
                const level = interaction.options.getInteger('level');
                const role = interaction.options.getRole('role');
                
                levelRoles[level] = role.id;
                await saveData(octokit, owner, repo, 'config.json', data,
                    `Added level ${level} role reward: ${role.name}`);
                
                await interaction.reply({
                    content: `Added ${role} as reward for level ${level}`,
                    ephemeral: true
                });
                break;
            }
            case 'remove': {
                const level = interaction.options.getInteger('level');
                
                if (levelRoles[level]) {
                    delete levelRoles[level];
                    await saveData(octokit, owner, repo, 'config.json', data,
                        `Removed level ${level} role reward`);
                    
                    await interaction.reply({
                        content: `Removed role reward for level ${level}`,
                        ephemeral: true
                    });
                } else {
                    await interaction.reply({
                        content: `No role reward found for level ${level}`,
                        ephemeral: true
                    });
                }
                break;
            }
            case 'list': {
                const embed = new EmbedBuilder()
                    .setColor(0x00FF00)
                    .setTitle('Level Role Rewards')
                    .setDescription(Object.entries(levelRoles)
                        .sort(([a], [b]) => parseInt(a) - parseInt(b))
                        .map(([level, roleId]) => {
                            const role = interaction.guild.roles.cache.get(roleId);
                            return `Level ${level}: ${role ? `<@&${roleId}>` : 'Role not found'}`;
                        })
                        .join('\n') || 'No role rewards configured');

                await interaction.reply({ embeds: [embed], ephemeral: true });
                break;
            }
        }
    },
};
