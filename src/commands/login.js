const { SlashCommandBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const { WebsiteAPI } = require('../utils/websiteAPI');
const github = require('../utils/github');

const websiteAPI = new WebsiteAPI();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('login')
        .setDescription('Link your sensitivity website account'),
    
    async execute(interaction) {
        const modal = new ModalBuilder()
            .setCustomId('login_modal')
            .setTitle('Login to Sensitivity Website');

        const usernameInput = new TextInputBuilder()
            .setCustomId('username')
            .setLabel('Username')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMaxLength(50);

        const passwordInput = new TextInputBuilder()
            .setCustomId('password')
            .setLabel('Password')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMaxLength(100);

        const usernameRow = new ActionRowBuilder().addComponents(usernameInput);
        const passwordRow = new ActionRowBuilder().addComponents(passwordInput);

        modal.addComponents(usernameRow, passwordRow);

        await interaction.showModal(modal);
    },

    async handleLoginModal(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const username = interaction.fields.getTextInputValue('username');
        const password = interaction.fields.getTextInputValue('password');
        const userId = interaction.user.id;

        try {
            const result = await websiteAPI.verifyUser(username, password);

            if (!result.success) {
                await interaction.editReply(`❌ ${result.error}`);
                await interaction.user.send('Sensitivity Web Linked failed').catch(() => {});
                return;
            }

            const user = result.data.user;
            
            let linkedUsers = await github.getData('data/linked_users.json') || {};
            
            linkedUsers[userId] = {
                username: user.username,
                role: user.role,
                userId: user.id,
                linkedAt: new Date().toISOString()
            };

            await github.saveData('data/linked_users.json', linkedUsers, 'Update linked users');

            await interaction.editReply('✅ Successfully linked to sensitivity website!');
            await interaction.user.send('Sensitivity Web Linked successfully').catch(() => {});

        } catch (error) {
            console.error('Login error:', error);
            await interaction.editReply('❌ An error occurred during login');
            await interaction.user.send('Sensitivity Web Linked failed').catch(() => {});
        }
    }
};
