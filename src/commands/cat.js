const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('cat')
        .setDescription('Get a random cat image'),
    
    async execute(interaction) {
        await interaction.deferReply();

        try {
            const response = await fetch('https://api.thecatapi.com/v1/images/search');
            const data = await response.json();

            const embed = new EmbedBuilder()
                .setTitle('🐱 Random Cat!')
                .setImage(data[0].url)
                .setColor(0xFFA500)
                .setFooter({ text: 'Powered by TheCatAPI' })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('Cat error:', error);
            await interaction.editReply({ content: '❌ Failed to fetch cat image. Try again!' });
        }
    },
};
