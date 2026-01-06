const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, StringSelectMenuBuilder } = require('discord.js');
const github = require('./github');

const GAMES = {
    typing_race: { name: 'Typing Race', emoji: '⌨️', minPlayers: 2, maxPlayers: 10 },
    wyr: { name: 'Would You Rather', emoji: '🤔', minPlayers: 10, maxPlayers: 10 },
    reaction: { name: 'Fast Reaction', emoji: '⚡', minPlayers: 2, maxPlayers: 10 },
    wordchain: { name: 'Word Chain', emoji: '🔗', minPlayers: 2, maxPlayers: 10 }
};

async function updateRoomEmbed(client, roomId, room) {
    try {
        const channel = await client.channels.fetch(room.channelId);
        const message = await channel.messages.fetch(room.messageId);
        
        const game = GAMES[room.gameId];
        const playerList = await Promise.all(
            room.players.map(async (playerId, index) => {
                try {
                    const user = await client.users.fetch(playerId);
                    return `${index + 1}. ${user.username}`;
                } catch {
                    return `${index + 1}. Unknown User`;
                }
            })
        );

        const owner = await client.users.fetch(room.ownerId);

        const embed = new EmbedBuilder()
            .setColor(room.status === 'waiting' ? '#0099ff' : '#00ff00')
            .setTitle(`${game.emoji} ${owner.username}'s ${game.name} Room`)
            .addFields(
                { name: `👥 Players (${room.players.length}/${room.maxPlayers})`, value: playerList.join('\n') || 'No players', inline: false },
                { name: '🔒 Password', value: room.password ? '✅ Protected' : '🔓 Open', inline: true },
                { name: '📊 Status', value: room.status === 'waiting' ? '⏳ Waiting' : '▶️ In Progress', inline: true }
            )
            .setFooter({ text: `Room ID: ${roomId}` })
            .setTimestamp();

        await message.edit({ embeds: [embed] });
    } catch (error) {
        console.error('Error updating room embed:', error);
    }
}

async function handleJoinRoom(interaction, roomId) {
    const userId = interaction.user.id;

    try {
        const activeRooms = await github.getActiveRooms();
        const room = activeRooms[roomId];

        if (!room) {
            return await interaction.reply({
                content: '❌ This room no longer exists!',
                ephemeral: true
            });
        }

        if (room.status !== 'waiting') {
            return await interaction.reply({
                content: '❌ This game has already started!',
                ephemeral: true
            });
        }

        if (room.players.includes(userId)) {
            return await interaction.reply({
                content: '❌ You are already in this room!',
                ephemeral: true
            });
        }

        if (room.players.length >= room.maxPlayers) {
            return await interaction.reply({
                content: '❌ This room is full!',
                ephemeral: true
            });
        }

        if (room.password) {
            const modal = new ModalBuilder()
                .setCustomId(`room_password_verify_${roomId}`)
                .setTitle('Enter Room Password');

            const passwordInput = new TextInputBuilder()
                .setCustomId('password')
                .setLabel('Password')
                .setStyle(TextInputStyle.Short)
                .setRequired(true);

            const actionRow = new ActionRowBuilder().addComponents(passwordInput);
            modal.addComponents(actionRow);

            return await interaction.showModal(modal);
        }

        room.players.push(userId);
        activeRooms[roomId] = room;
        await github.saveActiveRooms(activeRooms);

        await updateRoomEmbed(interaction.client, roomId, room);

        await interaction.reply({
            content: '✅ You joined the room!',
            ephemeral: true
        });

    } catch (error) {
        console.error('Error joining room:', error);
        await interaction.reply({
            content: '❌ An error occurred while joining the room.',
            ephemeral: true
        });
    }
}

async function handleVerifyPassword(interaction, roomId) {
    const userId = interaction.user.id;
    const password = interaction.fields.getTextInputValue('password');

    try {
        const activeRooms = await github.getActiveRooms();
        const room = activeRooms[roomId];

        if (!room) {
            return await interaction.reply({
                content: '❌ This room no longer exists!',
                ephemeral: true
            });
        }

        if (room.password !== password) {
            return await interaction.reply({
                content: '❌ Wrong password!',
                ephemeral: true
            });
        }

        if (room.players.includes(userId)) {
            return await interaction.reply({
                content: '❌ You are already in this room!',
                ephemeral: true
            });
        }

        if (room.players.length >= room.maxPlayers) {
            return await interaction.reply({
                content: '❌ This room is full!',
                ephemeral: true
            });
        }

        room.players.push(userId);
        activeRooms[roomId] = room;
        await github.saveActiveRooms(activeRooms);

        await updateRoomEmbed(interaction.client, roomId, room);

        await interaction.reply({
            content: '✅ You joined the room!',
            ephemeral: true
        });

    } catch (error) {
        console.error('Error verifying password:', error);
        await interaction.reply({
            content: '❌ An error occurred while joining the room.',
            ephemeral: true
        });
    }
}

async function handleLeaveRoom(interaction, roomId) {
    const userId = interaction.user.id;

    try {
        const activeRooms = await github.getActiveRooms();
        const room = activeRooms[roomId];

        if (!room) {
            return await interaction.reply({
                content: '❌ This room no longer exists!',
                ephemeral: true
            });
        }

        if (userId === room.ownerId) {
            return await interaction.reply({
                content: '❌ You cannot leave your own room! Use "Cancel Room" instead.',
                ephemeral: true
            });
        }

        if (!room.players.includes(userId)) {
            return await interaction.reply({
                content: '❌ You are not in this room!',
                ephemeral: true
            });
        }

        if (room.status !== 'waiting') {
            return await interaction.reply({
                content: '❌ You cannot leave while the game is in progress!',
                ephemeral: true
            });
        }

        room.players = room.players.filter(id => id !== userId);
        activeRooms[roomId] = room;
        await github.saveActiveRooms(activeRooms);

        await updateRoomEmbed(interaction.client, roomId, room);

        await interaction.reply({
            content: '✅ You left the room!',
            ephemeral: true
        });

    } catch (error) {
        console.error('Error leaving room:', error);
        await interaction.reply({
            content: '❌ An error occurred while leaving the room.',
            ephemeral: true
        });
    }
}

async function handleKickPlayer(interaction, roomId) {
    const userId = interaction.user.id;

    try {
        const activeRooms = await github.getActiveRooms();
        const room = activeRooms[roomId];

        if (!room) {
            return await interaction.reply({
                content: '❌ This room no longer exists!',
                ephemeral: true
            });
        }

        if (userId !== room.ownerId) {
            return await interaction.reply({
                content: '❌ Only the room owner can kick players!',
                ephemeral: true
            });
        }

        const kickablePlayers = room.players.filter(id => id !== room.ownerId);

        if (kickablePlayers.length === 0) {
            return await interaction.reply({
                content: '❌ There are no players to kick!',
                ephemeral: true
            });
        }

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId(`room_kick_select_${roomId}`)
            .setPlaceholder('Select a player to kick');

        for (const playerId of kickablePlayers) {
            try {
                const user = await interaction.client.users.fetch(playerId);
                selectMenu.addOptions({
                    label: user.username,
                    value: playerId
                });
            } catch {}
        }

        const row = new ActionRowBuilder().addComponents(selectMenu);

        await interaction.reply({
            content: '👢 Select a player to kick:',
            components: [row],
            ephemeral: true
        });

    } catch (error) {
        console.error('Error in kick menu:', error);
        await interaction.reply({
            content: '❌ An error occurred.',
            ephemeral: true
        });
    }
}

async function handleKickSelect(interaction, roomId) {
    const kickedUserId = interaction.values[0];

    try {
        const activeRooms = await github.getActiveRooms();
        const room = activeRooms[roomId];

        if (!room) {
            return await interaction.update({
                content: '❌ This room no longer exists!',
                components: []
            });
        }

        room.players = room.players.filter(id => id !== kickedUserId);
        activeRooms[roomId] = room;
        await github.saveActiveRooms(activeRooms);

        await updateRoomEmbed(interaction.client, roomId, room);

        const kickedUser = await interaction.client.users.fetch(kickedUserId);
        await interaction.update({
            content: `✅ Kicked ${kickedUser.username} from the room!`,
            components: []
        });

    } catch (error) {
        console.error('Error kicking player:', error);
        await interaction.update({
            content: '❌ An error occurred while kicking the player.',
            components: []
        });
    }
}

async function handleRoomSettings(interaction, roomId) {
    const userId = interaction.user.id;

    try {
        const activeRooms = await github.getActiveRooms();
        const room = activeRooms[roomId];

        if (!room) {
            return await interaction.reply({
                content: '❌ This room no longer exists!',
                ephemeral: true
            });
        }

        if (userId !== room.ownerId) {
            return await interaction.reply({
                content: '❌ Only the room owner can change settings!',
                ephemeral: true
            });
        }

        const changePasswordButton = new ButtonBuilder()
            .setCustomId(`room_change_password_${roomId}`)
            .setLabel('Change Password')
            .setEmoji('🔒')
            .setStyle(ButtonStyle.Secondary);

        const removePasswordButton = new ButtonBuilder()
            .setCustomId(`room_remove_password_${roomId}`)
            .setLabel('Remove Password')
            .setEmoji('🔓')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(!room.password);

        const row = new ActionRowBuilder().addComponents(changePasswordButton, removePasswordButton);

        await interaction.reply({
            content: '⚙️ Room Settings:',
            components: [row],
            ephemeral: true
        });

    } catch (error) {
        console.error('Error in room settings:', error);
        await interaction.reply({
            content: '❌ An error occurred.',
            ephemeral: true
        });
    }
}

async function handleChangePassword(interaction, roomId) {
    const modal = new ModalBuilder()
        .setCustomId(`room_new_password_${roomId}`)
        .setTitle('Change Room Password');

    const passwordInput = new TextInputBuilder()
        .setCustomId('password')
        .setLabel('New Password')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMinLength(1)
        .setMaxLength(50);

    const actionRow = new ActionRowBuilder().addComponents(passwordInput);
    modal.addComponents(actionRow);

    await interaction.showModal(modal);
}

async function handleNewPassword(interaction, roomId) {
    const newPassword = interaction.fields.getTextInputValue('password');

    try {
        const activeRooms = await github.getActiveRooms();
        const room = activeRooms[roomId];

        if (!room) {
            return await interaction.reply({
                content: '❌ This room no longer exists!',
                ephemeral: true
            });
        }

        room.password = newPassword;
        activeRooms[roomId] = room;
        await github.saveActiveRooms(activeRooms);

        await updateRoomEmbed(interaction.client, roomId, room);

        await interaction.reply({
            content: `✅ Password changed to: **${newPassword}**`,
            ephemeral: true
        });

    } catch (error) {
        console.error('Error changing password:', error);
        await interaction.reply({
            content: '❌ An error occurred.',
            ephemeral: true
        });
    }
}

async function handleRemovePassword(interaction, roomId) {
    try {
        const activeRooms = await github.getActiveRooms();
        const room = activeRooms[roomId];

        if (!room) {
            return await interaction.reply({
                content: '❌ This room no longer exists!',
                ephemeral: true
            });
        }

        room.password = null;
        activeRooms[roomId] = room;
        await github.saveActiveRooms(activeRooms);

        await updateRoomEmbed(interaction.client, roomId, room);

        await interaction.reply({
            content: '✅ Password removed! Room is now open.',
            ephemeral: true
        });

    } catch (error) {
        console.error('Error removing password:', error);
        await interaction.reply({
            content: '❌ An error occurred.',
            ephemeral: true
        });
    }
}

async function handleCancelRoom(interaction, roomId) {
    const userId = interaction.user.id;

    try {
        const activeRooms = await github.getActiveRooms();
        const room = activeRooms[roomId];

        if (!room) {
            return await interaction.reply({
                content: '❌ This room no longer exists!',
                ephemeral: true
            });
        }

        if (userId !== room.ownerId) {
            return await interaction.reply({
                content: '❌ Only the room owner can cancel the room!',
                ephemeral: true
            });
        }

        const channel = await interaction.client.channels.fetch(room.channelId);
        const message = await channel.messages.fetch(room.messageId);
        await message.delete();

        delete activeRooms[roomId];
        await github.saveActiveRooms(activeRooms);

        await interaction.reply({
            content: '✅ Room cancelled successfully!',
            ephemeral: true
        });

    } catch (error) {
        console.error('Error cancelling room:', error);
        await interaction.reply({
            content: '❌ An error occurred while cancelling the room.',
            ephemeral: true
        });
    }
}

async function handleStartGame(interaction, roomId) {
    const userId = interaction.user.id;

    try {
        const activeRooms = await github.getActiveRooms();
        const room = activeRooms[roomId];

        if (!room) {
            return await interaction.reply({
                content: '❌ This room no longer exists!',
                ephemeral: true
            });
        }

        if (userId !== room.ownerId) {
            return await interaction.reply({
                content: '❌ Only the room owner can start the game!',
                ephemeral: true
            });
        }

        const game = GAMES[room.gameId];

        if (room.players.length < game.minPlayers) {
            return await interaction.reply({
                content: `❌ Not enough players! This game requires at least ${game.minPlayers} players.`,
                ephemeral: true
            });
        }

        room.status = 'in_progress';
        activeRooms[roomId] = room;
        await github.saveActiveRooms(activeRooms);

        await updateRoomEmbed(interaction.client, roomId, room);

        // Defer the interaction update before starting the game
        await interaction.deferUpdate();

        // Start the game and pass the interaction
        if (room.gameId === 'typing_race') {
            const typingRace = require('../games/typingrace');
            await typingRace.startGame(interaction.client, roomId, room, interaction);
        } else if (room.gameId === 'wyr') {
            const wyr = require('../games/wyr');
            await wyr.startGame(interaction.client, roomId, room, interaction);
        } else if (room.gameId === 'reaction') {
            const reaction = require('../games/reaction');
            await reaction.startGame(interaction.client, roomId, room, interaction);
        } else if (room.gameId === 'wordchain') {
            const wordchain = require('../games/wordchain');
            await wordchain.startGame(interaction.client, roomId, room, interaction);
        }

    } catch (error) {
        console.error('Error starting game:', error);
        
        // Only try to reply if we haven't acknowledged the interaction yet
        try {
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: '❌ An error occurred while starting the game.',
                    ephemeral: true
                });
            } else if (interaction.deferred) {
                await interaction.followUp({
                    content: '❌ An error occurred while starting the game.',
                    ephemeral: true
                });
            }
        } catch (replyError) {
            console.error('Failed to send error message:', replyError);
        }
    }
}

async function handleGameSelect(interaction) {
    try {
        await interaction.deferUpdate();
        
        const selectedGame = interaction.values[0];
        const roomId = interaction.message.id;
        
        const activeRooms = await github.getActiveRooms();
        const room = activeRooms[roomId];
        
        if (!room) {
            return await interaction.followUp({
                content: '❌ Room not found!',
                ephemeral: true
            });
        }
        
        if (room.ownerId !== interaction.user.id) {
            return await interaction.followUp({
                content: '❌ Only the room owner can select the game!',
                ephemeral: true
            });
        }
        
        room.gameId = selectedGame;
        await github.saveActiveRooms(activeRooms);
        
        await updateRoomEmbed(interaction.client, roomId, room);
        
        const game = GAMES[selectedGame];
        await interaction.followUp({
            content: `✅ Game set to: **${game.emoji} ${game.name}**`,
            ephemeral: true
        });
        
    } catch (error) {
        console.error('Error handling game selection:', error);
        try {
            await interaction.followUp({
                content: '❌ Error selecting game!',
                ephemeral: true
            });
        } catch (e) {
            console.error('Failed to send error message:', e);
        }
    }
}

module.exports = {
    updateRoomEmbed,
    handleJoinRoom,
    handleVerifyPassword,
    handleLeaveRoom,
    handleKickPlayer,
    handleKickSelect,
    handleRoomSettings,
    handleChangePassword,
    handleNewPassword,
    handleRemovePassword,
    handleCancelRoom,
    handleStartGame,
    handleGameSelect,
    GAMES
};
