const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, PermissionFlagsBits } = require('discord.js');
const github = require('../utils/github');

const GAMES = {
    typing_race: { name: 'Typing Race', emoji: '⌨️', description: 'Type the phrase as fast as you can!' },
    wyr: { name: 'Would You Rather', emoji: '🤔', description: 'Vote and survive to win!' },
    reaction: { name: 'Fast Reaction', emoji: '⚡', description: 'React with the correct emoji!' },
    wordchain: { name: 'Word Chain', emoji: '🔗', description: 'Chain words together using last letters!' },
    questions: { name: 'Questions', emoji: '📝', description: 'Answer trivia questions - first to 10 wins!' }
};

const DIFFICULTIES = {
    easy: { name: 'Easy', emoji: '🟢', description: 'Basic questions everyone knows' },
    normal: { name: 'Normal', emoji: '🔵', description: 'Moderate general knowledge' },
    hard: { name: 'Hard', emoji: '🟠', description: 'Challenging trivia' },
    difficult: { name: 'Difficult', emoji: '🔴', description: 'Very tough questions' },
    extreme: { name: 'Extreme', emoji: '⚫', description: 'Expert-level trivia' }
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

        try {
            const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);
            
            const inventory = await github.getInventory();
            const activeRooms = await github.getActiveRooms();

            if (!isAdmin) {
                if (!inventory[userId] || !inventory[userId].roomcard || inventory[userId].roomcard.length === 0) {
                    return await interaction.reply({
                        content: '❌ You don\'t have any Room Cards!\n\nVisit `/shop` to purchase one.',
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
            }

            const userHasActiveRoom = Object.values(activeRooms).some(room => room.ownerId === userId);
            if (userHasActiveRoom) {
                return await interaction.reply({
                    content: '❌ You already have an active room! Close it before creating a new one.',
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

            const adminNote = isAdmin ? '\n\n👑 **Admin Access** - No room card required!' : '';

            await interaction.reply({
                content: `🎮 Select a game to create a room:${adminNote}`,
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

        try {
            // If Questions game, show difficulty selection
            if (gameId === 'questions') {
                const difficultyMenu = new StringSelectMenuBuilder()
                    .setCustomId('select_difficulty_questions')
                    .setPlaceholder('Choose difficulty level')
                    .addOptions(
                        Object.entries(DIFFICULTIES).map(([id, diff]) => ({
                            label: diff.name,
                            description: diff.description,
                            value: id,
                            emoji: diff.emoji
                        }))
                    );

                const row = new ActionRowBuilder().addComponents(difficultyMenu);

                await interaction.update({
                    content: `📝 **Questions** selected!\n\nSelect difficulty level:`,
                    components: [row]
                });
            } else {
                // Other games - show password option
                const passwordButton = new ButtonBuilder()
                    .setCustomId(`room_add_password_${gameId}`)
                    .setLabel('Add Password')
                    .setEmoji('🔒')
                    .setStyle(ButtonStyle.Secondary);

                const noPasswordButton = new ButtonBuilder()
                    .setCustomId(`room_no_password_${gameId}`)
                    .setLabel('No Password')
                    .setEmoji('🔓')
                    .setStyle(ButtonStyle.Primary);

                const row = new ActionRowBuilder().addComponents(passwordButton, noPasswordButton);

                await interaction.update({
                    content: `${game.emoji} **${game.name}** selected!\n\nWould you like to add a password to your room?`,
                    components: [row]
                });
            }

        } catch (error) {
            console.error('Error handling game selection:', error);
        }
    },

    async handleDifficultySelection(interaction) {
        const difficulty = interaction.values[0];
        const diffInfo = DIFFICULTIES[difficulty];

        try {
            const passwordButton = new ButtonBuilder()
                .setCustomId(`room_add_password_questions_${difficulty}`)
                .setLabel('Add Password')
                .setEmoji('🔒')
                .setStyle(ButtonStyle.Secondary);

            const noPasswordButton = new ButtonBuilder()
                .setCustomId(`room_no_password_questions_${difficulty}`)
                .setLabel('No Password')
                .setEmoji('🔓')
                .setStyle(ButtonStyle.Primary);

            const row = new ActionRowBuilder().addComponents(passwordButton, noPasswordButton);

            await interaction.update({
                content: `${diffInfo.emoji} **${diffInfo.name}** difficulty selected!\n\nWould you like to add a password to your room?`,
                components: [row]
            });

        } catch (error) {
            console.error('Error handling difficulty selection:', error);
        }
    },

    async handlePasswordButton(interaction, gameId, hasPassword) {
        if (hasPassword) {
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

            await interaction.showModal(modal);
        } else {
            await this.createRoom(interaction, gameId, null);
        }
    },

    async handlePasswordModal(interaction, gameId) {
        const password = interaction.fields.getTextInputValue('password');
        await this.createRoom(interaction, gameId, password);
    },

    async createRoom(interaction, gameIdWithDifficulty, password) {
        const userId = interaction.user.id;
        
        // Extract gameId and difficulty (for Questions game)
        let gameId = gameIdWithDifficulty;
        let difficulty = null;
        
        if (gameIdWithDifficulty.startsWith('questions_')) {
            gameId = 'questions';
            difficulty = gameIdWithDifficulty.split('_')[1];
        }
        
        const game = GAMES[gameId];

        try {
            const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);
            
            const inventory = await github.getInventory();
            const activeRooms = await github.getActiveRooms();

            if (!isAdmin) {
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
            }

            const roomId = `${userId}_${Date.now()}`;
            const embed = new EmbedBuilder()
                .setColor('#0099ff')
                .setTitle(`${game.emoji} ${interaction.user.username}'s ${game.name} Room`)
                .setDescription(game.description)
                .addFields(
                    { name: '👥 Players', value: `1. ${interaction.user.username}`, inline: false },
                    { name: '🔒 Password', value: password ? '✅ Protected' : '🔓 Open', inline: true },
                    { name: '📊 Status', value: '⏳ Waiting', inline: true }
                );
            
            // Add difficulty field for Questions game
            if (gameId === 'questions' && difficulty) {
                const diffInfo = DIFFICULTIES[difficulty];
                embed.addFields({
                    name: '⚙️ Difficulty',
                    value: `${diffInfo.emoji} ${diffInfo.name}`,
                    inline: true
                });
            }
            
            embed.setFooter({ text: `Room ID: ${roomId}` })
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
                difficulty: difficulty, // Store difficulty for Questions game
                password: password,
                players: [userId],
                maxPlayers: 10,
                minPlayers: 2,
                status: 'waiting',
                createdAt: Date.now()
            };

            await github.saveActiveRooms(activeRooms);

            let replyContent;
            if (isAdmin) {
                replyContent = password 
                    ? `✅ Room created successfully with password: **${password}**\n👑 Admin access - No room card used!`
                    : '✅ Room created successfully!\n👑 Admin access - No room card used!';
            } else {
                replyContent = password 
                    ? `✅ Room created successfully with password: **${password}**`
                    : '✅ Room created successfully!';
            }

            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({
                    content: replyContent,
                    ephemeral: true
                });
            } else {
                await interaction.reply({
                    content: replyContent,
                    ephemeral: true
                });
            }

        } catch (error) {
            console.error('Error creating room:', error);
            
            const errorMessage = {
                content: '❌ An error occurred while creating the room.',
                ephemeral: true
            };

            try {
                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp(errorMessage);
                } else {
                    await interaction.reply(errorMessage);
                }
            } catch (e) {
                console.error('Failed to send error message:', e);
            }
        }
    }
};
