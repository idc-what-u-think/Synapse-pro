const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { sendModlogEmbed } = require('../utils/modlog');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('purge')
        .setDescription('Bulk delete messages')
        .addIntegerOption(option => 
            option.setName('amount')
                .setDescription('Number of messages to delete (1-100)')
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(100))
        .addUserOption(option =>
            option.setName('user')
                .setDescription('Only delete messages from this user'))
        .addStringOption(option =>
            option.setName('filter')
                .setDescription('Filter messages by content type')
                .addChoices(
                    { name: 'Links', value: 'links' },
                    { name: 'Images', value: 'images' },
                    { name: 'Files', value: 'files' },
                    { name: 'Embeds', value: 'embeds' },
                    { name: 'Text only', value: 'text' }
                ))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

    async execute(interaction, octokit, owner, repo) {
        await interaction.deferReply({ ephemeral: true });
        
        const amount = interaction.options.getInteger('amount');
        const user = interaction.options.getUser('user');
        const filter = interaction.options.getString('filter');
        
        const messages = await interaction.channel.messages.fetch({ limit: amount });
        
        let filtered = messages;
        
        if (user) {
            filtered = filtered.filter(msg => msg.author.id === user.id);
        }
        
        if (filter) {
            filtered = filtered.filter(msg => {
                switch(filter) {
                    case 'links':
                        return msg.content.match(/https?:\/\/[^\s]+/);
                    case 'images':
                        return msg.attachments.some(att => att.contentType?.startsWith('image/'));
                    case 'files':
                        return msg.attachments.size > 0;
                    case 'embeds':
                        return msg.embeds.length > 0;
                    case 'text':
                        return !msg.attachments.size && !msg.embeds.length && 
                               !msg.content.match(/https?:\/\/[^\s]+/);
                }
            });
        }
        
        const deletedCount = filtered.size;
        if (deletedCount === 0) {
            return interaction.editReply('No messages found matching the criteria.');
        }

        await interaction.channel.bulkDelete(filtered, true)
            .catch(error => {
                console.error('Error deleting messages:', error);
                return interaction.editReply('Error deleting messages. Messages older than 14 days cannot be bulk deleted.');
            });

        const modlogEmbed = new EmbedBuilder()
            .setColor(0x808080)
            .setTitle('Messages Purged')
            .addFields(
                { name: 'Channel', value: `<#${interaction.channel.id}>` },
                { name: 'Moderator', value: interaction.user.tag },
                { name: 'Amount', value: `${deletedCount} messages` },
                { name: 'Filter', value: filter || 'None' },
                { name: 'Target User', value: user ? user.tag : 'All users' }
            )
            .setTimestamp();

        await sendModlogEmbed(interaction, octokit, owner, repo, modlogEmbed);
        
        await interaction.editReply({
            content: `Successfully deleted ${deletedCount} messages.`,
            ephemeral: true
        });
    },
};
