const { SlashCommandBuilder, PermissionFlagsBits, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const { getWarnings, saveWarnings } = require('../utils/github');
const { sendModlogMessage } = require('../utils/modlog');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('clearwarnings')
        .setDescription('Clear all warnings for a user')
        .addUserOption(option => 
            option.setName('user')
                .setDescription('The user to clear warnings for')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        try {
            // DEFER IMMEDIATELY - before any async operations
            await interaction.deferReply({ ephemeral: true });
            console.log(`Clearwarnings command started for ${interaction.user.tag}`);

            const user = interaction.options.getUser('user');
            console.log(`Attempting to clear warnings for: ${user.tag}`);
            
            // Now safe to do async operations
            console.log('Fetching warnings data...');
            const warningsData = await getWarnings();
            console.log('Warnings data fetched successfully');
            
            // Check if user has any warnings
            if (!warningsData[user.id] || warningsData[user.id].length === 0) {
                return await interaction.editReply({
                    content: `${user.tag} has no warnings to clear.`
                });
            }

            const warningCount = warningsData[user.id].length;
            
            // Create confirmation buttons
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('confirm_clear')
                    .setLabel('Confirm')
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId('cancel_clear')
                    .setLabel('Cancel')
                    .setStyle(ButtonStyle.Secondary)
            );

            const response = await interaction.editReply({
                content: `⚠️ Are you sure you want to clear **${warningCount}** warnings for ${user.tag}?`,
                components: [row]
            });

            // Create button collector
            const collector = response.createMessageComponentCollector({ 
                time: 30000 // 30 seconds timeout
            });

            collector.on('collect', async i => {
                // Make sure only the command user can interact with buttons
                if (i.user.id !== interaction.user.id) {
                    return await i.reply({
                        content: 'You cannot use this button.',
                        ephemeral: true
                    });
                }

                if (i.customId === 'confirm_clear') {
                    try {
                        // Clear the warnings
                        delete warningsData[user.id];
                        
                        // Save updated data
                        await saveWarnings(warningsData, `Cleared ${warningCount} warnings for ${user.tag}`);

                        // Send modlog (runs in background)
                        sendModlogMessage(
                            interaction.guild,
                            'Warnings Cleared',
                            user,
                            interaction.user,
                            `${warningCount} warnings cleared`
                        ).catch(err => console.error('Modlog error:', err));
                        
                        await i.update({
                            content: `✅ Successfully cleared **${warningCount}** warnings for ${user.tag}`,
                            components: []
                        });

                        console.log(`Cleared ${warningCount} warnings for ${user.tag} by ${interaction.user.tag}`);

                    } catch (error) {
                        console.error('Error clearing warnings:', error);
                        await i.update({
                            content: 'An error occurred while clearing warnings. Please try again.',
                            components: []
                        });
                    }
                } else if (i.customId === 'cancel_clear') {
                    await i.update({
                        content: '❌ Warning clear cancelled.',
                        components: []
                    });
                }
            });

            collector.on('end', async (collected, reason) => {
                if (reason === 'time') {
                    try {
                        await interaction.editReply({
                            content: '⏰ Warning clear timed out. Please run the command again.',
                            components: []
                        });
                    } catch (error) {
                        console.error('Error handling timeout:', error);
                    }
                }
            });

        } catch (error) {
            console.error('Clear warnings command error:', error);
            
            try {
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({
                        content: 'An error occurred while processing the clearwarnings command.',
                        ephemeral: true
                    });
                } else {
                    await interaction.editReply({
                        content: 'An error occurred while processing the clearwarnings command.'
                    });
                }
            } catch (replyError) {
                console.error('Error sending error response:', replyError);
            }
        }
    },
};