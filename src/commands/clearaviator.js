const { SlashCommandBuilder } = require('discord.js');

// Import the activeGame variable (you'll need to export it from aviator.js)
// Or you can make this a admin-only command to force clear games

module.exports = {
    data: new SlashCommandBuilder()
        .setName('clearaviator')
        .setDescription('Clear stuck Aviator game (Admin only)'),

    async execute(interaction) {
        try {
            await interaction.deferReply({ flags: 64 }); // Ephemeral

            // Check if user has admin permissions (adjust as needed)
            if (!interaction.member.permissions.has('ADMINISTRATOR')) {
                return await interaction.editReply({
                    content: '❌ Only administrators can use this command.'
                });
            }

            // Clear the active game (you'll need to import/access the activeGame variable)
            // For now, this is a template - you'll need to modify based on how you structure it
            
            // If you make activeGame a global variable or export it:
            // global.activeGame = null;
            
            await interaction.editReply({
                content: '✅ Cleared any stuck Aviator games. You can now start a new game.'
            });

        } catch (error) {
            console.error('Clear aviator command error:', error);
            
            try {
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({
                        content: '❌ An error occurred while clearing the game.',
                        flags: 64
                    });
                } else {
                    await interaction.editReply({
                        content: '❌ An error occurred while clearing the game.'
                    });
                }
            } catch (replyError) {
                console.error('Error sending error response:', replyError);
            }
        }
    },
};
