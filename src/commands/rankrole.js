const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { getConfig, saveConfig } = require('../utils/github');

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

    async execute(interaction) {
        try {
            const subcommand = interaction.options.getSubcommand();
            const data = await getConfig();
            
            // Ensure data structure exists
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
                    
                    // Validation checks
                    if (!role) {
                        return await interaction.reply({
                            content: 'Invalid role specified!',
                            ephemeral: true
                        });
                    }

                    // Check if bot can manage this role
                    const botMember = await interaction.guild.members.fetch(interaction.client.user.id);
                    if (role.position >= botMember.roles.highest.position) {
                        return await interaction.reply({
                            content: 'I cannot manage this role due to role hierarchy! The role must be below my highest role.',
                            ephemeral: true
                        });
                    }

                    // Check if role is already assigned to another level
                    const existingLevel = Object.entries(levelRoles).find(([, roleId]) => roleId === role.id);
                    if (existingLevel) {
                        return await interaction.reply({
                            content: `This role is already assigned to level ${existingLevel[0]}! Remove it first if you want to reassign it.`,
                            ephemeral: true
                        });
                    }
                    
                    levelRoles[level] = role.id;
                    await saveConfig(data, `Added level ${level} role reward: ${role.name}`);
                    
                    await interaction.reply({
                        content: `✅ Added ${role} as reward for level **${level}**`,
                        ephemeral: true
                    });
                    break;
                }
                
                case 'remove': {
                    const level = interaction.options.getInteger('level');
                    
                    if (levelRoles[level]) {
                        const roleId = levelRoles[level];
                        const role = interaction.guild.roles.cache.get(roleId);
                        const roleName = role ? role.name : 'Unknown Role';
                        
                        delete levelRoles[level];
                        await saveConfig(data, `Removed level ${level} role reward: ${roleName}`);
                        
                        await interaction.reply({
                            content: `✅ Removed role reward for level **${level}** (${roleName})`,
                            ephemeral: true
                        });
                    } else {
                        await interaction.reply({
                            content: `❌ No role reward found for level **${level}**`,
                            ephemeral: true
                        });
                    }
                    break;
                }
                
                case 'list': {
                    const embed = new EmbedBuilder()
                        .setColor(0x00FF00)
                        .setTitle('🏆 Level Role Rewards')
                        .setFooter({ 
                            text: `${interaction.guild.name} • ${Object.keys(levelRoles).length} rewards configured`,
                            iconURL: interaction.guild.iconURL()
                        })
                        .setTimestamp();

                    if (Object.keys(levelRoles).length === 0) {
                        embed.setDescription('❌ No role rewards configured yet!\n\nUse `/rankrole add` to create level rewards.');
                        embed.setColor(0xFF0000);
                    } else {
                        const roleList = Object.entries(levelRoles)
                            .sort(([a], [b]) => parseInt(a) - parseInt(b))
                            .map(([level, roleId]) => {
                                const role = interaction.guild.roles.cache.get(roleId);
                                return `**Level ${level}:** ${role ? `<@&${roleId}>` : '❌ Role not found (deleted?)'}`;
                            })
                            .join('\n');

                        embed.setDescription(roleList);
                    }

                    await interaction.reply({ embeds: [embed], ephemeral: true });
                    break;
                }
            }
            
        } catch (error) {
            console.error('Error in rankrole command:', error);
            await interaction.reply({
                content: 'An error occurred while managing role rewards. Please try again.',
                ephemeral: true
            });
        }
    },
};