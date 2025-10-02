const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const github = require('../utils/github');

async function startGame(client, roomId, room) {
    try {
        const channel = await client.channels.fetch(room.channelId);
        
        if (room.players.length < 10) {
            const embed = new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('❌ Not Enough Players')
                .setDescription('Would You Rather requires exactly 10 players to start!');

            await channel.send({ embeds: [embed] });

            const activeRooms = await github.getActiveRooms();
            delete activeRooms[roomId];
            await github.saveActiveRooms(activeRooms);
            return;
        }

        const embed = new EmbedBuilder()
            .setColor('#9b59b6')
            .setTitle('🤔 Would You Rather - Starting!')
            .setDescription('Get ready! The game will begin in 3 seconds...');

        await channel.send({ embeds: [embed] });
        await new Promise(resolve => setTimeout(resolve, 3000));

        await playGame(client, roomId, room);

    } catch (error) {
        console.error('Error starting WYR:', error);
    }
}

async function playGame(client, roomId, room) {
    try {
        const channel = await client.channels.fetch(room.channelId);
        const wyrData = await github.getWYRQuestions();
        const questions = wyrData.questions;
        
        let survivors = [...room.players];
        let round = 1;

        while (survivors.length > 1) {
            const question = questions[Math.floor(Math.random() * questions.length)];

            const embed = new EmbedBuilder()
                .setColor('#9b59b6')
                .setTitle(`🤔 Would You Rather - Round ${round}`)
                .setDescription('Vote for your choice! You have 30 seconds.')
                .addFields(
                    { name: '🅰️ Option A', value: question.optionA, inline: false },
                    { name: '🅱️ Option B', value: question.optionB, inline: false },
                    { name: '👥 Survivors', value: `${survivors.length} players remaining` }
                );

            const buttonA = new ButtonBuilder()
                .setCustomId(`wyr_vote_a_${roomId}_${round}`)
                .setLabel('Option A')
                .setEmoji('🅰️')
                .setStyle(ButtonStyle.Primary);

            const buttonB = new ButtonBuilder()
                .setCustomId(`wyr_vote_b_${roomId}_${round}`)
                .setLabel('Option B')
                .setEmoji('🅱️')
                .setStyle(ButtonStyle.Success);

            const row = new ActionRowBuilder().addComponents(buttonA, buttonB);

            const message = await channel.send({ embeds: [embed], components: [row] });

            const votes = { a: [], b: [] };

            const filter = i => {
                return i.customId.startsWith(`wyr_vote_`) && 
                       i.customId.includes(`_${roomId}_${round}`);
            };

            const collector = message.createMessageComponentCollector({ 
                filter,
                time: 30000 
            });

            collector.on('collect', async i => {
                try {
                    if (!survivors.includes(i.user.id)) {
                        return await i.reply({
                            content: '❌ You have been eliminated!',
                            ephemeral: true
                        });
                    }

                    const choice = i.customId.includes('_a_') ? 'a' : 'b';

                    votes.a = votes.a.filter(id => id !== i.user.id);
                    votes.b = votes.b.filter(id => id !== i.user.id);

                    votes[choice].push(i.user.id);

                    await i.reply({
                        content: `✅ You voted for Option ${choice.toUpperCase()}!`,
                        ephemeral: true
                    });
                } catch (collectError) {
                    console.error('Error processing vote:', collectError);
                }
            });

            await new Promise(resolve => {
                collector.on('end', resolve);
            });

            try {
                await message.edit({ components: [] });
            } catch (editError) {
                console.error('Error disabling buttons:', editError);
            }

            const notVoted = survivors.filter(id => !votes.a.includes(id) && !votes.b.includes(id));
            const votedA = votes.a.length;
            const votedB = votes.b.length;

            let eliminated = [];

            if (votedA === votedB && votedA > 0) {
                const tieEmbed = new EmbedBuilder()
                    .setColor('#ffa500')
                    .setTitle('🤝 It\'s a Tie!')
                    .setDescription('Both options got equal votes! No one is eliminated this round.')
                    .addFields(
                        { name: '🅰️ Option A', value: `${votedA} votes`, inline: true },
                        { name: '🅱️ Option B', value: `${votedB} votes`, inline: true }
                    );

                await channel.send({ embeds: [tieEmbed] });
            } else {
                if (votedA < votedB) {
                    eliminated = [...votes.a, ...notVoted];
                } else {
                    eliminated = [...votes.b, ...notVoted];
                }

                survivors = survivors.filter(id => !eliminated.includes(id));

                const resultEmbed = new EmbedBuilder()
                    .setColor('#ff0000')
                    .setTitle('❌ Elimination Results')
                    .addFields(
                        { name: '🅰️ Option A', value: `${votedA} votes`, inline: true },
                        { name: '🅱️ Option B', value: `${votedB} votes`, inline: true },
                        { name: '💀 Eliminated', value: `${eliminated.length} players` }
                    );

                if (eliminated.length > 0) {
                    const eliminatedUsers = await Promise.all(
                        eliminated.slice(0, 10).map(async id => {
                            try {
                                const user = await client.users.fetch(id);
                                return user.username;
                            } catch {
                                return 'Unknown';
                            }
                        })
                    );
                    resultEmbed.addFields({
                        name: 'Eliminated Players',
                        value: eliminatedUsers.join(', ')
                    });
                }

                await channel.send({ embeds: [resultEmbed] });
            }

            if (survivors.length === 1) {
                break;
            }

            round++;
            await new Promise(resolve => setTimeout(resolve, 3000));
        }

        if (survivors.length === 1) {
            const winnerId = survivors[0];
            const economy = await github.getEconomy();
            const rewards = await github.getGameRewards();

            if (!economy[winnerId]) {
                economy[winnerId] = { coins: 0, bucks: 0 };
            }

            economy[winnerId].coins += rewards.wyr_winner.coins;
            economy[winnerId].bucks += rewards.wyr_winner.bucks;
            await github.saveEconomy(economy);

            const winner = await client.users.fetch(winnerId);

            const winnerEmbed = new EmbedBuilder()
                .setColor('#ffd700')
                .setTitle('🏆 Winner!')
                .setDescription(`${winner} is the last survivor!`)
                .addFields({
                    name: 'Rewards',
                    value: `🪙 ${rewards.wyr_winner.coins} Coins\n💵 ${rewards.wyr_winner.bucks} DMP Bucks`
                });

            await channel.send({ embeds: [winnerEmbed] });
        } else {
            const noWinnerEmbed = new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('❌ No Winner')
                .setDescription('The game ended with no clear winner!');

            await channel.send({ embeds: [noWinnerEmbed] });
        }

        const activeRooms = await github.getActiveRooms();
        delete activeRooms[roomId];
        await github.saveActiveRooms(activeRooms);

        try {
            const message = await channel.messages.fetch(room.messageId);
            await message.delete();
        } catch (deleteError) {
            console.error('Error deleting room message:', deleteError);
        }

    } catch (error) {
        console.error('Error in WYR game:', error);
    }
}

module.exports = {
    startGame
};
