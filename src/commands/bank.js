const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { initializeBank, getBankBalance, addToBank, deductFromBank, createBankEmbed, updateBankMessage, getBankStats } = require('../utils/bankManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('bank')
        .setDescription('Manage the server trust fund')
        .addSubcommand(subcommand =>
            subcommand
                .setName('setup')
                .setDescription('Setup the bank message in this channel'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('balance')
                .setDescription('Check the current bank balance'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('stats')
                .setDescription('View detailed bank statistics'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('update')
                .setDescription('Manually update the bank message'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('add')
                .setDescription('Add money to the bank (Admin only)')
                .addIntegerOption(option =>
                    option.setName('amount')
                        .setDescription('Amount to add')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('remove')
                .setDescription('Remove money from the bank (Admin only)')
                .addIntegerOption(option =>
                    option.setName('amount')
                        .setDescription('Amount to remove')
                        .setRequired(true)))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

    async execute(interaction) {
        try {
            const subcommand = interaction.options.getSubcommand();

            switch (subcommand) {
                case 'setup':
                    await this.setupBank(interaction);
                    break;
                case 'balance':
                    await this.checkBalance(interaction);
                    break;
                case 'stats':
                    await this.showStats(interaction);
                    break;
                case 'update':
                    await this.updateBank(interaction);
                    break;
                case 'add':
                    await this.addMoney(interaction);
                    break;
                case 'remove':
                    await this.removeMoney(interaction);
                    break;
            }
        } catch (error) {
            console.error('Bank command error:', error);
            
            const errorMessage = {
                content: 'An error occurred while processing the bank command.',
                ephemeral: true
            };

            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply(errorMessage);
            } else {
                await interaction.editReply(errorMessage);
            }
        }
    },

    async setupBank(interaction) {
        await interaction.deferReply({ ephemeral: true });

        try {
            // Initialize bank if not exists
            await initializeBank();
            
            // Create and send bank message
            const embed = await createBankEmbed();
            await interaction.channel.send({ embeds: [embed] });
            
            await interaction.editReply({
                content: `Bank message created successfully! Make sure to set BANK_CHANNEL_ID=${interaction.channel.id} in your environment variables for auto-updates.`
            });
        } catch (error) {
            console.error('Setup bank error:', error);
            await interaction.editReply({
                content: 'Failed to setup bank. Please try again.'
            });
        }
    },

    async checkBalance(interaction) {
        await interaction.deferReply({ ephemeral: true });

        try {
            const balance = await getBankBalance();
            
            const embed = new EmbedBuilder()
                .setColor(0x00FF00)
                .setTitle('Bank Balance')
                .setDescription(`Current balance: **${balance.toLocaleString()}** coins`)
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error('Check balance error:', error);
            await interaction.editReply({
                content: 'Failed to fetch bank balance.'
            });
        }
    },

    async showStats(interaction) {
        await interaction.deferReply({ ephemeral: true });

        try {
            const stats = await getBankStats();
            
            if (!stats) {
                return await interaction.editReply({
                    content: 'Failed to fetch bank statistics.'
                });
            }

            const embed = new EmbedBuilder()
                .setColor(0x00FF00)
                .setTitle('Bank Statistics')
                .addFields(
                    { name: 'Current Balance', value: `${stats.balance.toLocaleString()} coins`, inline: true },
                    { name: 'Initial Balance', value: `${stats.initialBalance.toLocaleString()} coins`, inline: true },
                    { name: 'Total Distributed', value: `${stats.totalDistributed.toLocaleString()} coins`, inline: true },
                    { name: 'Remaining %', value: `${((stats.balance / stats.initialBalance) * 100).toFixed(1)}%`, inline: true },
                    { name: 'Transactions', value: `${stats.transactionCount}`, inline: true },
                    { name: 'Created', value: stats.createdAt ? `<t:${Math.floor(new Date(stats.createdAt).getTime() / 1000)}:R>` : 'Unknown', inline: true }
                )
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error('Show stats error:', error);
            await interaction.editReply({
                content: 'Failed to fetch bank statistics.'
            });
        }
    },

    async updateBank(interaction) {
        await interaction.deferReply({ ephemeral: true });

        try {
            const success = await updateBankMessage(interaction.client);
            
            if (success) {
                await interaction.editReply({
                    content: 'Bank message updated successfully!'
                });
            } else {
                await interaction.editReply({
                    content: 'Failed to update bank message. Make sure BANK_CHANNEL_ID is set correctly.'
                });
            }
        } catch (error) {
            console.error('Update bank error:', error);
            await interaction.editReply({
                content: 'Failed to update bank message.'
            });
        }
    },

    async addMoney(interaction) {
        // Check admin permissions
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return await interaction.reply({
                content: 'You need Administrator permission to use this command.',
                ephemeral: true
            });
        }

        await interaction.deferReply({ ephemeral: true });

        try {
            const amount = interaction.options.getInteger('amount');
            
            if (amount <= 0) {
                return await interaction.editReply({
                    content: 'Amount must be positive.'
                });
            }

            const newBalance = await addToBank(
                amount,
                `Manual addition by ${interaction.user.tag}`,
                interaction.user.id,
                interaction.user.tag
            );

            await interaction.editReply({
                content: `Successfully added ${amount.toLocaleString()} coins to the bank. New balance: ${newBalance.toLocaleString()} coins.`
            });

            // Update bank message if possible
            await updateBankMessage(interaction.client);
        } catch (error) {
            console.error('Add money error:', error);
            await interaction.editReply({
                content: 'Failed to add money to the bank.'
            });
        }
    },

    async removeMoney(interaction) {
        // Check admin permissions
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return await interaction.reply({
                content: 'You need Administrator permission to use this command.',
                ephemeral: true
            });
        }

        await interaction.deferReply({ ephemeral: true });

        try {
            const amount = interaction.options.getInteger('amount');
            
            if (amount <= 0) {
                return await interaction.editReply({
                    content: 'Amount must be positive.'
                });
            }

            const currentBalance = await getBankBalance();
            if (currentBalance < amount) {
                return await interaction.editReply({
                    content: `Insufficient bank funds. Current balance: ${currentBalance.toLocaleString()} coins.`
                });
            }

            const newBalance = await deductFromBank(
                amount,
                `Manual removal by ${interaction.user.tag}`,
                interaction.user.id,
                interaction.user.tag
            );

            await interaction.editReply({
                content: `Successfully removed ${amount.toLocaleString()} coins from the bank. New balance: ${newBalance.toLocaleString()} coins.`
            });

            // Update bank message if possible
            await updateBankMessage(interaction.client);
        } catch (error) {
            console.error('Remove money error:', error);
            await interaction.editReply({
                content: 'Failed to remove money from the bank.'
            });
        }
    }
};
