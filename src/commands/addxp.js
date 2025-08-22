const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { getData, saveData } = require('../utils/github');
const { getLevel } = require('../utils/xp');
const { updateRoles } = require('../utils/levelRoles');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('addxp')
        .setDescription('Add XP to a user')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('User to add XP to')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('amount')
                .setDescription('Amount of XP to add')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Reason for adding XP'))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction, octokit, owner, repo) {
        const user = interaction.options.getUser('user');
        const amount = interaction.options.getInteger('amount');
        const reason = interaction.options.getString('reason') || 'No reason provided';

        const data = await getData(octokit, owner, repo, 'levels.json');
        const guildId = interaction.guild.id;
        
        if (!data[guildId]) data[guildId] = {};
        if (!data[guildId][user.id]) {
            data[guildId][user.id] = { messages: 0 };
        }

        const oldMessages = data[guildId][user.id].messages || 0;
        const oldLevel = getLevel(oldMessages);
        
        data[guildId][user.id].messages = oldMessages + amount;
        const newLevel = getLevel(data[guildId][user.id].messages);

        await saveData(octokit, owner, repo, 'levels.json', data,
            `Added ${amount} XP to ${user.tag}`);

        // Handle level up
        if (newLevel > oldLevel) {
            const member = await interaction.guild.members.fetch(user.id);
            await updateRoles(member, newLevel, octokit, owner, repo);

            const levelUpChannel = interaction.guild.channels.cache.get(
                data[guildId]?.levelUpChannel
            );

            if (levelUpChannel) {
                await levelUpChannel.send(
                    `🌟 GG ${user}! You just reached **Level ${newLevel}** 🎉\n` +
                    `Total Messages: ${data[guildId][user.id].messages}\n` +
                    `💡 Stay active to hit Level ${newLevel + 1} faster!`
                );
            }
        }

        await interaction.reply({
            content: `Added ${amount} messages to ${user} (${reason})\n` +
                    `New total: ${data[guildId][user.id].messages}\n` +
                    `Level: ${oldLevel} → ${newLevel}`,
            ephemeral: true
        });
    },
};
