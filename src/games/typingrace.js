const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const github = require('../utils/github');
const { getAIInstance, GEMINI_KEYS } = require('../events/messageCreate');

// Fallback phrases in case AI fails
const FALLBACK_PHRASES = [
    'the quick brown fox jumps over the lazy dog',
    'practice makes perfect when you type every day',
    'discord servers bring communities together online',
    'coding requires patience and constant learning',
    'gaming with friends creates lasting memories'
];

async function generatePhrase(difficulty = 'medium') {
    try {
        if (GEMINI_KEYS.length === 0) {
            console.log('No AI keys available, using fallback phrase');
            return FALLBACK_PHRASES[Math.floor(Math.random() * FALLBACK_PHRASES.length)];
        }

        const aiInstance = getAIInstance();
        
        let prompt;
        switch(difficulty) {
            case 'easy':
                prompt = "Generate a simple, casual sentence between 6-8 words. Make it easy to type with common words. Just return the sentence, nothing else.";
                break;
            case 'hard':
                prompt = "Generate a challenging sentence between 12-15 words with some uncommon words. Make it harder to type. Just return the sentence, nothing else.";
                break;
            default: // medium
                prompt = "Generate a random interesting sentence between 8-12 words. Mix common and slightly uncommon words. Just return the sentence, nothing else.";
        }

        const result = await aiInstance.model.generateContent(prompt);
        const phrase = result.response.text().trim().replace(/["""]/g, '').replace(/\.$/, '');
        
        console.log(`AI generated phrase (${difficulty}): ${phrase}`);
        return phrase;
        
    } catch (error) {
        console.error('Error generating AI phrase:', error);
        console.log('Using fallback phrase due to error');
        return FALLBACK_PHRASES[Math.floor(Math.random() * FALLBACK_PHRASES.length)];
    }
}

async function startGame(client, roomId, room) {
    try {
        const channel = await client.channels.fetch(room.channelId);
        
        const configModal = new ButtonBuilder()
            .setCustomId(`typing_config_${roomId}`)
            .setLabel('Configure Rounds')
            .setEmoji('⚙️')
            .setStyle(ButtonStyle.Primary);

        const row = new ActionRowBuilder().addComponents(configModal);

        const embed = new EmbedBuilder()
            .setColor('#ffd700')
            .setTitle('⌨️ Typing Race Configuration')
            .setDescription('Click below to set the number of rounds (3-6)');

        await channel.send({ embeds: [embed], components: [row] });

    } catch (error) {
        console.error('Error starting typing race:', error);
    }
}

async function handleConfig(interaction, roomId) {
    try {
        const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');

        const modal = new ModalBuilder()
            .setCustomId(`typing_rounds_${roomId}`)
            .setTitle('Set Number of Rounds');

        const roundsInput = new TextInputBuilder()
            .setCustomId('rounds')
            .setLabel('Number of Rounds (3-6)')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMinLength(1)
            .setMaxLength(1);

        const actionRow = new ActionRowBuilder().addComponents(roundsInput);
        modal.addComponents(actionRow);

        await interaction.showModal(modal);
    } catch (error) {
        console.error('Error showing config modal:', error);
    }
}

async function handleRoundsModal(interaction, roomId) {
    try {
        const rounds = parseInt(interaction.fields.getTextInputValue('rounds'));

        if (isNaN(rounds) || rounds < 3 || rounds > 6) {
            return await interaction.reply({
                content: '❌ Invalid number of rounds! Please enter a number between 3 and 6.',
                ephemeral: true
            });
        }

        await interaction.reply({
            content: `✅ Starting Typing Race with ${rounds} rounds!`,
            ephemeral: true
        });

        await playRounds(interaction.client, roomId, rounds);
    } catch (error) {
        console.error('Error handling rounds modal:', error);
    }
}

async function playRounds(client, roomId, totalRounds) {
    try {
        const activeRooms = await github.getActiveRooms();
        const room = activeRooms[roomId];

        if (!room) return;

        const channel = await client.channels.fetch(room.channelId);
        const rewards = await github.getGameRewards();

        for (let round = 1; round <= totalRounds; round++) {
            // Determine difficulty based on round
            let difficulty = 'medium';
            if (round <= 2) difficulty = 'easy';
            else if (round >= 5) difficulty = 'hard';
            
            console.log(`Generating phrase for round ${round} with difficulty: ${difficulty}`);
            const phrase = await generatePhrase(difficulty);

            const embed = new EmbedBuilder()
                .setColor('#ffd700')
                .setTitle(`⌨️ Typing Race - Round ${round}/${totalRounds}`)
                .setDescription(`Type this phrase exactly:\n\n\`\`\`${phrase}\`\`\``)
                .setFooter({ text: 'You have 2 minutes!' })
                .setTimestamp();

            await channel.send({ embeds: [embed] });

            const filter = m => room.players.includes(m.author.id) && m.content.toLowerCase() === phrase.toLowerCase();
            const collector = channel.createMessageCollector({ filter, time: 120000, max: 1 });

            const roundResult = await new Promise(resolve => {
                let resolved = false;

                collector.on('collect', async message => {
                    if (resolved) return;
                    resolved = true;

                    try {
                        const economy = await github.getEconomy();
                        const userId = message.author.id;

                        if (!economy[userId]) {
                            economy[userId] = { coins: 0, bucks: 0 };
                        }

                        economy[userId].coins += rewards.typing_race_round.coins;
                        await github.saveEconomy(economy);

                        const winEmbed = new EmbedBuilder()
                            .setColor('#00ff00')
                            .setTitle('🏆 Round Winner!')
                            .setDescription(`${message.author} won Round ${round}!`)
                            .addFields({
                                name: 'Reward',
                                value: `🪙 ${rewards.typing_race_round.coins} Coins`
                            });

                        await channel.send({ embeds: [winEmbed] });
                        resolve(true);
                    } catch (collectError) {
                        console.error('Error processing round winner:', collectError);
                        resolve(false);
                    }
                });

                collector.on('end', (collected, reason) => {
                    if (!resolved) {
                        resolved = true;
                        resolve(false);
                    }
                });
            });

            if (!roundResult) {
                const timeoutEmbed = new EmbedBuilder()
                    .setColor('#ff0000')
                    .setTitle('⏰ Time\'s Up!')
                    .setDescription(`No one completed Round ${round} in time!`);

                await channel.send({ embeds: [timeoutEmbed] });
            }

            if (round < totalRounds) {
                await new Promise(resolve => setTimeout(resolve, 3000));
            }
        }

        const finalEmbed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle('🎮 Typing Race Complete!')
            .setDescription('All rounds finished! Thanks for playing!');

        await channel.send({ embeds: [finalEmbed] });

        delete activeRooms[roomId];
        await github.saveActiveRooms(activeRooms);

        try {
            const message = await channel.messages.fetch(room.messageId);
            await message.delete();
        } catch (deleteError) {
            console.error('Error deleting room message:', deleteError);
        }

    } catch (error) {
        console.error('Error in typing race rounds:', error);
    }
}

module.exports = {
    startGame,
    handleConfig,
    handleRoundsModal
};
