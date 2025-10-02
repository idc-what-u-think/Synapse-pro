const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const github = require('../utils/github');

const ITEM_NAMES = {
    roomcard: { name: 'Room Card', emoji: '🎮' }
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('inventory')
        .setDescription('View your inventory'),

    async execute(interaction) {
        const userId = interaction.user.id;

        try {
            const inventory = await github.getInventory();

            if (!inventory[userId]) {
                inventory[userId] = {};
            }

            // Clean up expired items
            let hasExpired = false;
            const now = Date.now();

            for (const itemId in inventory[userId]) {
                const items = inventory[userId][itemId];
                const validItems = items.filter(item => item.expiryDate > now);
                
                if (validItems.length !== items.length) {
                    hasExpired = true;
                }

                if (validItems.length > 0) {
                    inventory[userId][itemId] = validItems;
                } else {
                    delete inventory[userId][itemId];
                }
            }

            // Save if items were cleaned
            if (hasExpired) {
                await github.saveInventory(inventory);
            }

            // Check if inventory is empty
            const hasItems = Object.keys(inventory[userId]).length > 0;

            if (!hasItems) {
                const emptyEmbed = new EmbedBuilder()
                    .setColor('#ff9900')
                    .setTitle('📦 Your Inventory')
                    .setDescription('Your inventory is empty!\n\nVisit the shop with `/shop` to purchase items.')
                    .setTimestamp();

                return await interaction.reply({ embeds: [emptyEmbed], ephemeral: true });
            }

            // Build inventory display
            const embed = new EmbedBuilder()
                .setColor('#0099ff')
                .setTitle('📦 Your Inventory')
                .setDescription('Here are your active items:')
                .setTimestamp();

            for (const itemId in inventory[userId]) {
                const items = inventory[userId][itemId];
                const itemInfo = ITEM_NAMES[itemId] || { name: itemId, emoji: '📦' };

                const itemDetails = items.map((item, index) => {
                    const status = item.used ? '✅ Used' : '⏳ Active';
                    const expiry = `<t:${Math.floor(item.expiryDate / 1000)}:R>`;
                    return `${index + 1}. ${status} - Expires ${expiry}`;
                }).join('\n');

                embed.addFields({
                    name: `${itemInfo.emoji} ${itemInfo.name} (${items.length})`,
                    value: itemDetails,
                    inline: false
                });
            }

            embed.setFooter({ text: 'Expired items are automatically removed' });

            await interaction.reply({ embeds: [embed], ephemeral: true });

        } catch (error) {
            console.error('Error in inventory command:', error);
            await interaction.reply({
                content: '❌ An error occurred while fetching your inventory.',
                ephemeral: true
            });
        }
    }
};
