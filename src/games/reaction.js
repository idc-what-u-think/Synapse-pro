const { EmbedBuilder } = require('discord.js');
const github = require('../utils/github');

const EMOJIS = [
    '🎯', '⚡', '🔥', '💎', '⭐', '🎮', '🏆', '💯', '✨', '🌟',
    '🚀', '🎨', '🎭', '🎪', '🎬', '🎤', '🎧', '🎼', '🎹', '🥁',
    '🎺', '🎸', '🎻', '🎲', '🎰', '🎳', '🏀', '⚽', '🏈', '⚾',
    '🏐', '🏉', '🎾', '🏸', '🏓', '🏒', '🏑', '🥊', '🥋', '⛳',
    '🎣', '🎿', '🛷', '⛸️', '🥌', '🏹', '🎯', '🪁', '🤿', '🪂',
    '🏋️', '🤸', '🤾', '⛹️', '🤺', '🧗', '🚴', '🚵', '🏇', '🧘',
    '🎖️', '🏅', '🥇', '🥈', '🥉', '👑', '💍', '💰', '💵', '💴',
    '💶', '💷', '💸', '🪙', '💳', '🧧', '🎁', '🎀', '🎊', '🎉',
    '🎈', '🎏', '🎐', '🧨', '✨', '🎇', '🎆', '🌠', '🌌', '🌃',
    '🌆', '🌇', '🌉', '🌁', '⚓', '⛵', '🚤', '🛳️', '⛴️', '🛥️',
    '🚢', '✈️', '🛩️', '🛫', '🛬', '🪂', '💺', '🚁', '🚟', '🚠',
    '🚡', '🛰️', '🚀', '🛸', '🌍', '🌎', '🌏', '🗺️', '🧭', '🏔️'
];

// Challenge prompts
const CHALLENGE_PROMPTS = [
    'React with {emoji} to win!',
    'Quick! Hit {emoji} first!',
    'Be the fastest to click {emoji}!',
    'Find and react with {emoji}!',
    'React {emoji} before everyone else!',
    'Catch the {emoji} now!',
    'First to {emoji} wins!',
    'Speed reaction! Click {emoji}!',
    'React {emoji} to claim victory!',
    'Who can hit {emoji} first?'
];

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
        
        // Get random challenge prompt
        const promptTemplate = CHALLENGE_PROMPTS[Math.floor(Math.random() * CHALLENGE_PROMPTS.length)];
        const challengeText = promptTemplate.replace('{emoji}', targetEmoji);
        
        const embed = new EmbedBuilder()
            .setColor('#ff6600')
            .setTitle('⚡ Fast Reaction Challenge!')
            .setDescription(`${challengeText}\n\n**Target Emoji:** ${targetEmoji}`)
            .setFooter({ text: 'First person to react wins!' });
            
        const message = await channel.send({ embeds: [embed] });
        
        // Add the target emoji so users can click it
        await message.react(targetEmoji);
        
        const filter = (reaction, user) => {
            if (!reaction || !reaction.emoji) {
                console.log('No reaction or emoji');
                return false;
            }
            
            const isCorrectEmoji = reaction.emoji.name === targetEmoji;
            const isPlayer = room.players.includes(user.id);
            const notBot = !user.bot;
            
            console.log(`[Reaction Debug]`);
            console.log(`  User: ${user.tag} (${user.id})`);
            console.log(`  Emoji: ${reaction.emoji.name}`);
            console.log(`  Target: ${targetEmoji}`);
            console.log(`  Is Correct: ${isCorrectEmoji}`);
            console.log(`  Is Player: ${isPlayer}`);
            console.log(`  Not Bot: ${notBot}`);
            console.log(`  All Valid: ${isCorrectEmoji && isPlayer && notBot}`);
            
            return isCorrectEmoji && isPlayer && notBot;
        };
        
        const collector = message.createReactionCollector({ 
            filter, 
            time: 60000, 
            max: 1 
        });
        
        let gameEnded = false;
        
        collector.on('collect', async (reaction, user) => {
            console.log(`[WINNER DETECTED] ${user.tag} reacted with ${reaction.emoji.name}`);
            
            if (gameEnded) {
                console.log('Game already ended, ignoring');
                return;
            }
            gameEnded = true;
            
            try {
                console.log('Processing winner rewards...');
                
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
                
                console.log(`Awarded ${rewardCoins} coins and ${rewardBucks} bucks to ${user.tag}`);
                
                const winEmbed = new EmbedBuilder()
                    .setColor('#00ff00')
                    .setTitle('🐐 GOAT ALERT!')
                    .setDescription(`${user} is the GOAT! 🐐\n\nFastest reaction in the server!`)
                    .addFields({
                        name: '💰 Rewards Earned',
                        value: `🪙 **${rewardCoins}** Coins\n💵 **${rewardBucks}** Buck${rewardBucks !== 1 ? 's' : ''}`,
                        inline: false
                    })
                    .setThumbnail(user.displayAvatarURL())
                    .setTimestamp();
                    
                await channel.send({ embeds: [winEmbed] });
                
                console.log('Winner announcement sent');
                
                // Stop collector immediately
                collector.stop('winner_found');
                
            } catch (error) {
                console.error('Error processing reaction winner:', error);
                gameEnded = false; // Reset if there was an error
            }
        });
        
        collector.on('end', async (collected, reason) => {
            console.log(`[Collector Ended] Reason: ${reason}, Collected: ${collected.size}`);
            
            if (reason === 'winner_found') {
                console.log('Game ended with winner');
            } else if (!gameEnded) {
                console.log('Game ended without winner (timeout)');
                
                const timeoutEmbed = new EmbedBuilder()
                    .setColor('#ff0000')
                    .setTitle('⏰ Time\'s Up!')
                    .setDescription('No one reacted in time! Better luck next time!');
                    
                await channel.send({ embeds: [timeoutEmbed] });
            }
            
            // Clean up room
            try {
                console.log('Cleaning up room...');
                const activeRooms = await github.getActiveRooms();
                delete activeRooms[roomId];
                await github.saveActiveRooms(activeRooms);
                
                const roomMessage = await channel.messages.fetch(room.messageId);
                await roomMessage.delete();
                console.log('Room cleaned up successfully');
            } catch (deleteError) {
                console.error('Error cleaning up room:', deleteError);
            }
        });
        
    } catch (error) {
        console.error('Error in reaction game:', error);
    }
}

module.exports = {
    startGame
};
