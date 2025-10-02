const { EmbedBuilder } = require('discord.js');
const github = require('../utils/github');

const EMOJIS = ['🎯', '⚡', '🔥', '💎', '⭐', '🎮', '🏆', '💯', '✨', '🌟'];

async function startGame(client, roomId, room) {
    try {
        const channel = await client.channels.fetch(room.channelId);
        
        const embed = new EmbedBuilder()
            .setColor('#ffcc00')
            .setTitle('⚡ Fast Reaction - Starting!')
            .setDescription('Get ready! The challenge will appear in 3 seconds...');

        await channel.send({ embeds: [embed] });
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
        const rewards = await github.getGameRewards();

        const embed = new EmbedBuilder()
            .setColor('#ff6600')
            .setTitle('⚡ Fast Reaction Challenge!')
            .setDescription(`React with ${targetEmoji} as fast as you can!`)
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

        collector.on('collect', async (reaction, user) => {
            try {
                const reactionUsers = await reaction.users.fetch();
                const userReactions = reactionUsers.filter(u => room.players.includes(u.id) && !u.bot);

                if (userReactions.size > 1) {
                    const tieEmbed = new EmbedBuilder()
                        .setColor('#ffa500')
                        .setTitle('🤝 It\'s a Tie!')
                        .setDescription('Multiple players reacted at the same time! Try again...');

                    await channel.send({ embeds: [tieEmbed] });
                    
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    return await playGame(client, roomId, room);
                }

                const economy = await github.getEconomy();
                const userId = user.id;

                if (!economy[userId]) {
                    economy[userId] = { coins: 0, bucks: 0 };
                }

                economy[userId].coins += rewards.reaction_winner.coins;
                economy[userId].bucks += rewards.reaction_winner.bucks;
                await github.saveEconomy(economy);

                const winnerEmbed = new EmbedBuilder()
                    .setColor('#00ff00')
                    .setTitle('🏆 Winner!')
                    .setDescription(`${user} reacted first!`)
                    .addFields({
                        name: 'Rewards',
                        value: `🪙 ${rewards.reaction_winner.coins} Coins\n💵 ${rewards.reaction_winner.bucks} DMP Bucks`
                    });

                await channel.send({ embeds: [winnerEmbed] });

                const activeRooms = await github.getActiveRooms();
                delete activeRooms[roomId];
                await github.saveActiveRooms(activeRooms);

                try {
                    const roomMessage = await channel.messages.fetch(room.messageId);
                    await roomMessage.delete();
                } catch (deleteError) {
                    console.error('Error deleting room message:', deleteError);
                }
            } catch (collectError) {
                console.error('Error processing reaction collection:', collectError);
            }
        });

        collector.on('end', async collected => {
            if (collected.size === 0) {
                try {
                    const timeoutEmbed = new EmbedBuilder()
                        .setColor('#ff0000')
                        .setTitle('⏰ Time\'s Up!')
                        .setDescription('No one reacted in time!');

                    await channel.send({ embeds: [timeoutEmbed] });

                    const activeRooms = await github.getActiveRooms();
                    delete activeRooms[roomId];
                    await github.saveActiveRooms(activeRooms);

                    try {
                        const roomMessage = await channel.messages.fetch(room.messageId);
                        await roomMessage.delete();
                    } catch (deleteError) {
                        console.error('Error deleting room message:', deleteError);
                    }
                } catch (endError) {
                    console.error('Error in collector end handler:', endError);
                }
            }
        });

    } catch (error) {
        console.error('Error in reaction game:', error);
    }
}

module.exports = {
    startGame
};
