const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const github = require('../utils/github');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('admineconomy')
        .setDescription('Manage user economy (Admin only)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(subcommand =>
            subcommand
                .setName('add')
                .setDescription('Add currency to a user')
                .addUserOption(option =>
                    option
                        .setName('user')
                        .setDescription('User to add currency to')
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option
                        .setName('currency')
                        .setDescription('Currency type')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Coins', value: 'coins' },
                            { name: 'DMP Bucks', value: 'bucks' }
                        )
                )
                .addIntegerOption(option =>
                    option
                        .setName('amount')
                        .setDescription('Amount to add')
                        .setRequired(true)
                        .setMinValue(1)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('remove')
                .setDescription('Remove currency from a user')
                .addUserOption(option =>
                    option
                        .setName('user')
                        .setDescription('User to remove currency from')
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option
                        .setName('currency')
                        .setDescription('Currency type')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Coins', value: 'coins' },
                            { name: 'DMP Bucks', value: 'bucks' }
                        )
                )
                .addIntegerOption(option =>
                    option
                        .setName('amount')
                        .setDescription('Amount to remove')
                        .setRequired(true)
                        .setMinValue(1)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('set')
                .setDescription('Set a user\'s currency amount')
                .addUserOption(option =>
                    option
                        .setName('user')
                        .setDescription('User to set currency for')
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option
                        .setName('currency')
                        .setDescription('Currency type')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Coins', value: 'coins' },
                            { name: 'DMP Bucks', value: 'bucks' }
                        )
                )
                .addIntegerOption(option =>
                    option
                        .setName('amount')
                        .setDescription('Amount to set')
                        .setRequired(true)
                        .setMinValue(0)
                )
        ),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        const targetUser = interaction.options.getUser('user');
        const currency = interaction.options.getString('currency');
        const amount = interaction.options.getInteger('amount');

        try {
            const economy = await github.getEconomy();

            if (!economy[targetUser.id]) {
                economy[targetUser.id] = { coins: 0, bucks: 0 };
            }

            const userBalance = economy[targetUser.id];
            const currencyName = currency === 'coins' ? 'Coins' : 'DMP Bucks';
            const currencyEmoji = currency === 'coins' ? '🪙' : '💵';

            let action = '';
            let oldAmount = userBalance[currency];

            if (subcommand === 'add') {
                userBalance[currency] += amount;
                action = 'Added';
            } else if (subcommand === 'remove') {
                if (userBalance[currency] < amount) {
                    return await interaction.reply({
                        content: `❌ ${targetUser.username} only has **${userBalance[currency]} ${currencyName}**. Cannot remove ${amount}.`,
                        ephemeral: true
                    });
                }
                userBalance[currency] -= amount;
                action = 'Removed';
            } else if (subcommand === 'set') {
                userBalance[currency] = amount;
                action = 'Set';
            }

            await github.saveEconomy(economy);

            const embed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle('✅ Economy Updated')
                .setDescription(`Successfully ${action.toLowerCase()} currency for ${targetUser.username}`)
                .addFields(
                    { name: 'Action', value: action, inline: true },
                    { name: 'Currency', value: `${currencyEmoji} ${currencyName}`, inline: true },
                    { name: 'Amount', value: `${amount}`, inline: true }
                )
                .addFields(
                    { name: 'Old Balance', value: `${oldAmount} ${currencyName}`, inline: true },
                    { name: 'New Balance', value: `${userBalance[currency]} ${currencyName}`, inline: true }
                )
                .setTimestamp();

            await interaction.reply({ embeds: [embed], ephemeral: true });

        } catch (error) {
            console.error('Error in admineconomy command:', error);
            await interaction.reply({
                content: '❌ An error occurred while updating the economy.',
                ephemeral: true
            });
        }
    }
};
