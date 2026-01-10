const { EmbedBuilder } = require('discord.js');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const github = require('../utils/github');

const GEMINI_KEYS = [
    process.env.GEMINI_API_KEY_1,
    process.env.GEMINI_API_KEY_2,
    process.env.GEMINI_API_KEY_3,
    process.env.GEMINI_API_KEY_4,
    process.env.GEMINI_API_KEY_5
].filter(key => key);

const aiInstances = GEMINI_KEYS.map((key, index) => {
    const genAI = new GoogleGenerativeAI(key);
    return {
        model: genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' }),
        key: key.substring(0, 8) + '...',
        index: index + 1
    };
});

let currentKeyIndex = 0;

function getNextAIInstance() {
    if (aiInstances.length === 0) {
        throw new Error('No Gemini API keys available');
    }
    
    const instance = aiInstances[currentKeyIndex];
    currentKeyIndex = (currentKeyIndex + 1) % aiInstances.length;
    return instance;
}

// Active game sessions tracker
const activeGames = new Map();

async function generateQuestion(difficulty) {
    try {
        const aiInstance = getNextAIInstance();
        
        let difficultyPrompt;
        switch(difficulty) {
            case 'easy':
                difficultyPrompt = 'very basic general knowledge that most people know (e.g., "What color is the sky?", "What is 2+2?")';
                break;
            case 'normal':
                difficultyPrompt = 'moderate general knowledge (e.g., "What is the capital of France?", "Who painted the Mona Lisa?")';
                break;
            case 'hard':
                difficultyPrompt = 'challenging but fair trivia (e.g., "What year did World War II end?", "What is the largest ocean?")';
                break;
            case 'difficult':
                difficultyPrompt = 'difficult trivia requiring good knowledge (e.g., "What is the chemical symbol for gold?", "Who wrote 1984?")';
                break;
            case 'extreme':
                difficultyPrompt = 'very challenging trivia for experts (e.g., "What is the capital of Kyrgyzstan?", "Who was the 13th US President?")';
                break;
            default:
                difficultyPrompt = 'moderate general knowledge';
        }
        
        const prompt = `Generate a single trivia question at ${difficultyPrompt} difficulty level.

Categories: Mix of general knowledge, history, geography, science, pop culture, sports, math, etc.

Format your response EXACTLY like this:
QUESTION: [your question here]
ANSWER: [correct answer]
ALTERNATIVES: [alternative acceptable answers separated by commas, if any]

Example:
QUESTION: What is the capital of the United States?
ANSWER: Washington D.C.
ALTERNATIVES: Washington DC, DC, Washington

Make it interesting and varied!`;

        const result = await aiInstance.model.generateContent(prompt);
        const responseText = result.response.text().trim();
        
        // Parse response
        const questionMatch = responseText.match(/QUESTION:\s*(.+)/i);
        const answerMatch = responseText.match(/ANSWER:\s*(.+)/i);
        const alternativesMatch = responseText.match(/ALTERNATIVES:\s*(.+)/i);
        
        if (!questionMatch || !answerMatch) {
            throw new Error('Failed to parse AI response');
        }
        
        const question = questionMatch[1].trim();
        const answer = answerMatch[1].trim();
        const alternatives = alternativesMatch 
            ? alternativesMatch[1].split(',').map(a => a.trim()).filter(a => a)
            : [];
        
        console.log(`[Questions] Generated ${difficulty} question: "${question}"`);
        console.log(`[Questions] Answer: "${answer}", Alternatives: [${alternatives.join(', ')}]`);
        
        return { question, answer, alternatives };
        
    } catch (error) {
        console.error('Error generating question:', error);
        throw error;
    }
}

async function verifyAnswer(userAnswer, correctAnswer, alternatives) {
    try {
        const aiInstance = getNextAIInstance();
        
        const prompt = `You are an answer verification system. Determine if the user's answer is correct.

CORRECT ANSWER: ${correctAnswer}
ALTERNATIVE ANSWERS: ${alternatives.join(', ')}
USER ANSWER: ${userAnswer}

Rules:
- Accept exact matches
- Accept close matches (spelling errors, capitalization differences)
- Accept synonyms and alternative phrasings
- For places: accept city name with or without country/state
- For people: accept first name, last name, or full name if unambiguous
- Be lenient with minor differences

Respond with ONLY one word:
- "CORRECT" if the answer is acceptable
- "WRONG" if the answer is not acceptable

Your response:`;

        const result = await aiInstance.model.generateContent(prompt);
        const response = result.response.text().trim().toUpperCase();
        
        const isCorrect = response.includes('CORRECT');
        
        console.log(`[Questions] Verification: "${userAnswer}" vs "${correctAnswer}" = ${isCorrect ? 'CORRECT' : 'WRONG'}`);
        
        return isCorrect;
        
    } catch (error) {
        console.error('Error verifying answer:', error);
        // Fallback to simple string comparison
        const normalized = (str) => str.toLowerCase().trim().replace(/[^\w\s]/g, '');
        const userNorm = normalized(userAnswer);
        const correctNorm = normalized(correctAnswer);
        
        const allAnswers = [correctAnswer, ...alternatives].map(normalized);
        return allAnswers.some(ans => ans === userNorm || ans.includes(userNorm) || userNorm.includes(ans));
    }
}

async function startGame(client, roomId, room, interaction) {
    if (activeGames.has(roomId)) {
        console.log(`Questions game already running for room ${roomId}`);
        return;
    }

    activeGames.set(roomId, { active: true, scores: {}, currentQuestion: null });

    try {
        const channel = await client.channels.fetch(room.channelId);
        
        const embed = new EmbedBuilder()
            .setColor('#00bfff')
            .setTitle('📝 Questions Game - Starting!')
            .setDescription(`**Difficulty:** ${room.difficulty.toUpperCase()}\n\nFirst to **10 points** wins!\n\nGet ready...`);
        
        await channel.send({ embeds: [embed] });
        
        if (interaction && !interaction.replied && !interaction.deferred) {
            await interaction.deferUpdate();
        }
        
        await new Promise(resolve => setTimeout(resolve, 3000));
        await playGame(client, roomId, room);
        
    } catch (error) {
        console.error('Error starting questions game:', error);
        activeGames.delete(roomId);
    }
}

async function playGame(client, roomId, room) {
    try {
        const channel = await client.channels.fetch(room.channelId);
        const gameState = activeGames.get(roomId);
        
        if (!gameState) return;
        
        // Initialize scores
        room.players.forEach(playerId => {
            gameState.scores[playerId] = 0;
        });
        
        // Create leaderboard message
        const leaderboardEmbed = new EmbedBuilder()
            .setColor('#ffd700')
            .setTitle('📊 Leaderboard')
            .setDescription('Game starting...');
        
        const leaderboardMessage = await channel.send({ embeds: [leaderboardEmbed] });
        gameState.leaderboardMessageId = leaderboardMessage.id;
        
        let questionNumber = 1;
        let winner = null;
        
        while (!winner && gameState.active) {
            console.log(`[Questions] Round ${questionNumber} starting...`);
            
            // Generate question
            const qa = await generateQuestion(room.difficulty);
            gameState.currentQuestion = qa;
            
            const questionEmbed = new EmbedBuilder()
                .setColor('#00bfff')
                .setTitle(`📝 Question ${questionNumber}`)
                .setDescription(`**${qa.question}**`)
                .setFooter({ text: '⏱️ 20 seconds to answer!' })
                .setTimestamp();
            
            await channel.send({ embeds: [questionEmbed] });
            
            // Update leaderboard
            await updateLeaderboard(channel, gameState, room, client);
            
            // Wait for correct answer or timeout
            const result = await waitForAnswer(channel, room, gameState, qa);
            
            if (result.winner) {
                winner = result.winner;
                break;
            }
            
            if (result.timeout) {
                const timeoutEmbed = new EmbedBuilder()
                    .setColor('#ff0000')
                    .setTitle('⏰ Time\'s Up!')
                    .setDescription(`No one got it!\n\n**Correct Answer:** ${qa.answer}`);
                
                await channel.send({ embeds: [timeoutEmbed] });
            }
            
            questionNumber++;
            await new Promise(resolve => setTimeout(resolve, 3000));
        }
        
        // Game ended
        if (winner) {
            const winnerUser = await client.users.fetch(winner);
            
            const winEmbed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle('🐐 GOAT ALERT!')
                .setDescription(`${winnerUser} is the GOAT! GGs 🐐`)
                .setThumbnail(winnerUser.displayAvatarURL())
                .addFields({
                    name: '🏆 Final Score',
                    value: '10 points',
                    inline: true
                })
                .setTimestamp();
            
            await channel.send({ embeds: [winEmbed] });
        }
        
        // Delete leaderboard message
        try {
            const leaderboardMsg = await channel.messages.fetch(gameState.leaderboardMessageId);
            await leaderboardMsg.delete();
        } catch (err) {
            console.error('Error deleting leaderboard:', err);
        }
        
        // Cleanup room
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
        console.error('Error in questions game:', error);
    } finally {
        activeGames.delete(roomId);
        console.log(`[Questions] Game ${roomId} ended and cleaned up`);
    }
}

async function waitForAnswer(channel, room, gameState, qa) {
    return new Promise((resolve) => {
        let answered = false;
        let timeoutId;
        
        const filter = m => {
            return room.players.includes(m.author.id) && !m.author.bot;
        };
        
        const collector = channel.createMessageCollector({ 
            filter, 
            time: 20000 
        });
        
        timeoutId = setTimeout(() => {
            if (!answered) {
                answered = true;
                collector.stop();
                resolve({ timeout: true });
            }
        }, 20000);
        
        collector.on('collect', async message => {
            if (answered) return;
            
            const userAnswer = message.content;
            const isCorrect = await verifyAnswer(userAnswer, qa.answer, qa.alternatives);
            
            if (isCorrect) {
                answered = true;
                clearTimeout(timeoutId);
                collector.stop();
                
                // React with checkmark
                await message.react('✅');
                
                // Update score
                const userId = message.author.id;
                gameState.scores[userId] = (gameState.scores[userId] || 0) + 1;
                const newScore = gameState.scores[userId];
                
                // Announce
                const announceEmbed = new EmbedBuilder()
                    .setColor('#00ff00')
                    .setTitle('✅ Correct!')
                    .setDescription(`${message.author} is on **${newScore}** point${newScore !== 1 ? 's' : ''}!`);
                
                await channel.send({ embeds: [announceEmbed] });
                
                // Check if won
                if (newScore >= 10) {
                    resolve({ winner: userId });
                } else {
                    resolve({ correct: true });
                }
            }
            // If wrong, bot ignores (does nothing)
        });
        
        collector.on('end', () => {
            if (!answered) {
                clearTimeout(timeoutId);
                resolve({ timeout: true });
            }
        });
    });
}

async function updateLeaderboard(channel, gameState, room, client) {
    try {
        const leaderboardMsg = await channel.messages.fetch(gameState.leaderboardMessageId);
        
        // Sort players by score
        const sortedScores = Object.entries(gameState.scores)
            .sort((a, b) => b[1] - a[1]);
        
        let leaderboardText = '';
        
        for (let i = 0; i < sortedScores.length; i++) {
            const [userId, score] = sortedScores[i];
            
            try {
                const user = await client.users.fetch(userId);
                const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '▫️';
                leaderboardText += `${medal} **${user.username}**: ${score} point${score !== 1 ? 's' : ''}\n`;
            } catch (err) {
                console.error('Error fetching user for leaderboard:', err);
            }
        }
        
        if (!leaderboardText) {
            leaderboardText = 'No scores yet...';
        }
        
        const updatedEmbed = new EmbedBuilder()
            .setColor('#ffd700')
            .setTitle('📊 Leaderboard')
            .setDescription(leaderboardText)
            .setFooter({ text: 'First to 10 points wins!' })
            .setTimestamp();
        
        await leaderboardMsg.edit({ embeds: [updatedEmbed] });
        
    } catch (error) {
        console.error('Error updating leaderboard:', error);
    }
}

module.exports = {
    startGame
};
