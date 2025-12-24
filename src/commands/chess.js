const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('chess')
        .setDescription('Chess move validator and board visualizer')
        .addSubcommand(subcommand =>
            subcommand
                .setName('validate')
                .setDescription('Validate a chess move')
                .addStringOption(option =>
                    option.setName('from')
                        .setDescription('Starting position (e.g., e2)')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('to')
                        .setDescription('Target position (e.g., e4)')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('piece')
                        .setDescription('Piece type')
                        .addChoices(
                            { name: 'Pawn', value: 'pawn' },
                            { name: 'Knight', value: 'knight' },
                            { name: 'Bishop', value: 'bishop' },
                            { name: 'Rook', value: 'rook' },
                            { name: 'Queen', value: 'queen' },
                            { name: 'King', value: 'king' }
                        )
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('board')
                .setDescription('Display a chess board from FEN notation')
                .addStringOption(option =>
                    option.setName('fen')
                        .setDescription('FEN notation (leave empty for starting position)')
                        .setRequired(false))),
    
    async execute(interaction) {
        await interaction.deferReply();

        try {
            const subcommand = interaction.options.getSubcommand();

            if (subcommand === 'validate') {
                const from = interaction.options.getString('from').toLowerCase();
                const to = interaction.options.getString('to').toLowerCase();
                const piece = interaction.options.getString('piece');

                const validation = validateMove(from, to, piece);

                const embed = new EmbedBuilder()
                    .setTitle('♟️ Chess Move Validation')
                    .addFields(
                        { name: 'Piece', value: piece.charAt(0).toUpperCase() + piece.slice(1), inline: true },
                        { name: 'From', value: from.toUpperCase(), inline: true },
                        { name: 'To', value: to.toUpperCase(), inline: true },
                        { name: 'Valid?', value: validation.valid ? '✅ Yes' : '❌ No', inline: false },
                        { name: 'Explanation', value: validation.reason, inline: false }
                    )
                    .setColor(validation.valid ? 0x00FF00 : 0xFF0000)
                    .setFooter({ text: 'Basic move validation - does not account for board state' })
                    .setTimestamp();

                await interaction.editReply({ embeds: [embed] });

            } else if (subcommand === 'board') {
                const fen = interaction.options.getString('fen') || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR';
                
                // Use lichess API to generate board image
                const boardUrl = `https://fen2image.chessvision.ai/${encodeURIComponent(fen)}`;

                const embed = new EmbedBuilder()
                    .setTitle('♟️ Chess Board')
                    .setDescription(`**FEN:** \`${fen}\``)
                    .setImage(boardUrl)
                    .setColor(0x769656)
                    .setFooter({ text: 'Powered by ChessVision.ai' })
                    .setTimestamp();

                await interaction.editReply({ embeds: [embed] });
            }

        } catch (error) {
            console.error('Chess error:', error);
            await interaction.editReply({ content: '❌ Failed to process chess command. Check your input!' });
        }
    },
};

function validateMove(from, to, piece) {
    // Parse positions
    const fromCol = from.charCodeAt(0) - 'a'.charCodeAt(0);
    const fromRow = parseInt(from[1]) - 1;
    const toCol = to.charCodeAt(0) - 'a'.charCodeAt(0);
    const toRow = parseInt(to[1]) - 1;

    // Validate position format
    if (fromCol < 0 || fromCol > 7 || fromRow < 0 || fromRow > 7 ||
        toCol < 0 || toCol > 7 || toRow < 0 || toRow > 7) {
        return { valid: false, reason: 'Invalid position format. Use a-h for columns and 1-8 for rows.' };
    }

    if (from === to) {
        return { valid: false, reason: 'Starting and ending positions must be different.' };
    }

    const colDiff = Math.abs(toCol - fromCol);
    const rowDiff = Math.abs(toRow - fromRow);

    switch (piece) {
        case 'pawn':
            if (colDiff === 0 && (rowDiff === 1 || (fromRow === 1 && rowDiff === 2))) {
                return { valid: true, reason: 'Valid pawn forward move.' };
            }
            if (colDiff === 1 && rowDiff === 1) {
                return { vali
