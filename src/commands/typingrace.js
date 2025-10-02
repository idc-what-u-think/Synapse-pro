const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const github = require('../utils/github');

const PHRASES = [
    "The quick brown fox jumps over the lazy dog",
    "Pack my box with five dozen liquor jugs",
    "How vexingly quick daft zebras jump",
    "Sphinx of black quartz judge my vow",
    "Two driven jocks help fax my big quiz",
    "Five quacking zephyrs jolt my wax bed",
    "The five boxing wizards jump quickly",
    "Jackdaws love my big sphinx of quartz",
    "Mr Jock TV quiz PhD bags few lynx",
    "Waltz bad nymph for quick jigs vex"
];

function scramblePhrase(phrase) {
    const unicodeReplacements = {
        'a': 'а', 'e': 'е', 'o': 'о', 'p': 'р', 'c': 'с', 'x': 'х',
        'A': 'А', 'B': 'В', 'C': 'С', 'E': 'Е', 'H': 'Н', 'K': 'К',
        'M': 'М', 'O': 'О', 'P': 'Р', 'T': 'Т', 'X': 'Х', 'Y': 'У'
    };

    let scrambled = '';
    for (let char of phrase) {
        if (Math.random() > 0.7 && unicodeReplacements[char]) {
            scrambled += unicodeReplacements[char];
        } else {
            scrambled += char;
        }
    }
    return scrambled;
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
}

async function handleRoundsModal(interaction, roomId) {
    const rounds = parseInt(interaction.fields.getFieldValue('rounds'));

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
}

async function playRounds(client, roomId, totalRounds) {
    try {
        const activeRooms = await github.getActiveRooms();
        const room = activeRooms[roomId];

        if (!room) return;

        const channel = await client.channels.fetch(room.channelId);
        const rewards = await github.getGameRewards();

        for (let round = 1; round <= totalRounds; round++) {
            const originalPhrase = PHRASES[Math.floor(Math.random() * PHRASES.length)];
            const scrambledPhrase = scramblePhrase(originalPhrase);

            const embed = new EmbedBuilder()
                .setColor('#ffd700')
                .setTitle(`⌨️ Typing Race - Round ${round}/${totalRounds}`)
                .setDescription(`Type this phrase exactly:\n\n\`\`\`${scrambledPhrase}\`\`\``)
                .setFooter({ text: 'You have 2 minutes!' })
                .setTimestamp();

            await channel.send({ embeds: [embed] });

            const filter = m => room.players.includes(m.author.id) && m.content === originalPhrase;
            const collector = channel.createMessageCollector({ filter, time: 120000, max: 1 });

            const roundResult = await new Promise(resolve => {
                collector.on('collect', async message => {
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
                });

                collector.on('end', collected => {
                    if (collected.size === 0) {
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

        const message = await channel.messages.fetch(room.messageId);
        await message.delete().catch(() => {});

    } catch (error) {
        console.error('Error in typing race rounds:', error);
    }
}

module.exports = {
    startGame,
    handleConfig,
    handleRoundsModal
};
