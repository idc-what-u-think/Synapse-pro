const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { getData, saveData } = require('../utils/github');
const { sendModlogEmbed } = require('../utils/modlog');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('unmute')
        .setDescription('Unmutes a user')
        .addUserOption(option => 
            option.setName('user')
                .setDescription('The user to unmute')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

    async execute(interaction, octokit, owner, repo) {
        const user = interaction.options.getUser('user');
        const member = await interaction.guild.members.fetch(user.id);

        const modData = await getData(octokit, owner, repo, 'moderation.json');
        
        if (modData.mutes) {
            const activeMute = modData.mutes.find(
                mute => mute.userId === user.id && 
                mute.guildId === interaction.guildId && 
                mute.active
            );
            
            if (activeMute) {
                activeMute.active = false;
                activeMute.unmuteTime = new Date().toISOString();
                activeMute.unmutedBy = interaction.user.id;
            }
        }

        await saveData(octokit, owner, repo, 'moderation.json', modData,
            `Unmute: ${user.tag} by ${interaction.user.tag}`);

        await member.timeout(null);

        const modlogEmbed = new EmbedBuilder()
            .setColor(0x00FF00)
            .setTitle('Member Unmuted')
            .addFields(
                { name: 'User', value: `${user.tag} (${user.id})` },
                { name: 'Moderator', value: `${interaction.user.tag}` }
            )
            .setTimestamp();

        await sendModlogEmbed(interaction, octokit, owner, repo, modlogEmbed);
        
        await interaction.reply({
            content: `Unmuted ${user.tag}`,
            ephemeral: true
        });
    },
};
