const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('anime-character')
        .setDescription('Search for anime character information')
        .addStringOption(option =>
            option.setName('name')
                .setDescription('Character name to search')
                .setRequired(true)),
    
    async execute(interaction) {
        await interaction.deferReply();

        try {
            const name = interaction.options.getString('name');
            const response = await fetch(`https://api.jikan.moe/v4/characters?q=${encodeURIComponent(name)}&limit=1`);
            const data = await response.json();

            if (!data.data || data.data.length === 0) {
                return await interaction.editReply({ content: '❌ No character found with that name!' });
            }

            const character = data.data[0];

            const embed = new EmbedBuilder()
                .setTitle(character.name)
                .setURL(character.url)
                .setDescription(character.about ? character.about.substring(0, 2000) : 'No description available')
                .setThumbnail(character.images.jpg.image_url)
                .addFields(
                    { name: '❤️ Favorites', value: character.favorites.toString(), inline: true },
                    { name: '🔗 MyAnimeList ID', value: character.mal_id.toString(), inline: true }
                )
                .setColor(0xFF6B9D)
                .setFooter({ text: 'Powered by Jikan API' })
                .setTimestamp();

            if (character.nicknames && character.nicknames.length > 0) {
                embed.addFields({ 
                    name: '📛 Nicknames', 
                    value: character.nicknames.slice(0, 5).join(', ') 
                });
            }

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('Anime character error:', error);
            await interaction.editReply({ content: '❌ Failed to fetch character info. Try again!' });
        }
    },
};
