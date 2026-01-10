const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const github = require('../utils/github');

// 600+ random words for typing challenges
const WORD_POOL = [
    'abandon', 'ability', 'absolute', 'abstract', 'abundant', 'academic', 'accelerate', 'accent', 'accept', 'access',
    'accident', 'accompany', 'accomplish', 'account', 'accurate', 'achieve', 'acknowledge', 'acquire', 'across', 'action',
    'activate', 'active', 'actual', 'adapt', 'addition', 'address', 'adequate', 'adjust', 'admire', 'admit',
    'adopt', 'adult', 'advance', 'advantage', 'adventure', 'advertise', 'advice', 'advocate', 'aesthetic', 'affect',
    'afford', 'afraid', 'after', 'again', 'against', 'agency', 'agenda', 'agent', 'aggressive', 'agree',
    'agriculture', 'ahead', 'aircraft', 'airport', 'album', 'alcohol', 'alert', 'alien', 'align', 'alive',
    'allegation', 'alliance', 'allocate', 'allow', 'almost', 'alone', 'along', 'already', 'although', 'always',
    'amazing', 'ambient', 'ambition', 'ambulance', 'amend', 'amount', 'analyze', 'ancient', 'anger', 'angle',
    'animal', 'animate', 'announce', 'annual', 'anonymous', 'another', 'answer', 'anticipate', 'anxiety', 'anybody',
    'anymore', 'anyone', 'anything', 'anyway', 'anywhere', 'apart', 'apartment', 'apologize', 'apparent', 'appeal',
    'appear', 'append', 'appetite', 'apple', 'application', 'apply', 'appoint', 'appreciate', 'approach', 'appropriate',
    'approve', 'approximate', 'arbitrary', 'architect', 'archive', 'argue', 'arise', 'armor', 'around', 'arrange',
    'array', 'arrest', 'arrival', 'arrive', 'arrow', 'article', 'artificial', 'artist', 'artistic', 'ascend',
    'ashamed', 'aside', 'aspect', 'assault', 'assemble', 'assert', 'assess', 'asset', 'assign', 'assist',
    'associate', 'assume', 'assure', 'astonish', 'athlete', 'atmosphere', 'attach', 'attack', 'attain', 'attempt',
    'attend', 'attention', 'attitude', 'attorney', 'attract', 'attribute', 'auction', 'audience', 'audio', 'audit',
    'august', 'author', 'authority', 'automatic', 'autumn', 'available', 'avenue', 'average', 'aviation', 'avoid',
    'awake', 'award', 'aware', 'awesome', 'awful', 'awkward', 'axis', 'bachelor', 'background', 'backup',
    'backward', 'bacteria', 'balance', 'balcony', 'balloon', 'ballot', 'banana', 'band', 'banner', 'bargain',
    'barrel', 'barrier', 'baseline', 'basic', 'basket', 'battery', 'battle', 'beach', 'beam', 'bean',
    'bear', 'beat', 'beautiful', 'beauty', 'because', 'become', 'bedroom', 'before', 'begin', 'behavior',
    'behind', 'being', 'belief', 'believe', 'belong', 'below', 'belt', 'bench', 'beneath', 'benefit',
    'beside', 'best', 'better', 'between', 'beyond', 'bicycle', 'billion', 'binary', 'biology', 'bird',
    'birth', 'birthday', 'bishop', 'bitter', 'bizarre', 'black', 'blade', 'blame', 'blanket', 'blast',
    'bleed', 'blend', 'bless', 'blind', 'block', 'blood', 'bloom', 'blossom', 'blow', 'blue',
    'board', 'boat', 'body', 'boil', 'bold', 'bomb', 'bond', 'bone', 'bonus', 'book',
    'boom', 'boost', 'boot', 'border', 'boring', 'born', 'borrow', 'boss', 'both', 'bother',
    'bottle', 'bottom', 'bounce', 'boundary', 'bowl', 'box', 'brain', 'branch', 'brand', 'brave',
    'bread', 'break', 'breakfast', 'breath', 'breathe', 'breed', 'breeze', 'brick', 'bridge', 'brief',
    'bright', 'brilliant', 'bring', 'broad', 'broadcast', 'broken', 'bronze', 'brother', 'brown', 'brush',
    'bubble', 'bucket', 'budget', 'buffalo', 'buffer', 'build', 'building', 'bullet', 'bundle', 'burden',
    'bureau', 'burn', 'burst', 'bury', 'business', 'busy', 'button', 'buyer', 'cabin', 'cabinet',
    'cable', 'cache', 'cafe', 'cage', 'cake', 'calculate', 'calendar', 'call', 'calm', 'camera',
    'campaign', 'campus', 'cancel', 'cancer', 'candidate', 'candle', 'candy', 'cannon', 'canvas', 'capable',
    'capacity', 'capital', 'captain', 'capture', 'carbon', 'card', 'care', 'career', 'careful', 'cargo',
    'carpet', 'carriage', 'carrier', 'carry', 'cart', 'case', 'cash', 'castle', 'casual', 'catalog',
    'catch', 'category', 'cathedral', 'cattle', 'cause', 'caution', 'cave', 'cease', 'ceiling', 'celebrate',
    'celebrity', 'cell', 'cement', 'cemetery', 'census', 'center', 'central', 'century', 'ceremony', 'certain',
    'certificate', 'chain', 'chair', 'chairman', 'challenge', 'chamber', 'champion', 'chance', 'change', 'channel',
    'chaos', 'chapter', 'character', 'charge', 'charity', 'charm', 'chart', 'chase', 'cheap', 'cheat',
    'check', 'cheek', 'cheer', 'cheese', 'chef', 'chemical', 'chemistry', 'cherry', 'chess', 'chest',
    'chicken', 'chief', 'child', 'childhood', 'chill', 'chimney', 'china', 'chip', 'chocolate', 'choice',
    'choose', 'chord', 'chorus', 'chronic', 'church', 'cigarette', 'cinema', 'circle', 'circuit', 'circulate',
    'citizen', 'city', 'civil', 'civilian', 'claim', 'clap', 'clarify', 'clarity', 'clash', 'class',
    'classic', 'classroom', 'clean', 'clear', 'clerk', 'clever', 'click', 'client', 'cliff', 'climate',
    'climb', 'clinic', 'clock', 'close', 'closet', 'cloth', 'clothes', 'cloud', 'club', 'clue',
    'cluster', 'coach', 'coal', 'coalition', 'coast', 'coat', 'code', 'coffee', 'cognitive', 'coherent',
    'coin', 'cold', 'collapse', 'collar', 'colleague', 'collect', 'collection', 'collective', 'college', 'collision',
    'colonial', 'colony', 'color', 'column', 'combat', 'combination', 'combine', 'come', 'comedy', 'comfort',
    'comic', 'command', 'comment', 'commerce', 'commercial', 'commission', 'commit', 'committee', 'common', 'communicate',
    'community', 'compact', 'companion', 'company', 'compare', 'comparison', 'compassion', 'compel', 'compensate', 'compete',
    'competition', 'compile', 'complain', 'complaint', 'complete', 'complex', 'complicate', 'component', 'compose', 'composition',
    'compound', 'comprehensive', 'compress', 'comprise', 'compromise', 'compute', 'computer', 'conceal', 'concede', 'conceive',
    'concentrate', 'concentration', 'concept', 'concern', 'concert', 'conclude', 'conclusion', 'concrete', 'condemn', 'condition',
    'conduct', 'conference', 'confess', 'confidence', 'confident', 'confine', 'confirm', 'conflict', 'conform', 'confront',
    'confuse', 'confusion', 'congress', 'connect', 'connection', 'conquer', 'conscience', 'conscious', 'consensus', 'consent',
    'consequence', 'conservative', 'consider', 'consist', 'consistent', 'constant', 'constitute', 'construct', 'consult', 'consumer',
    'contact', 'contain', 'contemporary', 'contempt', 'content', 'contest', 'context', 'continent', 'continue', 'contract',
    'contradict', 'contrary', 'contrast', 'contribute', 'control', 'controversy', 'convention', 'conversation', 'convert', 'convey',
    'convict', 'convince', 'cook', 'cool', 'cooperate', 'coordinate', 'cope', 'copper', 'copy', 'core',
    'corn', 'corner', 'corporate', 'correct', 'correlate', 'correspond', 'corridor', 'corrupt', 'cost', 'costume',
    'cottage', 'cotton', 'couch', 'could', 'council', 'counsel', 'count', 'counter', 'country', 'county',
    'couple', 'courage', 'course', 'court', 'courtesy', 'cousin', 'cover', 'coverage', 'crack', 'craft',
    'crash', 'crazy', 'cream', 'create', 'creation', 'creative', 'creature', 'credit', 'creek', 'crew',
    'crime', 'criminal', 'crisis', 'criteria', 'critic', 'critical', 'criticism', 'criticize', 'crop', 'cross',
    'crowd', 'crown', 'crucial', 'crude', 'cruise', 'crush', 'crystal', 'culture', 'curious', 'currency',
    'current', 'curriculum', 'curse', 'curtain', 'curve', 'cushion', 'custom', 'customer', 'cycle', 'daily',
    'damage', 'dance', 'danger', 'dangerous', 'dare', 'dark', 'darkness', 'data', 'database', 'date',
    'daughter', 'dawn', 'dead', 'deadline', 'deadly', 'deal', 'dealer', 'dear', 'death', 'debate',
    'debris', 'debt', 'decade', 'decay', 'deceive', 'decent', 'decide', 'decision', 'deck', 'declare',
    'decline', 'decorate', 'decrease', 'dedicate', 'deep', 'defeat', 'defend', 'defense', 'defensive', 'deficit',
    'define', 'definite', 'definition', 'degree', 'delay', 'delete', 'deliberate', 'delicate', 'delight', 'deliver',
    'delivery', 'demand', 'democracy', 'democratic', 'demonstrate', 'denial', 'denounce', 'dense', 'density', 'deny'
];

// Active game sessions tracker
const activeGames = new Map();

async function startGame(client, roomId, room, interaction) {
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
        
        if (interaction && !interaction.replied && !interaction.deferred) {
            await interaction.deferUpdate();
        }

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

function generatePhrase() {
    const wordCount = Math.floor(Math.random() * 3) + 6; // 6-8 words
    const shuffled = [...WORD_POOL].sort(() => Math.random() - 0.5);
    const selectedWords = shuffled.slice(0, wordCount);
    return selectedWords.join(' ');
}

async function playRounds(client, roomId, totalRounds) {
    // Check if game is already running
    if (activeGames.has(roomId)) {
        console.log(`Game already running for room ${roomId}, ignoring duplicate start`);
        return;
    }

    // Mark game as active
    activeGames.set(roomId, { active: true, currentRound: 0 });

    try {
        const activeRooms = await github.getActiveRooms();
        const room = activeRooms[roomId];

        if (!room) {
            console.error('Room not found:', roomId);
            activeGames.delete(roomId);
            return;
        }

        const channel = await client.channels.fetch(room.channelId);

        for (let round = 1; round <= totalRounds; round++) {
            // Check if game was cancelled
            const gameState = activeGames.get(roomId);
            if (!gameState || !gameState.active) {
                console.log(`Game ${roomId} was cancelled, stopping`);
                break;
            }

            // Update current round
            gameState.currentRound = round;
            
            console.log(`[Round ${round}/${totalRounds}] Starting for room ${roomId}`);
            const phrase = generatePhrase();

            const embed = new EmbedBuilder()
                .setColor('#ffd700')
                .setTitle(`⌨️ Typing Race - Round ${round}/${totalRounds}`)
                .setDescription(`Type this phrase exactly:\n\n\`\`\`${phrase}\`\`\``)
                .setFooter({ text: 'You have 2 minutes!' })
                .setTimestamp();

            await channel.send({ embeds: [embed] });

            const normalizedPhrase = phrase.toLowerCase().trim();
            console.log(`[Round ${round}] Waiting for: "${normalizedPhrase}"`);

            let roundWinner = null;
            let collectorEnded = false;

            const filter = m => {
                const userMessage = m.content.toLowerCase().trim();
                const isPlayer = room.players.includes(m.author.id);
                const isMatch = userMessage === normalizedPhrase;
                
                if (isMatch && isPlayer) {
                    console.log(`[Round ${round}] Match from ${m.author.tag}: "${userMessage}"`);
                }
                
                return isPlayer && isMatch && !collectorEnded;
            };
            
            const collector = channel.createMessageCollector({ 
                filter, 
                time: 120000, 
                max: 1 
            });

            await new Promise(resolve => {
                collector.on('collect', async message => {
                    if (collectorEnded) {
                        console.log(`[Round ${round}] Collector already ended, ignoring collect`);
                        return;
                    }
                    
                    collectorEnded = true;
                    roundWinner = message.author;

                    console.log(`[Round ${round}] Winner: ${message.author.tag}`);

                    const winEmbed = new EmbedBuilder()
                        .setColor('#00ff00')
                        .setTitle('🐐 GOAT ALERT!')
                        .setDescription(`${message.author} is the GOAT! 🐐`)
                        .setThumbnail(message.author.displayAvatarURL())
                        .setTimestamp();

                    await channel.send({ embeds: [winEmbed] });
                    
                    collector.stop('winner_found');
                    resolve();
                });

                collector.on('end', (collected, reason) => {
                    if (!collectorEnded) {
                        collectorEnded = true;
                        console.log(`[Round ${round}] Ended with reason: ${reason}`);
                        
                        if (reason === 'time' && !roundWinner) {
                            channel.send({
                                embeds: [new EmbedBuilder()
                                    .setColor('#ff0000')
                                    .setTitle('⏰ Time\'s Up!')
                                    .setDescription(`No one completed Round ${round} in time!`)]
                            }).catch(err => console.error('Error sending timeout message:', err));
                        }
                        
                        resolve();
                    }
                });
            });

            // Wait between rounds
            if (round < totalRounds) {
                await new Promise(resolve => setTimeout(resolve, 3000));
            }
        }

        // Game completed
        console.log(`[Game Complete] Room ${roomId} finished all rounds`);

        const finalEmbed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle('🎮 Typing Race Complete!')
            .setDescription('All rounds finished! Thanks for playing!');

        await channel.send({ embeds: [finalEmbed] });

        // Clean up
        const updatedRooms = await github.getActiveRooms();
        delete updatedRooms[roomId];
        await github.saveActiveRooms(updatedRooms);

        try {
            const message = await channel.messages.fetch(room.messageId);
            await message.delete();
        } catch (deleteError) {
            console.error('Error deleting room message:', deleteError);
        }

    } catch (error) {
        console.error('Error in typing race rounds:', error);
    } finally {
        // Always remove from active games when done
        activeGames.delete(roomId);
        console.log(`[Cleanup] Removed room ${roomId} from active games`);
    }
}

module.exports = {
    startGame,
    handleConfig,
    handleRoundsModal
};
