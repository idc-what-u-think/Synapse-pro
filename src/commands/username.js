const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('username')
        .setDescription('Generate random usernames')
        .addIntegerOption(option =>
            option.setName('count')
                .setDescription('Number of usernames to generate (1-10)')
                .setMinValue(1)
                .setMaxValue(10)
                .setRequired(false))
        .addStringOption(option =>
            option.setName('style')
                .setDescription('Username style')
                .addChoices(
                    { name: 'Gamer', value: 'gamer' },
                    { name: 'Professional', value: 'professional' },
                    { name: 'Cute', value: 'cute' },
                    { name: 'Random', value: 'random' }
                )
                .setRequired(false)),
    
    async execute(interaction) {
        await interaction.deferReply();

        try {
            const count = interaction.options.getInteger('count') || 5;
            const style = interaction.options.getString('style') || 'random';

            const adjectives = {
                gamer: ['Epic', 'Pro', 'Dark', 'Shadow', 'Cyber', 'Neon', 'Toxic', 'Fatal', 'Silent', 'Swift'],
                professional: ['Smart', 'Tech', 'Digital', 'Modern', 'Prime', 'Elite', 'Expert', 'Master', 'Chief', 'Senior'],
                cute: ['Sweet', 'Tiny', 'Fluffy', 'Happy', 'Sunny', 'Soft', 'Lovely', 'Cute', 'Gentle', 'Calm'],
                random: ['Cool', 'Super', 'Mega', 'Ultra', 'Awesome', 'Great', 'Best', 'Top', 'Royal', 'Noble']
            };

            const nouns = {
                gamer: ['Wolf', 'Dragon', 'Phoenix', 'Viper', 'Reaper', 'Hunter', 'Slayer', 'Warrior', 'Ninja', 'Assassin'],
                professional: ['Coder', 'Developer', 'Designer', 'Engineer', 'Analyst', 'Manager', 'Consultant', 'Specialist', 'Director', 'Officer'],
                cute: ['Panda', 'Bunny', 'Kitten', 'Puppy', 'Bear', 'Fox', 'Deer', 'Cloud', 'Star', 'Moon'],
                random: ['Tiger', 'Eagle', 'Shark', 'Lion', 'Falcon', 'Panther', 'Cobra', 'Hawk', 'Bear', 'Bull']
            };

            const currentStyle = style === 'random' ? Object.keys(adjectives)[Math.floor(Math.random() * 4)] : style;
            const usernames = [];

            for (let i = 0; i < count; i++) {
                const adj = adjectives[currentStyle][Math.floor(Math.random() * adjectives[currentStyle].length)];
                const noun = nouns[currentStyle][Math.floor(Math.random() * nouns[currentStyle].length)];
                const number = Math.floor(Math.random() * 1000);
                usernames.push(`${adj}${noun}${number}`);
            }

            const embed = new EmbedBuilder()
                .setTitle('👤 Generated Usernames')
                .setDescription(usernames.map((u, i) => `${i + 1}. **${u}**`).join('\n'))
                .addFields({ name: '🎨 Style', value: currentStyle.charAt(0).toUpperCase() + currentStyle.slice(1) })
                .setColor(0x3498DB)
                .setFooter({ text: 'Click regenerate to get new usernames' })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('Username generator error:', error);
            await interaction.editReply({ content: '❌ Failed to generate usernames. Try again!' });
        }
    },
};
