const { SlashCommandBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const { WebsiteAPI } = require('../utils/websiteAPI');
const github = require('../utils/github');
const axios = require('axios');

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
            // Use your existing WebsiteAPI class
            const result = await websiteAPI.verifyUser(username, password);
            
            if (!result.success) {
                await interaction.editReply(`❌ ${result.error}`);
                return;
            }

            const user = result.data.user;
            
            // Get existing linked users data
            let linkedUsers = await github.getData('data/linked_users.json') || {};
            
            // Store user data including password hash for API calls
            linkedUsers[userId] = {
                username: user.username,
                password: password, // Store for API authentication
                role: user.role,
                userId: user.id,
                linkedAt: new Date().toISOString(),
                lastLogin: new Date().toISOString()
            };

            // Save to GitHub
            await github.saveData('data/linked_users.json', linkedUsers, `Link user: ${user.username} (${userId})`);
            
            await interaction.editReply(`✅ Successfully linked to sensitivity website!\n**Username:** ${user.username}\n**Role:** ${user.role}`);
            
            // Send confirmation DM
            try {
                await interaction.user.send(`✅ Your account has been successfully linked to the sensitivity website!\n**Username:** ${user.username}\n**Role:** ${user.role}\n\nYou can now use the \`/sensitivity\` command to generate your settings.`);
            } catch (dmError) {
                console.log('Could not send DM to user:', dmError.message);
            }

        } catch (error) {
            console.error('Login error:', error);
            
            let errorMessage = '❌ An error occurred during login';
            
            if (error.response?.data?.error) {
                errorMessage = `❌ ${error.response.data.error}`;
            } else if (error.code === 'ECONNREFUSED') {
                errorMessage = '❌ Cannot connect to authentication server';
            } else if (error.code === 'ETIMEDOUT') {
                errorMessage = '❌ Login request timed out. Please try again';
            }
            
            await interaction.editReply(errorMessage);
        }
    }
};
