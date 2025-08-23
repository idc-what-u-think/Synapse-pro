const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getData, saveData } = require('../utils/github');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Check bot latency and performance'),

    async execute(interaction) { // Fixed: Removed extra parameters since we use the github module directly
        const sent = await interaction.reply({ 
            content: 'Pinging...', 
            fetchReply: true 
        });

        // Test JSON read/write
        const startJson = Date.now();
        try {
            // Fixed: Just pass the filename/path, the getData function handles the rest
            await getData('ping-test.json');
        } catch (error) {
            // If file doesn't exist, that's fine for a ping test
            console.log('Ping test file access completed (file may not exist yet)');
        }
        const jsonPing = Date.now() - startJson;

        const wsHeartbeat = interaction.client.ws.ping;
        const messagePing = sent.createdTimestamp - interaction.createdTimestamp;

        function getColor(ms) {
            if (ms < 200) return 0x00FF00;
            if (ms < 500) return 0xFFFF00;
            return 0xFF0000;
        }

        const embed = new EmbedBuilder()
            .setTitle('🏓 Pong!')
            .addFields(
                { name: 'WebSocket', value: `${wsHeartbeat}ms`, inline: true },
                { name: 'Message', value: `${messagePing}ms`, inline: true },
                { name: 'JSON Access', value: `${jsonPing}ms`, inline: true }
            )
            .setColor(getColor(Math.max(wsHeartbeat, messagePing, jsonPing)))
            .setTimestamp();

        await interaction.editReply({ content: null, embeds: [embed] });
    },
};