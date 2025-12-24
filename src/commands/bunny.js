const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('bunny')
        .setDescription('Get a random bunny image'),
    
    async execute(interaction) {
        await interaction.deferReply();

        try {
            const response = await fetch('https://api.bunnies.io/v2/loop/random/?media=gif,png');
            const data = await response.json();

            const embed = new EmbedBuilder()
                .setTitle('🐰 Random Bunny!')
                .setImage(data.media.gif || data.media.poster)
                .setColor(0xFFB6C1)
                .setFooter({ text: 'Powered by Bunnies.io' })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('Bunny error:', error);
            await interaction.editReply({ content: '❌ Failed to fetch bunny image. Try again!' });
        }
    },
};
