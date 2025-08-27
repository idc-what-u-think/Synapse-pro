const { SlashCommandBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const { createClient } = require('@supabase/supabase-js');
const { getDiscordSessions, saveDiscordSessions } = require('../utils/github');

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function refreshUserSession(discordId) {
    try {
        const sessions = await getDiscordSessions();
        
        if (!sessions[discordId]) {
            return null;
        }

        const { data: user, error } = await supabase
            .from('users')
            .select('id, username, role, suspended_at, suspension_reason')
            .eq('id', sessions[discordId].supabaseUserId)
            .single();

        if (error || !user) {
            delete sessions[discordId];
            await saveDiscordSessions(sessions, 'Remove invalid session');
            return null;
        }

        if (user.suspended_at) {
            delete sessions[discordId];
            await saveDiscordSessions(sessions, 'Remove suspended user session');
            return { suspended: true, reason: user.suspension_reason };
        }

        sessions[discordId] = {
            ...sessions[discordId],
            role: user.role,
            subscriptionType: user.role,
            lastUsed: new Date().toISOString()
        };

        await saveDiscordSessions(sessions, 'Refresh user session');
        return sessions[discordId];
    } catch (error) {
        console.error('Error refreshing user session:', error);
        return null;
    }
}

const loginCommand = {
    data: new SlashCommandBuilder()
        .setName('login')
        .setDescription('Link your Sensitivity Web account to Discord'),

    async execute(interaction) {
        const modal = new ModalBuilder()
            .setCustomId('login_modal')
            .setTitle('Login to Sensitivity Web');

        const usernameInput = new TextInputBuilder()
            .setCustomId('username_input')
            .setLabel('Username')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMaxLength(50)
            .setPlaceholder('Enter your username');

        const passwordInput = new TextInputBuilder()
            .setCustomId('password_input')
            .setLabel('Password')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMaxLength(100)
            .setPlaceholder('Enter your password');

        const firstActionRow = new ActionRowBuilder().addComponents(usernameInput);
        const secondActionRow = new ActionRowBuilder().addComponents(passwordInput);

        modal.addComponents(firstActionRow, secondActionRow);

        await interaction.showModal(modal);
    }
};

async function handleLoginModal(interaction) {
    await interaction.deferReply({ ephemeral: true });

    try {
        const username = interaction.fields.getTextInputValue('username_input');
        const password = interaction.fields.getTextInputValue('password_input');
        const discordId = interaction.user.id;

        const { data: user, error } = await supabase
            .from('users')
            .select('id, username, suspended_at, suspension_reason, password_hash, role')
            .eq('username', username)
            .eq('password_hash', password)
            .single();

        if (error || !user) {
            await interaction.editReply('Authentication failed. Please check your credentials.');
            
            try {
                const dmChannel = await interaction.user.createDM();
                await dmChannel.send('**Sensitivity Web Linked failed**');
            } catch (dmError) {
                console.error('Failed to send DM:', dmError);
            }
            return;
        }

        if (user.suspended_at) {
            await interaction.editReply(`Account is suspended. Reason: ${user.suspension_reason || 'No reason provided'}`);
            
            try {
                const dmChannel = await interaction.user.createDM();
                await dmChannel.send('**Sensitivity Web Linked failed**');
            } catch (dmError) {
                console.error('Failed to send DM:', dmError);
            }
            return;
        }

        const subscriptionType = user.role || 'basic';

        const sessions = await getDiscordSessions();
        sessions[discordId] = {
            supabaseUserId: user.id,
            username: user.username,
            role: user.role,
            subscriptionType: subscriptionType,
            linkedAt: new Date().toISOString(),
            lastUsed: new Date().toISOString()
        };

        await saveDiscordSessions(sessions, 'Link Discord account');

        await interaction.editReply('Successfully linked your account! Check your DMs.');

        try {
            const dmChannel = await interaction.user.createDM();
            await dmChannel.send('**Sensitivity Web Linked successfully**');
        } catch (dmError) {
            console.error('Failed to send success DM:', dmError);
        }

    } catch (error) {
        console.error('Login error:', error);
        await interaction.editReply('An error occurred during login. Please try again later.');
        
        try {
            const dmChannel = await interaction.user.createDM();
            await dmChannel.send('**Sensitivity Web Linked failed**');
        } catch (dmError) {
            console.error('Failed to send failure DM:', dmError);
        }
    }
}

module.exports = {
    loginCommand,
    handleLoginModal,
    refreshUserSession,
    data: loginCommand.data,
    execute: loginCommand.execute
};
