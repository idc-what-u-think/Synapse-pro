const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const github = require('../utils/github');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup-cooldown')
        .setDescription('Remove setup cooldown for a user (Admin only)')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to reset cooldown for')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    
    async execute(interaction) {
        const targetUser = interaction.options.getUser('user');
        
        try {
            const cooldowns = await github.getSetupCooldowns();
            
            if (!cooldowns[targetUser.id]) {
                return await interaction.reply({
                    content: `❌ ${targetUser.username} doesn't have an active setup cooldown.`,
                    ephemeral: true
                });
            }

            delete cooldowns[targetUser.id];
            await github.saveSetupCooldowns(cooldowns, `Reset setup cooldown for ${targetUser.id}`);

            await interaction.reply({
                content: `✅ Setup cooldown removed for ${targetUser.username}. They can now run setup again!`,
                ephemeral: true
            });
        } catch (error) {
            console.error('Error removing setup cooldown:', error);
            await interaction.reply({
                content: '❌ An error occurred while removing the cooldown.',
                ephemeral: true
            });
        }
    }
};
