const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('serverinvite')
        .setDescription('Generate a server invite')
        .addIntegerOption(option =>
            option.setName('expires')
                .setDescription('Expiration time in hours (0 for never)')
                .setMinValue(0)
                .setMaxValue(168))
        .addIntegerOption(option =>
            option.setName('uses')
                .setDescription('Maximum number of uses (0 for unlimited)')
                .setMinValue(0)
                .setMaxValue(100))
        .setDefaultMemberPermissions(PermissionFlagsBits.CreateInstantInvite),

    async execute(interaction) {
        const hours = interaction.options.getInteger('expires') || 24;
        const maxUses = interaction.options.getInteger('uses') || 0;

        const invite = await interaction.channel.createInvite({
            maxAge: hours * 3600,
            maxUses: maxUses,
            unique: true,
            reason: `Created by ${interaction.user.tag}`
        });

        const response = [
            `🔗 Invite Link: ${invite.url}`,
            `⌛ Expires: ${hours === 0 ? 'Never' : `in ${hours} hours`}`,
            `👥 Max Uses: ${maxUses === 0 ? 'Unlimited' : maxUses}`
        ].join('\n');

        await interaction.reply({
            content: response,
            ephemeral: true
        });
    },
};
