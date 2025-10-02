const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { sendModlogEmbed } = require('../utils/modlog');

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
            const user = interaction.options.getUser('user');
            const reason = interaction.options.getString('reason') || 'No reason provided';
            const member = interaction.guild.members.cache.get(user.id);

            if (!member) {
                return await interaction.reply({
                    content: 'User not found in this server.',
                    ephemeral: true
                });
            }

            if (user.id === interaction.user.id) {
                return await interaction.reply({
                    content: 'You cannot kick yourself!',
                    ephemeral: true
                });
            }

            if (user.id === interaction.client.user.id) {
                return await interaction.reply({
                    content: 'I cannot kick myself!',
                    ephemeral: true
                });
            }

            const botMember = await interaction.guild.members.fetch(interaction.client.user.id);
            if (member.roles.highest.position >= botMember.roles.highest.position) {
                return await interaction.reply({
                    content: 'I cannot kick this user due to role hierarchy!',
                    ephemeral: true
                });
            }

            if (member.roles.highest.position >= interaction.member.roles.highest.position && interaction.user.id !== interaction.guild.ownerId) {
                return await interaction.reply({
                    content: 'You cannot kick this user due to role hierarchy!',
                    ephemeral: true
                });
            }

            await member.kick(`${reason} | Moderator: ${interaction.user.tag}`);
            
            await sendModlogEmbed(interaction.guild, 'kicked', user, interaction.user, reason);

            await interaction.reply({
                content: `✅ Successfully kicked ${user.tag}\n**Reason:** ${reason}`,
                ephemeral: true
            });

        } catch (error) {
            console.error('Error in kick command:', error);
            
            if (error.code === 50013) {
                await interaction.reply({
                    content: 'I don\'t have permission to kick this user!',
                    ephemeral: true
                });
            } else if (error.code === 10007) {
                await interaction.reply({
                    content: 'User not found!',
                    ephemeral: true
                });
            } else {
                await interaction.reply({
                    content: 'An error occurred while trying to kick the user. Please try again.',
                    ephemeral: true
                });
            }
        }
    },
};
