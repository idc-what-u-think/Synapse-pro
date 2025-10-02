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
        .addSubcomman
