const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { getData, saveData } = require('../utils/github');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('sendmessage')
        .setDescription('Send a message to a channel')
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('Channel to send message to')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('message')
                .setDescription('Message to send')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

    async execute(interaction, octokit, owner, repo) {
        // Permission check
        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
            return interaction.reply({ 
                content: '❌ You do not have permission to use this command.', 
                ephemeral: true 
            });
        }

        const channel = interaction.options.getChannel('channel');
        const message = interaction.options.getString('message');

        try {
            const sent = await channel.send({
                content: message,
                allowedMentions: { parse: ['users', 'roles'] }
            });

            // Log the action
            const data = await getData(octokit, owner, repo, 'moderation.json');
            if (!data.messageLog) data.messageLog = [];
            
            data.messageLog.push({
                type: 'sendmessage',
                content: message,
                channelId: channel.id,
                messageId: sent.id,
                sender: interaction.user.tag,
                senderId: interaction.user.id,
                timestamp: new Date().toISOString(),
                guildId: interaction.guild.id
            });

            await saveData(octokit, owner, repo, 'moderation.json', data,
                `Message sent by ${interaction.user.tag}`);

            await interaction.reply({
                content: `✅ Message sent to ${channel}\n[Jump to Message](${sent.url})`,
                ephemeral: true
            });
        } catch (error) {
            console.error('Error sending message:', error);
            await interaction.reply({
                content: `❌ Failed to send message: ${error.message}`,
                ephemeral: true
            });
        }
    },
};
