const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { getData, saveData } = require('../utils/github');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('riddle')
        .setDescription('Manage the riddle system')
        .addSubcommand(subcommand =>
            subcommand
                .setName('start')
                .setDescription('Start the riddle challenge'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('stop')
                .setDescription('Stop the riddle challenge'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('status')
                .setDescription('Check riddle status'))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    
    async execute(interaction) {
        try {
            await interaction.deferReply({ ephemeral: true });

            const subcommand = interaction.subcommand();
            const guildId = interaction.guild.id;

            let riddleData = await getRiddleData();
            
            if (!riddleData.guilds) riddleData.guilds = {};
            if (!riddleData.guilds[guildId]) {
                riddleData.guilds[guildId] = {
                    active: false,
                    solvedBy: null,
                    solvedAt: null
                };
            }

            const guildRiddle = riddleData.guilds[guildId];

            if (subcommand === 'start') {
                if (guildRiddle.active) {
                    return await interaction.editReply({
                        embeds: [new EmbedBuilder()
                            .setColor('#ff9900')
                            .setTitle('⚠️ Riddle Already Active')
                            .setDescription('The riddle challenge is already running!')]
                    });
                }

                guildRiddle.active = true;
                guildRiddle.solvedBy = null;
                guildRiddle.solvedAt = null;

                await saveRiddleData(riddleData);

                await interaction.editReply({
                    embeds: [new EmbedBuilder()
                        .setColor('#00ff00')
                        .setTitle('✅ Riddle Started')
                        .setDescription('The riddle challenge is now active! Users can answer using `Answer: <their answer>` in the AI channel.')]
                });

            } else if (subcommand === 'stop') {
                if (!guildRiddle.active) {
                    return await interaction.editReply({
                        embeds: [new EmbedBuilder()
                            .setColor('#ff9900')
                            .setTitle('⚠️ No Active Riddle')
                            .setDescription('There is no active riddle to stop.')]
                    });
                }

                guildRiddle.active = false;

                await saveRiddleData(riddleData);

                await interaction.editReply({
                    embeds: [new EmbedBuilder()
                        .setColor('#ff0000')
                        .setTitle('🛑 Riddle Stopped')
                        .setDescription('The riddle challenge has been deactivated.')]
                });

            } else if (subcommand === 'status') {
                const statusEmbed = new EmbedBuilder()
                    .setColor(guildRiddle.active ? '#00ff00' : '#ff0000')
                    .setTitle('🎯 Riddle Status')
                    .addFields(
                        { name: 'Status', value: guildRiddle.active ? '✅ Active' : '❌ Inactive', inline: true }
                    )
                    .setTimestamp();

                if (guildRiddle.solvedBy) {
                    statusEmbed.addFields(
                        { name: 'Last Solved By', value: `<@${guildRiddle.solvedBy}>`, inline: true },
                        { name: 'Solved At', value: guildRiddle.solvedAt ? new Date(guildRiddle.solvedAt).toLocaleString() : 'Unknown', inline: true }
                    );
                }

                await interaction.editReply({ embeds: [statusEmbed] });
            }

        } catch (error) {
            console.error('Error executing riddle command:', error);
            
            const errorMessage = {
                embeds: [new EmbedBuilder()
                    .setColor('#ff0000')
                    .setTitle('❌ Error')
                    .setDescription('An error occurred while managing the riddle.')]
            };
            
            if (interaction.deferred) {
                await interaction.editReply(errorMessage);
            } else {
                await interaction.reply({ ...errorMessage, ephemeral: true });
            }
        }
    },
};

async function getRiddleData() {
    try {
        const data = await getData('data/riddle.json');
        return data;
    } catch (error) {
        console.log('No existing riddle data found, creating new');
        return { guilds: {} };
    }
}

async function saveRiddleData(data) {
    try {
        await saveData('data/riddle.json', data, 'Update riddle data');
        console.log('Riddle data saved successfully');
    } catch (error) {
        console.error('Error saving riddle data:', error);
    }
}
