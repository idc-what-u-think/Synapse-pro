const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('puppy')
        .setDescription('Get a random puppy image')
        .addStringOption(option =>
            option.setName('breed')
                .setDescription('Specific breed (optional)')
                .setRequired(false)),
    
    async execute(interaction) {
        await interaction.deferReply();

        try {
            const breed = interaction.options.getString('breed');
            let url = 'https://dog.ceo/api/breeds/image/random';
            
            if (breed) {
                url = `https://dog.ceo/api/breed/${breed.toLowerCase()}/images/random`;
            }

            const response = await fetch(url);
            const data = await response.json();

            if (data.status !== 'success') {
                throw new Error('Invalid breed or API error');
            }

            const embed = new EmbedBuilder()
                .setTitle(breed ? `🐶 Random ${breed} Puppy!` : '🐶 Random Puppy!')
                .setImage(data.message)
                .setColor(0x8B4513)
                .setFooter({ text: 'Powered by Dog CEO API' })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('Puppy error:', error);
            await interaction.editReply({ 
                content: '❌ Failed to fetch puppy image. Check breed name or try again!' 
            });
        }
    },
};
