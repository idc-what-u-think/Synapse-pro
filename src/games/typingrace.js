const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const github = require('../utils/github');

function generatePhrase() {
    const words = [
        'ability', 'abstract', 'account', 'achieve', 'address', 'advance', 'ancient', 'another',
        'balance', 'battery', 'because', 'believe', 'benefit', 'between', 'brother', 'building',
        'cabinet', 'captain', 'capture', 'careful', 'century', 'certain', 'chamber', 'chapter',
        'character', 'children', 'citizen', 'climate', 'clothes', 'collect', 'college', 'combine',
        'comfort', 'command', 'comment', 'company', 'compare', 'compete', 'complex', 'concept',
        'concern', 'conduct', 'confirm', 'connect', 'consider', 'contain', 'content', 'contest',
        'context', 'control', 'convert', 'correct', 'country', 'courage', 'coverage', 'created',
        'creature', 'criminal', 'critical', 'culture', 'current', 'customer', 'database', 'daughter',
        'decision', 'decrease', 'delivery', 'describe', 'designer', 'detailed', 'develop', 'difference',
        'different', 'difficult', 'digital', 'directly', 'director', 'discover', 'district', 'diversity',
        'document', 'dramatic', 'drawing', 'economic', 'education', 'effective', 'election', 'electric',
        'element', 'employee', 'encourage', 'engineer', 'enormous', 'entirely', 'entrance', 'environment',
        'equipment', 'especially', 'essential', 'establish', 'evening', 'everyone', 'evidence', 'exactly',
        'example', 'exchange', 'exciting', 'exercise', 'existence', 'expansion', 'expected', 'experience',
        'experiment', 'explain', 'explore', 'extension', 'external', 'facility', 'familiar', 'fashion',
        'feature', 'federal', 'festival', 'fiction', 'fifteen', 'finally', 'finance', 'finding',
        'foreign', 'forever', 'formula', 'fortune', 'forward', 'foundation', 'freedom', 'frequent',
        'friendly', 'function', 'fundamental', 'furniture', 'gallery', 'generate', 'generous', 'genetic',
        'government', 'graduate', 'graphics', 'greatest', 'guarantee', 'guidance', 'happen', 'hardware',
        'headline', 'healthy', 'heritage', 'highlight', 'historical', 'holiday', 'homepage', 'hospital',
        'housing', 'however', 'hundred', 'identify', 'illegal', 'imagine', 'immediate', 'immigrant',
        'imperial', 'implement', 'important', 'impossible', 'impressive', 'improve', 'incident', 'include',
        'increase', 'independent', 'indicate', 'individual', 'industrial', 'industry', 'influence', 'information',
        'initial', 'innocent', 'inquiry', 'inside', 'inspire', 'install', 'instance', 'institute',
        'instrument', 'insurance', 'intellectual', 'intelligent', 'intended', 'interact', 'interest', 'internal',
        'international', 'internet', 'interpret', 'interval', 'interview', 'introduce', 'invasion', 'investigate',
        'investment', 'involve', 'island', 'justice', 'keyboard', 'kingdom', 'kitchen', 'knowledge',
        'language', 'largest', 'lawsuit', 'leadership', 'leading', 'learning', 'lecture', 'legacy',
        'legend', 'legislation', 'legitimate', 'liberal', 'library', 'license', 'lifetime', 'limited',
        'literature', 'location', 'logical', 'machine', 'magazine', 'maintain', 'majority', 'manage',
        'manager', 'manner', 'manufacturer', 'marketing', 'marriage', 'material', 'maximum', 'meaning',
        'measure', 'mechanism', 'medical', 'medicine', 'medium', 'meeting', 'member', 'memory',
        'mental', 'mention', 'message', 'method', 'middle', 'military', 'million', 'mineral',
        'minimum', 'minister', 'minority', 'missing', 'mission', 'mistake', 'mixture', 'mobile',
        'moderate', 'modern', 'moment', 'monitor', 'monthly', 'morning', 'mortgage', 'mother',
        'motion', 'mountain', 'movement', 'multiple', 'musical', 'mystery', 'national', 'native',
        'natural', 'nature', 'nearby', 'necessary', 'negative', 'negotiate', 'neighbor', 'network',
        'neutral', 'nevertheless', 'newspaper', 'nightmare', 'nobody', 'normal', 'northern', 'nothing',
        'notice', 'notion', 'nuclear', 'number', 'numerous', 'object', 'objective', 'obligation',
        'observation', 'observe', 'obstacle', 'obtain', 'obvious', 'occasion', 'occupy', 'occur',
        'ocean', 'offense', 'officer', 'official', 'ongoing', 'opening', 'operate', 'operation',
        'operator', 'opinion', 'opponent', 'opportunity', 'opposite', 'option', 'orange', 'order',
        'ordinary', 'organic', 'organize', 'origin', 'original', 'outcome', 'outdoor', 'outside',
        'overall', 'overcome', 'overlook', 'overseas', 'overview', 'package', 'painting', 'palace',
        'panel', 'paper', 'parent', 'parking', 'parliament', 'partial', 'participant', 'particle',
        'particular', 'partner', 'passage', 'passenger', 'passion', 'passive', 'password', 'patent',
        'patient', 'pattern', 'payment', 'penalty', 'people', 'pepper', 'perfect', 'perform',
        'performance', 'perhaps', 'period', 'permanent', 'permission', 'permit', 'person', 'personal',
        'personality', 'perspective', 'persuade', 'petition', 'phenomenon', 'philosophy', 'photograph', 'phrase',
        'physical', 'picture', 'piece', 'pioneer', 'pizza', 'place', 'planet', 'planning',
        'plant', 'plastic', 'platform', 'player', 'pleasure', 'plenty', 'pocket', 'poetry',
        'point', 'police', 'policy', 'political', 'politician', 'politics', 'pollution', 'popular',
        'population', 'portfolio', 'portion', 'portrait', 'position', 'positive', 'possess', 'possibility',
        'possible', 'potential', 'poverty', 'powder', 'power', 'powerful', 'practical', 'practice',
        'prayer', 'precious', 'predict', 'prefer', 'pregnant', 'premier', 'premium', 'preparation',
        'prepare', 'prescription', 'presence', 'present', 'preserve', 'president', 'press', 'pressure',
        'pretend', 'pretty', 'prevent', 'previous', 'price', 'pride', 'priest', 'primary',
        'prime', 'prince', 'princess', 'principal', 'principle', 'print', 'prior', 'priority',
        'prison', 'prisoner', 'privacy', 'private', 'privilege', 'probably', 'problem', 'procedure',
        'proceed', 'process', 'produce', 'product', 'production', 'profession', 'professional', 'professor',
        'profile', 'profit', 'program', 'progress', 'project', 'prominent', 'promise', 'promote',
        'prompt', 'proof', 'proper', 'property', 'proportion', 'proposal', 'propose', 'prospect',
        'protect', 'protein', 'protest', 'proud', 'prove', 'provide', 'provider', 'province',
        'provision', 'psychology', 'public', 'publication', 'publish', 'purchase', 'purpose', 'pursue',
        'qualify', 'quality', 'quantity', 'quarter', 'question', 'quick', 'quiet', 'quote',
        'racial', 'radical', 'railway', 'random', 'range', 'rapid', 'rarely', 'rather',
        'rating', 'rational', 'reach', 'react', 'reaction', 'reader', 'reading', 'ready',
        'reality', 'realize', 'really', 'reason', 'reasonable', 'recall', 'receive', 'recent',
        'recipe', 'recognize', 'recommend', 'record', 'recover', 'reduce', 'refer', 'reference',
        'reflect', 'reform', 'refugee', 'refuse', 'regard', 'regime', 'region', 'regional',
        'register', 'regular', 'regulate', 'regulation', 'reinforce', 'reject', 'relate', 'relation',
        'relationship', 'relative', 'relax', 'release', 'relevant', 'relief', 'religion', 'religious',
        'rely', 'remain', 'remark', 'remember', 'remind', 'remote', 'remove', 'render',
        'repair', 'repeat', 'replace', 'reply', 'report', 'represent', 'republic', 'reputation',
        'request', 'require', 'research', 'resemble', 'reserve', 'resident', 'resist', 'resolution',
        'resolve', 'resort', 'resource', 'respect', 'respond', 'response', 'responsible', 'restaurant',
        'restore', 'restrict', 'result', 'retain', 'retire', 'retreat', 'return', 'reveal',
        'revenue', 'review', 'revolution', 'reward', 'rhythm', 'right', 'river', 'romantic',
        'rough', 'round', 'route', 'routine', 'royal', 'rubber', 'rural', 'sacred',
        'safety', 'salary', 'sample', 'sanction', 'satellite', 'satisfy', 'saving', 'scale',
        'scandal', 'scared', 'scenario', 'scene', 'schedule', 'scheme', 'scholar', 'school',
        'science', 'scientific', 'scientist', 'scope', 'score', 'screen', 'script', 'search',
        'season', 'second', 'secret', 'secretary', 'section', 'sector', 'secure', 'security',
        'segment', 'select', 'selection', 'senior', 'sense', 'sensitive', 'sentence', 'separate',
        'sequence', 'series', 'serious', 'servant', 'serve', 'service', 'session', 'settle',
        'settlement', 'severe', 'sexual', 'shadow', 'shake', 'shape', 'share', 'sharp',
        'shelter', 'shift', 'shine', 'ship', 'shirt', 'shock', 'shoot', 'shopping',
        'short', 'shoulder', 'shout', 'shower', 'signal', 'significance', 'significant', 'silence',
        'silent', 'silver', 'similar', 'simple', 'simply', 'single', 'sister', 'situation',
        'skill', 'slogan', 'small', 'smart', 'smile', 'smooth', 'social', 'society',
        'software', 'soldier', 'solid', 'solution', 'solve', 'somebody', 'somehow', 'someone',
        'something', 'sometimes', 'somewhat', 'somewhere', 'sound', 'source', 'south', 'southern',
        'space', 'spare', 'speaker', 'special', 'specialist', 'specific', 'specify', 'spectacular',
        'spectrum', 'speech', 'speed', 'spend', 'spending', 'sphere', 'spirit', 'spiritual',
        'split', 'spokesman', 'sponsor', 'sport', 'spread', 'spring', 'square', 'stable',
        'stadium', 'staff', 'stage', 'stake', 'stand', 'standard', 'standing', 'start',
        'state', 'statement', 'station', 'statistics', 'status', 'statute', 'steady', 'steel',
        'stick', 'still', 'stock', 'stone', 'storage', 'store', 'storm', 'story',
        'straight', 'strange', 'stranger', 'strategic', 'strategy', 'stream', 'street', 'strength',
        'strengthen', 'stress', 'stretch', 'strict', 'strike', 'string', 'strip', 'stroke',
        'strong', 'structure', 'struggle', 'student', 'studio', 'study', 'stuff', 'stupid',
        'style', 'subject', 'submit', 'subsequent', 'substance', 'substantial', 'succeed', 'success',
        'successful', 'sudden', 'suffer', 'sufficient', 'suggest', 'suggestion', 'suicide', 'suit',
        'summary', 'summer', 'summit', 'super', 'superior', 'supply', 'support', 'suppose',
        'supreme', 'surely', 'surface', 'surgery', 'surprise', 'surprised', 'surprising', 'surround',
        'survey', 'survival', 'survive', 'survivor', 'suspect', 'suspend', 'sustain', 'swear',
        'sweep', 'sweet', 'swing', 'switch', 'symbol', 'symptom', 'system', 'table',
        'tackle', 'tactic', 'talent', 'target', 'taste', 'teach', 'teacher', 'teaching',
        'team', 'tear', 'technical', 'technique', 'technology', 'teenager', 'telephone', 'telescope',
        'television', 'temperature', 'temple', 'temporary', 'tempt', 'tend', 'tendency', 'tennis',
        'tension', 'term', 'terrible', 'territory', 'terror', 'terrorist', 'testament', 'testing',
        'texture', 'thank', 'theater', 'theatre', 'their', 'theme', 'themselves', 'theology',
        'theory', 'therapy', 'there', 'therefore', 'these', 'thick', 'thing', 'think',
        'third', 'thirty', 'those', 'though', 'thought', 'thousand', 'threat', 'threaten',
        'threshold', 'throat', 'through', 'throughout', 'throw', 'thrust', 'thumb', 'ticket',
        'tight', 'timber', 'timely', 'timing', 'tissue', 'title', 'tobacco', 'today',
        'together', 'toilet', 'tolerance', 'tomato', 'tomorrow', 'tonight', 'topic', 'total',
        'touch', 'tough', 'tourist', 'tournament', 'toward', 'tower', 'track', 'trade',
        'tradition', 'traditional', 'traffic', 'tragedy', 'trail', 'train', 'training', 'transfer',
        'transform', 'transition', 'translate', 'transport', 'travel', 'treasure', 'treat', 'treatment',
        'treaty', 'trend', 'trial', 'tribe', 'tribunal', 'trick', 'trigger', 'troop',
        'trouble', 'truck', 'truly', 'trust', 'truth', 'tunnel', 'turkey', 'turn',
        'twice', 'twist', 'typical', 'ultimate', 'unable', 'uncle', 'undergo', 'understand',
        'unemployment', 'unexpected', 'unfair', 'uniform', 'union', 'unique', 'unit', 'unite',
        'unity', 'universal', 'universe', 'university', 'unknown', 'unless', 'unlike', 'unlikely',
        'until', 'unusual', 'update', 'upgrade', 'upper', 'upset', 'urban', 'urge',
        'used', 'useful', 'user', 'usual', 'utility', 'vacation', 'valley', 'valuable',
        'value', 'variable', 'variation', 'variety', 'various', 'vary', 'vast', 'vegetable',
        'vehicle', 'venture', 'venue', 'version', 'versus', 'vertical', 'very', 'vessel',
        'veteran', 'veto', 'victim', 'victory', 'video', 'view', 'viewer', 'village',
        'violate', 'violation', 'violence', 'violent', 'virtual', 'virtue', 'virus', 'visible',
        'vision', 'visit', 'visitor', 'visual', 'vital', 'vitamin', 'voice', 'volume',
        'volunteer', 'vote', 'voter', 'vulnerable', 'wage', 'wait', 'wake', 'walk',
        'wall', 'wander', 'want', 'warfare', 'warm', 'warn', 'warning', 'wash',
        'waste', 'watch', 'water', 'wave', 'weak', 'wealth', 'wealthy', 'weapon',
        'wear', 'weather', 'wedding', 'week', 'weekend', 'weekly', 'weigh', 'weight',
        'welcome', 'welfare', 'well', 'west', 'western', 'whatever', 'wheel', 'when',
        'whenever', 'where', 'whereas', 'whether', 'which', 'while', 'whisper', 'white',
        'whole', 'whom', 'whose', 'wide', 'widely', 'widespread', 'wife', 'wild',
        'wildlife', 'will', 'willing', 'window', 'wine', 'wing', 'winner', 'winter',
        'wire', 'wisdom', 'wise', 'wish', 'with', 'withdraw', 'within', 'without',
        'witness', 'woman', 'wonder', 'wonderful', 'wood', 'wooden', 'word', 'work',
        'worker', 'working', 'works', 'workshop', 'world', 'worried', 'worry', 'worse',
        'worth', 'would', 'wound', 'wrap', 'write', 'writer', 'writing', 'wrong',
        'yard', 'yeah', 'year', 'yellow', 'yesterday', 'yield', 'young', 'your',
        'yours', 'yourself', 'youth', 'zone'
    ];

    const wordCount = Math.floor(Math.random() * 5) + 8;
    const selectedWords = [];
    
    for (let i = 0; i < wordCount; i++) {
        const randomIndex = Math.floor(Math.random() * words.length);
        selectedWords.push(words[randomIndex]);
    }
    
    return selectedWords.join(' ');
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
            const phrase = generatePhrase();

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
