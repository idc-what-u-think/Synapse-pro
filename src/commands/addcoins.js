const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { getConfig, getBalances, saveBalances } = require('../utils/github');

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

    async execute(interaction) {
        try {
            // Defer immediately to prevent timeout
            await interaction.deferReply({ ephemeral: true });

            const target = interaction.options.getUser('user');
            const amount = interaction.options.getInteger('amount');
            const reason = interaction.options.getString('reason') || 'Admin added coins';
            const notify = interaction.options.getBoolean('notify') || false;

            // Validate amount
            if (amount <= 0) {
                return await interaction.editReply({
                    content: 'Amount must be greater than 0.'
                });
            }

            // Get config and balance data
            const [config, balancesData] = await Promise.all([
                getConfig(),
                getBalances()
            ]);

            const guildSettings = config?.guilds?.[interaction.guild.id]?.settings || {};
            const maxBalance = guildSettings.maxBalance || 1000000000;
            const currency = guildSettings.currency || '💰';

            const currentBalance = balancesData[target.id] || 0;
            const newBalance = currentBalance + amount;

            if (newBalance > maxBalance) {
                return await interaction.editReply({
                    content: `Cannot add coins: Would exceed maximum balance of ${currency} ${maxBalance.toLocaleString()}`
                });
            }

            // Update balance
            balancesData[target.id] = newBalance;
            await saveBalances(balancesData, `Admin added ${amount} coins to ${target.tag}: ${reason}`);

            console.log(`${interaction.user.tag} added ${amount} coins to ${target.tag}`);

            // Send notification DM if requested
            if (notify) {
                try {
                    await target.send(
                        `${currency} You received **${amount.toLocaleString()}** coins from an admin in **${interaction.guild.name}**!\n` +
                        `Reason: ${reason}\n` +
                        `New balance: **${currency} ${newBalance.toLocaleString()}**`
                    );
                    console.log(`Notification sent to ${target.tag}`);
                } catch (dmError) {
                    console.log(`Could not DM ${target.tag}:`, dmError.message);
                    return await interaction.editReply({
                        content: `${currency} Added **${amount.toLocaleString()}** coins to ${target.tag}\nNew balance: **${currency} ${newBalance.toLocaleString()}**\n\n⚠️ Could not send DM notification to user.`
                    });
                }
            }

            await interaction.editReply({
                content: `${currency} Added **${amount.toLocaleString()}** coins to ${target.tag}\nNew balance: **${currency} ${newBalance.toLocaleString()}**`
            });

        } catch (error) {
            console.error('Addcoins command error:', error);
            
            try {
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({
                        content: 'An error occurred while adding coins.',
                        ephemeral: true
                    });
                } else {
                    await interaction.editReply({
                        content: 'An error occurred while adding coins.'
                    });
                }
            } catch (replyError) {
                console.error('Error sending error response:', replyError);
            }
        }
    },
};