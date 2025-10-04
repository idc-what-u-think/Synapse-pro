const { EmbedBuilder } = require('discord.js');
const github = require('../utils/github');
const { getAIInstance, GEMINI_KEYS } = require('../events/messageCreate');

const EMOJIS = [
    '🎯', '⚡', '🔥', '💎', '⭐', '🎮', '🏆', '💯', '✨', '🌟',
    '🚀', '🎨', '🎭', '🎪', '🎬', '🎤', '🎧', '🎼', '🎹', '🥁',
    '🎺', '🎸', '🎻', '🎲', '🎰', '🎳', '🏀', '⚽', '🏈', '⚾'
];

// Fallback prompts if AI fails
const FALLBACK_PROMPTS = [
    'React with the emoji that represents speed!',
    'Click on the emoji that symbolizes victory!',
    'Find the emoji that means celebration!',
    'React with the gaming emoji!',
    'Choose the emoji that represents a champion!'
];

async function generateChallenge(emoji) {
    try {
        if (GEMINI_KEYS.length === 0) {
            console.log('No AI keys available, using fallback prompt');
            return FALLBACK_PROMPTS[Math.floor(Math.random() * FALLBACK_PROMPTS.length)];
        }

        const aiInstance = getAIInstance();
        
        const prompt = `Generate a very short, exciting challenge prompt (5-10 words) asking users to react with the ${emoji} emoji. Make it fun and engaging. Examples: "Quick! React with ${emoji} to win!", "Be the fastest to hit ${emoji}!", "Catch the ${emoji} before it's gone!". Just return the prompt, nothing else.`;

        const result = await aiInstance.model.generateContent(prompt);
        const challenge = result.response.text().trim().replace(/["""]/g, '');
        
        console.log(`AI generated challenge: ${challenge}`);
        return challenge;
        
    } catch (error) {
        console.error('Error generating AI challenge:', error);
        console.log('Using fallback prompt due to error');
        return FALLBACK_PROMPTS[Math.floor(Math.random() * FALLBACK_PROMPTS.length)];
    }
}

async function startGame(client, roomId, room, interaction) {
    try {
        const channel = await client.channels.fetch(room.channelId);
        
        const embed = new EmbedBuilder()
            .setColor('#ffcc00')
            .setTitle('⚡ Fast Reaction - Starting!')
            .setDescription('Get ready! The challenge will appear in 3 seconds...');
            
        await channel.send({ embeds: [embed] });
        
        // Acknowledge the interaction if provided
        if (interaction && !interaction.replied && !interaction.deferred) {
            await interaction.deferUpdate();
        }
        
        await new Promise(resolve => setTimeout(resolve, 3000));
        await playGame(client, roomId, room);
        
    } catch (error) {
        console.error('Error starting reaction game:', error);
    }
}

async function playGame(client, roomId, room) {
    try {
        const channel = await client.channels.fetch(room.channelId);
        const targetEmoji = EMOJIS[Math.floor(Math.random() * EMOJIS.length)];
        
        let rewards = await github.getGameRewards();
        
        // Initialize rewards if empty
        if (!rewards || !rewards.reaction_winner) {
            console.log('Initializing reaction game rewards...');
            rewards = {
                typing_race_round: { coins: 50, bucks: 0 },
                wyr_winner: { coins: 300, bucks: 2 },
                reaction_winner: { coins: 100, bucks: 1 }
            };
            await github.saveGameRewards(rewards);
        }
        
        // Generate AI challenge prompt
        const challengeText = await generateChallenge(targetEmoji);
        
        const embed = new EmbedBuilder()
            .setColor('#ff6600')
            .setTitle('⚡ Fast Reaction Challenge!')
            .setDescription(challengeText)
            .setFooter({ text: 'First person to react wins!' });
            
        const message = await channel.send({ embeds: [embed] });
        await message.react(targetEmoji);
        
        const filter = (reaction, user) => {
            if (!reaction || !reaction.emoji) return false;
            return reaction.emoji.name === targetEmoji && 
                   room.players.includes(user.id) && 
                   !user.bot;
        };
        
        const collector = message.createReactionCollector({ filter, time: 60000, max: 1 });
        let gameEnded = false;
        
        collector.on('collect', async (reaction, user) => {
            if (gameEnded) return;
            gameEnded = true;
            
            try {
                const economy = await github.getEconomy();
                const userId = user.id;
                
                if (!economy[userId]) {
                    economy[userId] = { coins: 0, bucks: 0 };
                }
                
                const rewardCoins = rewards.reaction_winner?.coins || 100;
                const rewardBucks = rewards.reaction_winner?.bucks || 1;
                
                economy[userId].coins += rewardCoins;
                economy[userId].bucks += rewardBucks;
                
                await github.saveEconomy(economy);
                
                const winEmbed = new EmbedBuilder()
                    .setColor('#00ff00')
                    .setTitle('🏆 Winner!')
                    .setDescription(`${user} reacted first and wins!`)
                    .addFields({
                        name: 'Rewards',
                        value: `🪙 ${rewardCoins} Coins\n💵 ${rewardBucks} Buck${rewardBucks !== 1 ? 's' : ''}`
                    });
                    
                await channel.send({ embeds: [winEmbed] });
                
            } catch (error) {
                console.error('Error processing reaction winner:', error);
            }
        });
        
        collector.on('end', async (collected, reason) => {
            if (!gameEnded) {
                const timeoutEmbed = new EmbedBuilder()
                    .setColor('#ff0000')
                    .setTitle('⏰ Time\'s Up!')
                    .setDescription('No one reacted in time!');
                    
                await channel.send({ embeds: [timeoutEmbed] });
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
        });
        
    } catch (error) {
        console.error('Error in reaction game:', error);
    }
}

module.exports = {
    startGame
};
