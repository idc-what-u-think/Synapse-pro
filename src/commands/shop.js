const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const github = require('../utils/github');

const SHOP_ITEMS = {
    roomcard: {
        name: 'Room Card',
        description: 'Create game rooms for multiplayer games. Valid for 1 week.',
        price: 10,
        emoji: '🎮',
        currency: 'bucks'
    }
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('shop')
        .setDescription('Browse and purchase items from the shop'),

    async execute(interaction) {
        const userId = interaction.user.id;

        try {
            const economy = await github.getEconomy();

            if (!economy[userId]) {
                economy[userId] = { coins: 0, bucks: 0 };
                await github.saveEconomy(economy);
            }

            const userBalance = economy[userId];

            const embed = new EmbedBuilder()
                .setColor('#0099ff')
                .setTitle('🛒 DMP Shop')
                .setDescription('Purchase items using your DMP Bucks!')
                .addFields(
                    {
                        name: `${SHOP_ITEMS.roomcard.emoji} ${SHOP_ITEMS.roomcard.name}`,
                        value: `${SHOP_ITEMS.roomcard.description}\n**Price:** 💵 ${SHOP_ITEMS.roomcard.price} DMP Bucks`,
                        inline: false
                    }
                )
                .addFields(
                    { name: 'Your Balance', value: `🪙 ${userBalance.coins} Coins\n💵 ${userBalance.bucks} DMP Bucks` }
                )
                .setFooter({ text: 'Click the button below to purchase items' })
                .setTimestamp();

            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('buy_roomcard')
                        .setLabel('Buy Room Card (10 Bucks)')
                        .setEmoji('🎮')
                        .setStyle(ButtonStyle.Success)
                );

            await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });

        } catch (error) {
            console.error('Error in shop command:', error);
            await interaction.reply({
                content: '❌ An error occurred while loading the shop.',
                ephemeral: true
            });
        }
    },

    async handlePurchase(interaction, itemId) {
        const userId = interaction.user.id;

        if (!SHOP_ITEMS[itemId]) {
            return await interaction.reply({
                content: '❌ Invalid item!',
                ephemeral: true
            });
        }

        const item = SHOP_ITEMS[itemId];

        try {
            const economy = await github.getEconomy();
            const inventory = await github.getInventory();

            if (!economy[userId]) {
                economy[userId] = { coins: 0, bucks: 0 };
            }

            if (!inventory[userId]) {
                inventory[userId] = {};
            }

            if (economy[userId].bucks < item.price) {
                return await interaction.reply({
                    content: `❌ You don't have enough DMP Bucks!\n\nYour balance: **${economy[userId].bucks} DMP Bucks**\nRequired: **${item.price} DMP Bucks**`,
                    ephemeral: true
                });
            }

            economy[userId].bucks -= item.price;

            const expiryDate = Date.now() + (7 * 24 * 60 * 60 * 1000);
            
            if (!inventory[userId][itemId]) {
                inventory[userId][itemId] = [];
            }

            inventory[userId][itemId].push({
                purchaseDate: Date.now(),
                expiryDate: expiryDate,
                used: false
            });

            await github.saveEconomy(economy);
            await github.saveInventory(inventory);

            const embed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle('✅ Purchase Successful!')
                .setDescription(`You purchased **${item.emoji} ${item.name}**!`)
                .addFields(
                    { name: 'New Balance', value: `💵 ${economy[userId].bucks} DMP Bucks` },
                    { name: 'Expires', value: `<t:${Math.floor(expiryDate / 1000)}:R>` }
                )
                .setFooter({ text: 'Use /inventory to see your items' })
                .setTimestamp();

            await interaction.reply({ embeds: [embed], ephemeral: true });

        } catch (error) {
            console.error('Error in purchase:', error);
            await interaction.reply({
                content: '❌ An error occurred during the purchase.',
                ephemeral: true
            });
        }
    }
};
