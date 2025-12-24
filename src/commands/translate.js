const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('translate')
        .setDescription('Translate text to another language')
        .addStringOption(option =>
            option.setName('text')
                .setDescription('The text to translate')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('to')
                .setDescription('Target language (e.g., en, es, fr, de, ja, ko, zh)')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('from')
                .setDescription('Source language (auto-detect if not specified)')
                .setRequired(false)),
    
    async execute(interaction) {
        await interaction.deferReply();

        const text = interaction.options.getString('text');
        const targetLang = interaction.options.getString('to').toLowerCase();
        const sourceLang = interaction.options.getString('from')?.toLowerCase() || 'auto';

        try {
            const response = await fetch('https://libretranslate.com/translate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    q: text,
                    source: sourceLang,
                    target: targetLang,
                    format: 'text'
                })
            });

            if (!response.ok) {
                throw new Error(`Translation API returned ${response.status}`);
            }

            const data = await response.json();

            if (data.error) {
                throw new Error(data.error);
            }

            const embed = new EmbedBuilder()
                .setTitle('🌐 Translation')
                .addFields(
                    { name: `Original (${sourceLang === 'auto' ? 'Auto-detected' : sourceLang.toUpperCase()})`, value: text.substring(0, 1024) },
                    { name: `Translated (${targetLang.toUpperCase()})`, value: data.translatedText.substring(0, 1024) }
                )
                .setColor(0x4A90E2)
                .setFooter({ text: 'Powered by LibreTranslate' })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('Translation error:', error);
            
            const errorEmbed = new EmbedBuilder()
                .setTitle('❌ Translation Failed')
                .setDescription(`Could not translate the text. Please check:\n• Valid language codes (e.g., en, es, fr, de, ja, ko, zh)\n• Text length is reasonable\n• API is available`)
                .setColor(0xFF0000)
                .setTimestamp();

            await interaction.editReply({ embeds: [errorEmbed] });
        }
    },
};
