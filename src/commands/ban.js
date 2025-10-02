const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { getBans, saveBans } = require('../utils/github');
const { sendModlogEmbed } = require('../utils/modlog');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ban')
        .setDescription('Bans a user from the server')
        .addUserOption(option => 
            option.setName('user')
                .setDescription('The user to ban')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Reason for banning'))
        .addIntegerOption(option =>
            option.setName('delete_days')
                .setDescription('Number of days of messages to delete (1-7)')
                .setMinValue(1)
                .setMaxValue(7))
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

    async execute(interaction) {
        try {
            const user = interaction.options.getUser('user');
            const reason = interaction.options.getString('reason') || 'No reason provided';
            const deleteDays = interaction.options.getInteger('delete_days') || 0;

            // Check if user can be banned
            if (user.id === interaction.user.id) {
                return await interaction.reply({
                    content: 'You cannot ban yourself!',
                    ephemeral: true
                });
            }

            if (user.id === interaction.client.user.id) {
                return await interaction.reply({
                    content: 'I cannot ban myself!',
                    ephemeral: true
                });
            }

            // Check if user is already banned
            const member = await interaction.guild.members.fetch(user.id).catch(() => null);
            if (!member) {
                // User might already be banned or not in server
                const bans = await interaction.guild.bans.fetch();
                if (bans.has(user.id)) {
                    return await interaction.reply({
                        content: 'This user is already banned!',
                        ephemeral: true
                    });
                }
            }

            // Check role hierarchy if user is still in server
            if (member) {
                const botMember = await interaction.guild.members.fetch(interaction.client.user.id);
                if (member.roles.highest.position >= botMember.roles.highest.position) {
                    return await interaction.reply({
                        content: 'I cannot ban this user due to role hierarchy!',
                        ephemeral: true
                    });
                }

                if (member.roles.highest.position >= interaction.member.roles.highest.position) {
                    return await interaction.reply({
                        content: 'You cannot ban this user due to role hierarchy!',
                        ephemeral: true
                    });
                }
            }

            // Get current bans data
            const bansData = await getBans();
            
            // Initialize bans array if it doesn't exist
            if (!Array.isArray(bansData.bans)) {
                bansData.bans = [];
            }

            // Add ban record
            const banRecord = {
                userId: user.id,
                userTag: user.tag,
                moderatorId: interaction.user.id,
                moderatorTag: interaction.user.tag,
                reason,
                deleteDays,
                timestamp: new Date().toISOString(),
                guildId: interaction.guildId
            };

            bansData.bans.push(banRecord);

            // Save ban data to GitHub
            await saveBans(bansData, `Ban: ${user.tag} by ${interaction.user.tag}`);

            // Execute the ban
            await interaction.guild.members.ban(user, { 
                deleteMessageSeconds: deleteDays * 24 * 60 * 60,
                reason: `${reason} | Moderator: ${interaction.user.tag}`
            });
            
            // Send to modlog with correct parameters
            await sendModlogEmbed(interaction.guild, 'banned', user, interaction.user, reason);
            
            // Reply to interaction
            await interaction.reply({
                content: `✅ Successfully banned ${user.tag}\n**Reason:** ${reason}\n**Message deletion:** ${deleteDays} days`,
                ephemeral: true
            });

        } catch (error) {
            console.error('Error in ban command:', error);
            
            // Handle specific Discord API errors
            if (error.code === 50013) {
                await interaction.reply({
                    content: 'I don\'t have permission to ban this user!',
                    ephemeral: true
                });
            } else if (error.code === 10007) {
                await interaction.reply({
                    content: 'User not found!',
                    ephemeral: true
                });
            } else {
                await interaction.reply({
                    content: 'An error occurred while trying to ban the user. Please try again.',
                    ephemeral: true
                });
            }
        }
    },
};
