const { EmbedBuilder } = require('discord.js');
const github = require('../utils/github');

const TURN_TIME = 12000; // 12 seconds

async function validateWord(word) {
    try {
        const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${word.toLowerCase()}`);
        return response.ok;
    } catch (error) {
        console.error('Error validating word:', error);
        return false;
    }
}

// New function to check if any words exist starting with given letters
async function checkWordsExist(letters) {
    try {
        // Try a few common words that might start with these letters
        const commonPrefixes = [
            letters,
            letters + 'a',
            letters + 'e',
            letters + 'i',
            letters + 'o',
            letters + 'u'
        ];
        
        for (const prefix of commonPrefixes) {
            const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${prefix.toLowerCase()}`);
            if (response.ok) {
                return true;
            }
        }
        return false;
    } catch (error) {
        console.error('Error checking if words exist:', error);
        return false;
    }
}

// Improved function to get valid letter count
async function getValidLetterCount(word) {
    const wordLength = word.length;
    
    // Try 3 letters first (if word is long enough)
    if (wordLength >= 3) {
        const threeLetters = word.slice(-3);
        const hasWords = await checkWordsExist(threeLetters);
        if (hasWords) {
            return { count: 3, letters: threeLetters };
        }
    }
    
    // Try 2 letters next (if word is long enough)
    if (wordLength >= 2) {
        const twoLetters = word.slice(-2);
        const hasWords = await checkWordsExist(twoLetters);
        if (hasWords) {
            return { count: 2, letters: twoLetters };
        }
    }
    
    // Fall back to 1 letter (always should have words)
    const oneLetter = word.slice(-1);
    return { count: 1, letters: oneLetter };
}

async function startGame(client, roomId, room, interaction) {
    try {
        const channel = await client.channels.fetch(room.channelId);
        
        const embed = new EmbedBuilder()
            .setColor('#ffcc00')
            .setTitle('Word Chain - Starting!')
            .setDescription('Get ready! The game will start in 3 seconds...');
            
        await channel.send({ embeds: [embed] });
        
        if (interaction && !interaction.replied && !interaction.deferred) {
            await interaction.deferUpdate();
        }
        
        await new Promise(resolve => setTimeout(resolve, 3000));
        await playGame(client, roomId, room);
        
    } catch (error) {
        console.error('Error starting word chain game:', error);
    }
}

async function playGame(client, roomId, room) {
    try {
        const channel = await client.channels.fetch(room.channelId);
        const players = [...room.players];
        const usedWords = new Set();
        let currentPlayerIndex = 0;
        let gameActive = true;
        
        // Random starting letter
        const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        let currentLetters = alphabet[Math.floor(Math.random() * alphabet.length)];
        let letterCount = 1;
        
        const startEmbed = new EmbedBuilder()
            .setColor('#00ff00')
            .setTitle('Word Chain Game Started!')
            .setDescription(`First player must create a word starting with: **${currentLetters}**\n\nYou have 12 seconds per turn!`);
            
        await channel.send({ embeds: [startEmbed] });
        
        while (gameActive && players.length > 1) {
            const currentPlayerId = players[currentPlayerIndex];
            const currentPlayer = await client.users.fetch(currentPlayerId);
            
            const turnEmbed = new EmbedBuilder()
                .setColor('#0099ff')
                .setTitle(`${currentPlayer.username}'s Turn`)
                .setDescription(`Type a word starting with: **${currentLetters}**\n\nTime limit: 12 seconds`)
                .addFields({
                    name: 'Remaining Players',
                    value: players.map(p => `<@${p}>`).join(', ')
                });
                
            await channel.send({ embeds: [turnEmbed] });
            
            const filter = m => m.author.id === currentPlayerId && !m.author.bot;
            
            try {
                const collected = await channel.awaitMessages({
                    filter,
                    max: 1,
                    time: TURN_TIME,
                    errors: ['time']
                });
                
                const message = collected.first();
                const word = message.content.trim().toLowerCase();
                
                // Check if word starts with required letters
                if (!word.startsWith(currentLetters.toLowerCase())) {
                    await channel.send(`<@${currentPlayerId}> Your word doesn't start with **${currentLetters}**. You are eliminated!`);
                    players.splice(currentPlayerIndex, 1);
                    
                    if (currentPlayerIndex >= players.length) {
                        currentPlayerIndex = 0;
                    }
                    continue;
                }
                
                // Check if word was already used
                if (usedWords.has(word)) {
                    await channel.send(`<@${currentPlayerId}> That word was already used. You are eliminated!`);
                    players.splice(currentPlayerIndex, 1);
                    
                    if (currentPlayerIndex >= players.length) {
                        currentPlayerIndex = 0;
                    }
                    continue;
                }
                
                // Validate word with dictionary API
                const isValid = await validateWord(word);
                
                if (!isValid) {
                    await channel.send(`<@${currentPlayerId}> **${word}** is not a valid English word. You are eliminated!`);
                    players.splice(currentPlayerIndex, 1);
                    
                    if (currentPlayerIndex >= players.length) {
                        currentPlayerIndex = 0;
                    }
                    continue;
                }
                
                // Word is valid
                usedWords.add(word);
                
                // Get valid letter count and letters (IMPROVED)
                const result = await getValidLetterCount(word);
                letterCount = result.count;
                currentLetters = result.letters.toUpperCase();
                
                const successEmbed = new EmbedBuilder()
                    .setColor('#00ff00')
                    .setDescription(`<@${currentPlayerId}> played: **${word}**\n\nNext word must start with: **${currentLetters}** (last ${letterCount} letter${letterCount > 1 ? 's' : ''})`);
                    
                await channel.send({ embeds: [successEmbed] });
                
                // Move to next player
                currentPlayerIndex = (currentPlayerIndex + 1) % players.length;
                
            } catch (error) {
                // Time ran out
                await channel.send(`<@${currentPlayerId}> Time's up! You are eliminated!`);
                players.splice(currentPlayerIndex, 1);
                
                if (currentPlayerIndex >= players.length) {
                    currentPlayerIndex = 0;
                }
            }
        }
        
        // Game over
        if (players.length === 1) {
            const winnerId = players[0];
            const winner = await client.users.fetch(winnerId);
            
            const winEmbed = new EmbedBuilder()
                .setColor('#FFD700')
                .setTitle('Game Over!')
                .setDescription(`<@${winnerId}> wins, GG, you are the GOAT`);
                
            await channel.send({ embeds: [winEmbed] });
        } else {
            await channel.send('Game ended with no winner.');
        }
        
        // Clean up room
        const activeRooms = await github.getActiveRooms();
        delete activeRooms[roomId];
        await github.saveActiveRooms(activeRooms);
        
        try {
            const roomMessage = await channel.messages.fetch(room.messageId);
            await roomMessage.delete();
        } catch (deleteError) {
            console.error('Error deleting room message:', deleteError);
        }
        
    } catch (error) {
        console.error('Error in word chain game:', error);
    }
}

module.exports = {
    startGame
};
