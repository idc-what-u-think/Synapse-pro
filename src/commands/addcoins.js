const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { getData } = require('../utils/github');
const { addBalance } = require('../utils/economy');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('addcoins')
        .setDescription('Add coins to a user')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('User to add coins to')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('amount')
                .setDescription('Amount of coins')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Reason for adding coins'))
        .addBooleanOption(option =>
            option.setName('notify')
                .setDescription('Send DM to user'))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction, octokit, owner, repo) {
        const target = interaction.options.getUser('user');
        const amount = interaction.options.getInteger('amount');
        const reason = interaction.options.getString('reason') || 'No reason provided';
        const notify = interaction.options.getBoolean('notify') || false;

        const data = await getData(octokit, owner, repo, 'economy.json');
        const settings = data?.guilds?.[interaction.guild.id]?.settings || {};
        const maxBalance = settings.maxBalance || 1000000000;
        const currency = settings.currency || '💰';

        const currentBalance = data?.guilds?.[interaction.guild.id]?.economy?.[target.id]?.balance || 0;
        if (currentBalance + amount > maxBalance) {
            return interaction.reply({
                content: `Cannot add coins: Would exceed maximum balance of ${maxBalance}`,
                ephemeral: true
            });
        }

        const user = await addBalance(target.id, interaction.guild.id, amount, 
            `Admin: ${reason} by ${interaction.user.tag}`, octokit, owner, repo);

        if (notify) {
            try {
                await target.send(
                    `${currency} You received **${amount}** coins from an admin!\n` +
                    `Reason: ${reason}\n` +
                    `New balance: **${user.balance}** coins`
                );
            } catch (err) {
                await interaction.reply({
                    content: `Added coins but couldn't DM user: ${err.message}`,
                    ephemeral: true
                });
                return;
            }
        }

        await interaction.reply({
            content: `Added ${amount} coins to ${target}\nNew balance: ${user.balance}`,
            ephemeral: true
        });
    },
};
