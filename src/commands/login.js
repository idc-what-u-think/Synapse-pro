const { SlashCommandBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const { createClient } = require('@supabase/supabase-js');

const github = require('../utils/github');

// Initialize Supabase client for direct authentication
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Keep WebsiteAPI instance for other operations (device search, sensitivity calc, etc.)
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
        const discordUserId = interaction.user.id;

        try {
            // Query Supabase for user by username
            const { data: user, error: queryError } = await supabase
                .from('users')
                .select('*')
                .eq('username', username)
                .single();

            if (queryError || !user) {
                await interaction.editReply('❌ Username not found');
                return;
            }

            // Check if user is suspended
            if (user.suspended_at) {
                let suspensionMessage = '❌ Your account is suspended';
                if (user.suspension_reason) {
                    suspensionMessage += `\nReason: ${user.suspension_reason}`;
                }
                await interaction.editReply(suspensionMessage);
                return;
            }

            // Verify password (plain text comparison)
            if (password !== user.password_hash) {
                await interaction.editReply('❌ Invalid password');
                return;
            }

            // Check VIP expiration if applicable
            let vipStatus = 'Regular';
            if (user.vip_expires_at) {
                const vipExpiry = new Date(user.vip_expires_at);
                if (vipExpiry > new Date()) {
                    vipStatus = 'VIP';
                } else {
                    vipStatus = 'VIP Expired';
                }
            }

            // Get existing linked users data from GitHub
            let linkedUsers = await github.getData('data/linked_users.json') || {};
            
            // Store user data (don't store the actual password, but keep hash for reference)
            linkedUsers[discordUserId] = {
                username: user.username,
                supabaseUserId: user.id,
                role: user.role,
                vipStatus: vipStatus,
                vipExpiresAt: user.vip_expires_at,
                linkedAt: new Date().toISOString(),
                lastLogin: new Date().toISOString()
            };

            // Save to GitHub
            await github.saveData('data/linked_users.json', linkedUsers, `Link user: ${user.username} (Discord: ${discordUserId})`);
            
            // Create success message
            let successMessage = `✅ Successfully linked to sensitivity website!\n**Username:** ${user.username}\n**Role:** ${user.role}`;
            
            if (vipStatus !== 'Regular') {
                successMessage += `\n**VIP Status:** ${vipStatus}`;
                if (user.vip_expires_at && vipStatus === 'VIP') {
                    const expiryDate = new Date(user.vip_expires_at).toLocaleDateString();
                    successMessage += ` (expires ${expiryDate})`;
                }
            }
            
            await interaction.editReply(successMessage);
            
            // Send confirmation DM
            try {
                let dmMessage = `✅ Your account has been successfully linked to the sensitivity website!\n**Username:** ${user.username}\n**Role:** ${user.role}`;
                
                if (vipStatus !== 'Regular') {
                    dmMessage += `\n**VIP Status:** ${vipStatus}`;
                }
                
                dmMessage += `\n\nYou can now use the \`/sensitivity\` command to generate your settings.`;
                
                await interaction.user.send(dmMessage);
            } catch (dmError) {
                console.log('Could not send DM to user:', dmError.message);
            }

        } catch (error) {
            console.error('Supabase login error:', error);
            
            let errorMessage = '❌ An error occurred during login';
            
            // Handle specific Supabase errors
            if (error.message) {
                if (error.message.includes('JWT')) {
                    errorMessage = '❌ Authentication configuration error';
                } else if (error.message.includes('network')) {
                    errorMessage = '❌ Cannot connect to authentication server';
                } else {
                    errorMessage = `❌ Login failed: ${error.message}`;
                }
            }
            
            await interaction.editReply(errorMessage);
        }
    },

    // Helper function to get user data for other commands
    async getLinkedUser(discordUserId) {
        try {
            const linkedUsers = await github.getData('data/linked_users.json') || {};
            return linkedUsers[discordUserId] || null;
        } catch (error) {
            console.error('Error getting linked user:', error);
            return null;
        }
    },

    // Helper function to refresh user data from Supabase
    async refreshUserData(discordUserId) {
        try {
            const linkedUser = await this.getLinkedUser(discordUserId);
            if (!linkedUser) return null;

            // Get fresh data from Supabase
            const { data: user, error } = await supabase
                .from('users')
                .select('*')
                .eq('id', linkedUser.supabaseUserId)
                .single();

            if (error || !user) return null;

            // Update VIP status
            let vipStatus = 'Regular';
            if (user.vip_expires_at) {
                const vipExpiry = new Date(user.vip_expires_at);
                if (vipExpiry > new Date()) {
                    vipStatus = 'VIP';
                } else {
                    vipStatus = 'VIP Expired';
                }
            }

            // Update stored data
            let linkedUsers = await github.getData('data/linked_users.json') || {};
            linkedUsers[discordUserId] = {
                ...linkedUsers[discordUserId],
                role: user.role,
                vipStatus: vipStatus,
                vipExpiresAt: user.vip_expires_at,
                lastRefresh: new Date().toISOString()
            };

            await github.saveData('data/linked_users.json', linkedUsers, `Refresh user data: ${user.username}`);
            
            return linkedUsers[discordUserId];
        } catch (error) {
            console.error('Error refreshing user data:', error);
            return null;
        }
    }
};
