const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('restart')
        .setDescription('Restart the bot (Owner only)'),
    
    async execute(interaction) {
        // Check if user is the bot owner
        const ownerId = process.env.OWNER_ID;
        
        if (!ownerId) {
            return await interaction.reply({ 
                content: '❌ OWNER_ID not set in environment variables!', 
                ephemeral: true 
            });
        }

        if (interaction.user.id !== ownerId) {
            return await interaction.reply({ 
                content: '❌ This command can only be used by the bot owner!', 
                ephemeral: true 
            });
        }

        const embed = new EmbedBuilder()
            .setTitle('🔄 Restarting Bot...')
            .setDescription('The bot will restart in a few seconds.\n\nThis will trigger a redeployment on Render.')
            .setColor(0xFFA500)
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });

        // Log the restart
        console.log(`[RESTART] Bot restart initiated by ${interaction.user.tag} (${interaction.user.id})`);

        // Wait 2 seconds before restarting
        setTimeout(() => {
            console.log('[RESTART] Exiting process...');
            process.exit(0); // Exit with code 0 (success)
        }, 2000);
    },
};
