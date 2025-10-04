const { EmbedBuilder } = require('discord.js');
const github = require('../utils/github');

const EMOJIS = [
    '🎯', '⚡', '🔥', '💎', '⭐', '🎮', '🏆', '💯', '✨', '🌟',
    '🚀', '🎨', '🎭', '🎪', '🎬', '🎤', '🎧', '🎼', '🎹', '🥁',
    '🎺', '🎸', '🎻', '🎲', '🎰', '🎳', '🎯', '🏀', '⚽', '🏈',
    '⚾', '🥎', '🏐', '🏉', '🥏', '🎾', '🏸', '🏒', '🏑', '🥍',
    '🏏', '⛳', '🏹', '🎣', '🥊', '🥋', '🎽', '⛸️', '🥌', '🛷',
    '🛹', '🛼', '🏆', '🥇', '🥈', '🥉', '🏅', '🎖️', '🏵️', '🎗️',
    '🎫', '🎟️', '🎪', '🤹', '🎭', '🎨', '🎬', '🎤', '🎧', '🎼',
    '🎹', '🥁', '🎷', '🎺', '🎸', '🪕', '🎻', '🎲', '♟️', '🎯',
    '🎳', '🎮', '🎰', '🧩', '🪀', '🪁', '🪂', '🎈', '🎆', '🎇',
    '🧨', '✨', '🎉', '🎊', '🎋', '🎍', '🎎', '🎏', '🎐', '🎑',
    '🧧', '🎀', '🎁', '🎗️', '🎟️', '🎫', '🎖️', '🏆', '🏅', '🥇',
    '🥈', '🥉', '⚽', '⚾', '🥎', '🏀', '🏐', '🏈', '🏉', '🎾',
    '🥏', '🎳', '🏏', '🏑', '🏒', '🥍', '🏓', '🏸', '🥊', '🥋',
    '🥅', '⛳', '⛸️', '🎣', '🤿', '🎽', '🎿', '🛷', '🥌', '🎯',
    '🪀', '🪁', '🎱', '🔮', '🪄', '🧿', '🎮', '🕹️', '🎰', '🎲',
    '🧩', '🧸', '🪅', '🪆', '♠️', '♥️', '♦️', '♣️', '♟️', '🃏',
    '🀄', '🎴', '🎭', '🖼️', '🎨', '🧵', '🪡', '🧶', '🪢', '👓',
    '🕶️', '🥽', '🥼', '🦺', '👔', '👕', '👖', '🧣', '🧤', '🧥',
    '🧦', '👗', '👘', '🥻', '🩱', '🩲', '🩳', '👙', '👚', '👛',
    '👜', '👝', '🎒', '👞', '👟', '🥾', '🥿', '👠', '👡', '🩰'
];

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

        let gameEnded = false;

        collector.on('collect', async (reaction, user) => {
            if (gameEnded) return;
            gameEnded = true;

            try {
                const economy = await github.getEconomy();
                const userId = user.id;
