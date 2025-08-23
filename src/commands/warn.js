const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { getWarnings, saveWarnings } = require('../utils/github');
const { sendModlogMessage } = require('../utils/modlog');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('warn')
        .setDescription('Issues a warning to a user')
        .addUserOption(option => 
            option.setName('user')
                .setDescription('The user to warn')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Reason for warning')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

    async execute(interaction) {
        try {
            // Defer immediately to prevent timeout
            await interaction.deferReply({ ephemeral: true });

            const user = interaction.options.getUser('user');
            const reason = interaction.options.getString('reason');
            
            // Check if user is in the guild
            const member = interaction.guild.members.cache.get(user.id);
            if (!member) {
                return await interaction.editReply({
                    content: 'User not found in this server.'
                });
            }

            // Check role hierarchy (optional - prevent warning higher ranked users)
            if (member.roles.highest.position >= interaction.member.roles.highest.position && interaction.user.id !== interaction.guild.ownerId) {
                return await interaction.editReply({
                    content: 'You cannot warn this user due to role hierarchy.'
                });
            }
            
            // Get current warnings data
            const warningsData = await getWarnings();
            
            // Initialize user warnings if they don't exist
            if (!warningsData[user.id]) {
                warningsData[user.id] = [];
            }
            
            // Create warning object
            const warning = {
                moderatorId: interaction.user.id,
                moderatorTag: interaction.user.tag,
                reason,
                timestamp: new Date().toISOString(),
                guildId: interaction.guildId
            };
            
            // Add warning to user's record
            warningsData[user.id].push(warning);

            // Save updated warnings data
            await saveWarnings(warningsData, `Warning: ${user.tag} by ${interaction.user.tag}`);

            const warningCount = warningsData[user.id].length;
            
            // Send modlog (runs in background)
            sendModlogMessage(
                interaction.guild, 
                'Warned', 
                user, 
                interaction.user, 
                `${reason} (Warning #${warningCount})`
            ).catch(err => console.error('Modlog error:', err));
            
            // Try to DM the user about their warning
            try {
                await user.send({
                    content: `You have been warned in **${interaction.guild.name}**\n**Reason:** ${reason}\n**Total Warnings:** ${warningCount}`
                });
                console.log(`Warning DM sent to ${user.tag}`);
            } catch (dmError) {
                console.log(`Could not DM ${user.tag} about warning:`, dmError.message);
            }
            
            // Reply to the interaction
            await interaction.editReply({
                content: `✅ Warned ${user.tag}\n**Reason:** ${reason}\n**Total Warnings:** ${warningCount}`
            });

        } catch (error) {
            console.error('Warn command error:', error);
            
            try {
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({
                        content: 'An error occurred while issuing the warning.',
                        ephemeral: true
                    });
                } else {
                    await interaction.editReply({
                        content: 'An error occurred while issuing the warning.'
                    });
                }
            } catch (replyError) {
                console.error('Error sending error response:', replyError);
            }
        }
    },
};