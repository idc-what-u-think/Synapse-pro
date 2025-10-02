const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const github = require('../utils/github');

const GAMES = {
    typing_race: { name: 'Typing Race', emoji: '⌨️', description: 'Type the phrase as fast as you can!' },
    wyr: { name: 'Would You Rather', emoji: '🤔', description: 'Vote and survive to win!' },
    reaction: { name: 'Fast Reaction', emoji: '⚡', description: 'React with the correct emoji!' }
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('use')
        .setDescription('Use an item from your inventory')
        .addStringOption(option =>
            option
                .setName('item')
                .setDescription('Item to use')
                .setRequired(true)
                .addChoices(
                    { name: 'Room Card', value: 'roomcard' }
                )
        ),

    async execute(interaction) {
        const userId = interaction.user.id;
        const item = interaction.options.getString('item');

        if (item !== 'roomcard') {
            return await interaction.reply({
                content: '❌ Invalid item!',
                ephemeral: true
            });
        }

        const gameChannelId = process.env.GAME_CHANNEL_ID;
        if (!gameChannelId) {
            return await interaction.reply({
                content: '❌ Game channel not configured. Please contact an administrator.',
                ephemeral: true
            });
        }

        if (interaction.channel.id !== gameChannelId) {
            return await interaction.reply({
                content: `❌ You can only use Room Cards in the game channel: <#${gameChannelId}>`,
                ephemeral: true
            });
        }

        try {
            const inventory = await github.getInventory();
            const activeRooms = await github.getActiveRooms();

            if (!inventory[userId] || !inventory[userId].roomcard || inventory[userId].roomcard.length === 0) {
                return await interaction.reply({
                    content: '❌ You don\'t have any Room Cards!\n\nVisit `/shop` to purchase one.',
                    ephemeral: true
                });
            }

            if (activeRooms[userId]) {
                return await interaction.reply({
                    content: '❌ You already have an active room! Close it before creating a new one.',
                    ephemeral: true
                });
            }

            const now = Date.now();
            const validCards = inventory[userId].roomcard.filter(card => 
                !card.used && card.expiryDate > now
            );

            if (validCards.length === 0) {
                return await interaction.reply({
                    content: '❌ You don\'t have any valid Room Cards!\n\nAll your cards have expired or been used. Visit `/shop` to purchase more.',
                    ephemeral: true
                });
            }

            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId('select_game')
                .setPlaceholder('Choose a game')
                .addOptions(
                    Object.entries(GAMES).map(([id, game]) => ({
                        label: game.name,
                        description: game.description,
                        value: id,
                        emoji: game.emoji
                    }))
                );

            const row = new ActionRowBuilder().addComponents(selectMenu);

            await interaction.reply({
                content: '🎮 Select a game to create a room:',
                components: [row],
                ephemeral: true
            });

        } catch (error) {
            console.error('Error in use command:', error);
            await interaction.reply({
                content: '❌ An error occurred while using the item.',
                ephemeral: true
            });
        }
    },

    async handleGameSelection(interaction) {
        const userId = interaction.user.id;
        const gameId = interaction.values[0];
        const game = GAMES[gameId];

        const passwordButton = new ButtonBuilder()
            .setCustomId('room_add_password')
            .setLabel('Add Password')
            .setEmoji('🔒')
            .setStyle(ButtonStyle.Secondary);

        const noPasswordButton = new ButtonBuilder()
            .setCustomId('room_no_password')
            .setLabel('No Password')
            .setEmoji('🔓')
            .setStyle(ButtonStyle.Primary);

        const row = new ActionRowBuilder().addComponents(passwordButton, noPasswordButton);

        await interaction.update({
            content: `${game.emoji} **${game.name}** selected!\n\nWould you like to add a password to your room?`,
            components: [row],
            ephemeral: true
        });

        const filter = i => i.user.id === userId;
        const collector = interaction.channel.createMessageComponentCollector({ filter, time: 60000, max: 1 });

        collector.on('collect', async i => {
            if (i.customId === 'room_add_password') {
                const modal = new ModalBuilder()
                    .setCustomId(`room_password_modal_${gameId}`)
                    .setTitle('Set Room Password');

                const passwordInput = new TextInputBuilder()
                    .setCustomId('password')
                    .setLabel('Enter Room Password')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true)
                    .setMinLength(1)
                    .setMaxLength(50);

                const actionRow = new ActionRowBuilder().addComponents(passwordInput);
                modal.addComponents(actionRow);

                await i.showModal(modal);
            } else if (i.customId === 'room_no_password') {
                await this.createRoom(i, gameId, null);
            }
        });
    },

    async handlePasswordModal(interaction, gameId) {
        const password = interaction.fields.getFieldValue('password');
        await this.createRoom(interaction, gameId, password);
    },

    async createRoom(interaction, gameId, password) {
        const userId = interaction.user.id;
        const game = GAMES[gameId];

        try {
            const inventory = await github.getInventory();
            const activeRooms = await github.getActiveRooms();

            const now = Date.now();
            const validCards = inventory[userId].roomcard.filter(card => 
                !card.used && card.expiryDate > now
            );

            if (validCards.length === 0) {
                return await interaction.reply({
                    content: '❌ No valid Room Cards found!',
                    ephemeral: true
                });
            }

            validCards[0].used = true;
            await github.saveInventory(inventory);

            const roomId = `${userId}_${Date.now()}`;
            const embed = new EmbedBuilder()
                .setColor('#0099ff')
                .setTitle(`${game.emoji} ${interaction.user.username}'s ${game.name} Room`)
                .setDescription(game.description)
                .addFields(
                    { name: '👥 Players', value: `1. ${interaction.user.username}`, inline: false },
                    { name: '🔒 Password', value: password ? '✅ Protected' : '🔓 Open', inline: true },
                    { name: '📊 Status', value: '⏳ Waiting', inline: true }
                )
                .setFooter({ text: `Room ID: ${roomId}` })
                .setTimestamp();

            const joinButton = new ButtonBuilder()
                .setCustomId(`room_join_${roomId}`)
                .setLabel('Join Room')
                .setEmoji('🚪')
                .setStyle(ButtonStyle.Success);

            const leaveButton = new ButtonBuilder()
                .setCustomId(`room_leave_${roomId}`)
                .setLabel('Leave')
                .setEmoji('🚪')
                .setStyle(ButtonStyle.Danger);

            const kickButton = new ButtonBuilder()
                .setCustomId(`room_kick_${roomId}`)
                .setLabel('Kick Player')
                .setEmoji('👢')
                .setStyle(ButtonStyle.Secondary);

            const settingsButton = new ButtonBuilder()
                .setCustomId(`room_settings_${roomId}`)
                .setLabel('Settings')
                .setEmoji('⚙️')
                .setStyle(ButtonStyle.Secondary);

            const startButton = new ButtonBuilder()
                .setCustomId(`room_start_${roomId}`)
                .setLabel('Start Game')
                .setEmoji('▶️')
                .setStyle(ButtonStyle.Primary);

            const cancelButton = new ButtonBuilder()
                .setCustomId(`room_cancel_${roomId}`)
                .setLabel('Cancel Room')
                .setEmoji('❌')
                .setStyle(ButtonStyle.Danger);

            const row1 = new ActionRowBuilder().addComponents(joinButton, leaveButton);
            const row2 = new ActionRowBuilder().addComponents(kickButton, settingsButton, startButton, cancelButton);

            const message = await interaction.channel.send({
                embeds: [embed],
                components: [row1, row2]
            });

            activeRooms[roomId] = {
                messageId: message.id,
                channelId: interaction.channel.id,
                ownerId: userId,
                gameId: gameId,
                password: password,
                players: [userId],
                maxPlayers: 10,
                minPlayers: 2,
                status: 'waiting',
                createdAt: Date.now()
            };

            await github.saveActiveRooms(activeRooms);

            await interaction.reply({
                content: '✅ Room created successfully!',
                ephemeral: true
            });

        } catch (error) {
            console.error('Error creating room:', error);
            await interaction.reply({
                content: '❌ An error occurred while creating the room.',
                ephemeral: true
            });
        }
    }
};
