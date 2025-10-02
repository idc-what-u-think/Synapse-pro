const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const github = require('../utils/github');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('send')
        .setDescription('Send coins or DMP Bucks to another user')
        .addStringOption(option =>
            option.setName('currency')
                .setDescription('Type of currency to send')
                .setRequired(true)
                .addChoices(
                    { name: 'Coins', value: 'coins' },
                    { name: 'DMP Bucks', value: 'bucks' }
                ))
        .addIntegerOption(option =>
            option.setName('amount')
                .setDescription('Amount to send')
                .setRequired(true)
                .setMinValue(1))
        .addUserOption(option =>
            option.setName('user')
                .setDescription('User to send to')
                .setRequired(true))
        .addBooleanOption(option =>
            option.setName('receipt')
                .setDescription('Send receipt to recipient\'s DM')
                .setRequired(false)),

    async execute(interaction) {
        const senderId = interaction.user.id;
        const currency = interaction.options.getString('currency');
        const amount = interaction.options.getInteger('amount');
        const recipient = interaction.options.getUser('user');
        const sendReceipt = interaction.options.getBoolean('receipt') || false;

        // Validation: Can't send to yourself
        if (senderId === recipient.id) {
            return await interaction.reply({
                content: '❌ You cannot send currency to yourself!',
                ephemeral: true
            });
        }

        // Validation: Can't send to bots
        if (recipient.bot) {
            return await interaction.reply({
                content: '❌ You cannot send currency to bots!',
                ephemeral: true
            });
        }

        // Validation: Minimum amounts
        if (currency === 'coins' && amount < 10) {
            return await interaction.reply({
                content: '❌ Minimum transfer amount is **10 Coins**!',
                ephemeral: true
            });
        }

        if (currency === 'bucks' && amount < 1) {
            return await interaction.reply({
                content: '❌ Minimum transfer amount is **1 DMP Buck**!',
                ephemeral: true
            });
        }

        try {
            const economy = await github.getEconomy();

            // Initialize sender if not exists
            if (!economy[senderId]) {
                economy[senderId] = { coins: 0, bucks: 0 };
            }

            // Initialize recipient if not exists
            if (!economy[recipient.id]) {
                economy[recipient.id] = { coins: 0, bucks: 0 };
            }

            // Check if sender has enough balance
            if (economy[senderId][currency] < amount) {
                return await interaction.reply({
                    content: `❌ Insufficient balance!\n\nYou have: **${economy[senderId][currency]} ${currency === 'coins' ? 'Coins' : 'DMP Bucks'}**\nRequired: **${amount} ${currency === 'coins' ? 'Coins' : 'DMP Bucks'}**`,
                    ephemeral: true
                });
            }

            // Process transaction
            economy[senderId][currency] -= amount;
            economy[recipient.id][currency] += amount;

            await github.saveEconomy(economy);

            // Success message to sender
            const senderEmbed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle('✅ Transfer Successful!')
                .setDescription(`You sent **${amount} ${currency === 'coins' ? '🪙 Coins' : '💵 DMP Bucks'}** to ${recipient}`)
                .addFields(
                    { name: 'Your New Balance', value: `🪙 ${economy[senderId].coins} Coins\n💵 ${economy[senderId].bucks} DMP Bucks` }
                )
                .setFooter({ text: sendReceipt ? 'Receipt sent to recipient\'s DM' : 'No receipt sent' })
                .setTimestamp();

            await interaction.reply({ embeds: [senderEmbed], ephemeral: true });

            // Send receipt to recipient's DM if requested
            if (sendReceipt) {
                try {
                    const receiptEmbed = new EmbedBuilder()
                        .setColor('#0099ff')
                        .setTitle('💌 Payment Receipt')
                        .setDescription(`You received a payment from **${interaction.user.tag}**`)
                        .addFields(
                            { name: 'Amount', value: `${amount} ${currency === 'coins' ? '🪙 Coins' : '💵 DMP Bucks'}`, inline: true },
                            { name: 'From', value: `${interaction.user.tag}`, inline: true },
                            { name: 'Your New Balance', value: `🪙 ${economy[recipient.id].coins} Coins\n💵 ${economy[recipient.id].bucks} DMP Bucks` }
                        )
                        .setFooter({ text: 'Transaction Receipt' })
                        .setTimestamp();

                    await recipient.send({ embeds: [receiptEmbed] });
                } catch (dmError) {
                    console.log(`Could not send receipt to ${recipient.tag} - DMs likely closed`);
                }
            }

        } catch (error) {
            console.error('Error in send command:', error);
            await interaction.reply({
                content: '❌ An error occurred while processing the transfer.',
                ephemeral: true
            });
        }
    }
};
