const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { formatDate } = require('../utils/formatters');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('serverinfo')
        .setDescription('Show server information'),

    async execute(interaction) {
        const { guild } = interaction;
        const owner = await guild.fetchOwner();
        
        const totalMembers = guild.memberCount;
        const totalChannels = guild.channels.cache.size;
        const totalRoles = guild.roles.cache.size;
        const boostLevel = guild.premiumTier;
        const boostCount = guild.premiumSubscriptionCount;

        const embed = new EmbedBuilder()
            .setTitle(guild.name)
            .setThumbnail(guild.iconURL({ size: 4096 }))
            .setImage(guild.bannerURL({ size: 4096 }))
            .addFields(
                { name: 'Owner', value: owner.user.tag, inline: true },
                { name: 'Created', value: formatDate(guild.createdAt), inline: true },
                { name: 'Members', value: totalMembers.toString(), inline: true },
                { name: 'Channels', value: totalChannels.toString(), inline: true },
                { name: 'Roles', value: totalRoles.toString(), inline: true },
                { name: 'Boost Level', value: `Level ${boostLevel} (${boostCount} boosts)`, inline: true },
                { name: 'Features', value: guild.features.join(', ') || 'None' }
            )
            .setColor(0x5865F2)
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    },
};
