const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('avatar-gen')
        .setDescription('Generate a random avatar')
        .addStringOption(option =>
            option.setName('style')
                .setDescription('Avatar style')
                .setRequired(false)
                .addChoices(
                    { name: 'Avataaars', value: 'avataaars' },
                    { name: 'Bottts (Robots)', value: 'bottts' },
                    { name: 'Pixel Art', value: 'pixel-art' },
                    { name: 'Adventurer', value: 'adventurer' },
                    { name: 'Personas', value: 'personas' },
                    { name: 'Croodles', value: 'croodles' }
                ))
        .addStringOption(option =>
            option.setName('seed')
                .setDescription('Seed for avatar (same seed = same avatar)')
                .setRequired(false)),
    
    async execute(interaction) {
        await interaction.deferReply();

        try {
            const style = interaction.options.getString('style') || 'avataaars';
            const seed = interaction.options.getString('seed') || interaction.user.username;

            const avatarUrl = `https://api.dicebear.com/7.x/${style}/svg?seed=${encodeURIComponent(seed)}`;

            const embed = new EmbedBuilder()
                .setTitle('🎨 Generated Avatar')
                .setDescription(`**Style:** ${style}\n**Seed:** ${seed}`)
                .setImage(avatarUrl)
                .setColor(0x9B59B6)
                .setFooter({ text: 'Powered by DiceBear API • Same seed always generates the same avatar' })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('Avatar gen error:', error);
            await interaction.editReply({ content: '❌ Failed to generate avatar. Try again!' });
        }
    },
};
