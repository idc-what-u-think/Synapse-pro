const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
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
        model: genAI.getGenerativeModel({ model: 'gemini-2.5-flash' }),
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

async function generateWYRQuestion() {
    try {
        const aiInstance = getNextAIInstance();
        
        const prompt = `Generate a single "Would You Rather" question with two interesting and balanced options. 
        
Rules:
- Make it fun, engaging, and appropriate for all ages
- Both options should be equally appealing/difficult to choose
- Keep each option concise (under 50 characters)
- Be creative and varied (superpowers, lifestyle, choices, scenarios, etc.)
- No offensive, inappropriate, or harmful content

Format your response EXACTLY like this (no extra text):
Option A: [your first option]
Option B: [your second option]

Example:
Option A: Have the ability to fly
Option B: Have the ability to turn invisible`;

        const result = await aiInstance.model.generateContent(prompt);
        const responseText = result.response.text().trim();
        
        // Parse the response
        const lines = responseText.split('\n').filter(line => line.trim());
        let optionA = '';
        let optionB = '';
        
        for (const line of lines) {
            if (line.startsWith('Option A:')) {
                optionA = line.replace('Option A:', '').trim();
            } else if (line.startsWith('Option B:')) {
                optionB = line.replace('Option B:', '').trim();
            }
        }
        
        if (!optionA || !optionB) {
            throw new Error('Failed to parse AI response');
        }
        
        console.log(`Generated WYR question: A: "${optionA}" vs B: "${optionB}"`);
        
        return { optionA, optionB };
        
    } catch (error) {
        console.error('Error generating WYR question:', error);
        
        // Fallback questions if AI fails
        const fallbackQuestions = [
            { optionA: "Have the ability to fly", optionB: "Have the ability to turn invisible" },
            { optionA: "Live in a mansion in the city", optionB: "Live in a cabin in the woods" },
            { optionA: "Always be 10 minutes late", optionB: "Always be 20 minutes early" },
            { optionA: "Have unlimited money", optionB: "Have unlimited time" },
            { optionA: "Never use social media again", optionB: "Never watch another movie or TV show" }
        ];
        
        const fallback = fallbackQuestions[Math.floor(Math.random() * fallbackQuestions.length)];
        console.log('Using fallback question due to AI error');
        return fallback;
    }
}

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
            .setDescription('Get ready! The game will begin in 3 seconds...\n*AI is generating unique questions for this game!*');

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
        
        let survivors = [...room.players];
        let round = 1;

        while (survivors.length > 1) {
            // Generate a fresh AI question for each round
            const question = await generateWYRQuestion();

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
