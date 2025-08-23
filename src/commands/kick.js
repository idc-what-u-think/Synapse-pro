const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { sendModlogMessage } = require('../utils/modlog'); // Your helper file

module.exports = {
    data: new SlashCommandBuilder()
        .setName('kick')
        .setDescription('Kick a member from the server')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('User to kick')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Reason for kick')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),

    async execute(interaction) {
        try {
            // IMPORTANT: Defer the reply immediately to prevent timeout
            await interaction.deferReply({ ephemeral: true });

            const user = interaction.options.getUser('user');
            const reason = interaction.options.getString('reason');
            const member = interaction.guild.members.cache.get(user.id);

            // Check if member exists in guild
            if (!member) {
                return await interaction.editReply({
                    content: 'User not found in this server.'
                });
            }

            // Check if user is kickable
            if (!member.kickable) {
                return await interaction.editReply({
                    content: 'I cannot kick this user. They may have higher permissions than me.'
                });
            }

            // Check if moderator can kick this user
            if (member.roles.highest.position >= interaction.member.roles.highest.position && interaction.user.id !== interaction.guild.ownerId) {
                return await interaction.editReply({
                    content: 'You cannot kick this user due to role hierarchy.'
                });
            }

            // Perform the kick
            try {
                await member.kick(reason || 'No reason provided');
                console.log(`${user.tag} kicked by ${interaction.user.tag}`);
                
                // Send modlog (this runs in background, won't delay the response)
                sendModlogMessage(interaction.guild, 'Kicked', user, interaction.user, reason)
                    .catch(err => console.error('Modlog error:', err));

                // Respond to the interaction
                let responseMessage = `✅ ${user.tag} has been kicked`;
                if (reason) {
                    responseMessage += ` for: ${reason}`;
                }

                await interaction.editReply({
                    content: responseMessage
                });

            } catch (kickError) {
                console.error('Error kicking user:', kickError);
                await interaction.editReply({
                    content: 'Failed to kick the user. Please check my permissions.'
                });
            }

        } catch (error) {
            console.error('Kick command error:', error);
            
            // Handle case where interaction hasn't been replied to yet
            try {
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({
                        content: 'An error occurred while executing the kick command.',
                        ephemeral: true
                    });
                } else {
                    await interaction.editReply({
                        content: 'An error occurred while executing the kick command.'
                    });
                }
            } catch (replyError) {
                console.error('Error sending error response:', replyError);
            }
        }
    },
};