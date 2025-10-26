const { SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup')
        .setDescription('Setup roles for server members (Admin only)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    
    async execute(interaction) {
        const embed = new EmbedBuilder()
            .setColor('#667eea')
            .setTitle('🎮 GET YOUR ROLES HERE')
            .setDescription('Join the most epic gaming community and unlock exclusive access to all channels and events!')
            .addFields({
                name: '✨ DMP EMPIRE',
                value: 'Click the button below to get started!',
                inline: false
            })
            .setFooter({ text: '1. Get Your Role (Required)' })
            .setTimestamp();

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('claim_dmp_role')
                    .setLabel('🎮 GET ROLE')
                    .setStyle(ButtonStyle.Primary)
            );

        await interaction.reply({
            embeds: [embed],
            components: [row]
        });
    }
};
