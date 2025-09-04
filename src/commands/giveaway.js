const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, PermissionFlagsBits } = require('discord.js');
const { getData, saveData } = require('../utils/github');

const FILE_PATHS = {
    active_giveaways: 'data/giveaways/active.json',
    giveaway_history: 'data/giveaways/history.json'
};

async function getActiveGiveaways() {
    return await getData(FILE_PATHS.active_giveaways);
}

async function saveActiveGiveaways(data) {
    return await saveData(FILE_PATHS.active_giveaways, data, 'Update active giveaways');
}

async function getGiveawayHistory() {
    return await getData(FILE_PATHS.giveaway_history);
}

async function saveGiveawayHistory(data) {
    return await saveData(FILE_PATHS.giveaway_history, data, 'Update giveaway history');
}

function parseTimeToNigeria(timeStr) {
    const now = new Date();
    const [time, period] = timeStr.toUpperCase().split(/([AP]M)/);
    const [hours, minutes] = time.split(':').map(Number);
    
    let hour24 = hours;
    if (period === 'PM' && hours !== 12) hour24 += 12;
    if (period === 'AM' && hours === 12) hour24 = 0;
    
    const targetDate = new Date(now);
    targetDate.setHours(hour24, minutes || 0, 0, 0);
    
    const nigeriaOffset = 1 * 60;
    const localOffset = targetDate.getTimezoneOffset();
    const offsetDiff = (nigeriaOffset + localOffset) * 60000;
    
    const nigeriaTime = new Date(targetDate.getTime() + offsetDiff);
    
    if (nigeriaTime <= now) {
        nigeriaTime.setDate(nigeriaTime.getDate() + 1);
    }
    
    return nigeriaTime;
}

function generateGiveawayId() {
    return Math.random().toString(36).substr(2, 9);
}

async function createGiveawayEmbed(giveaway) {
    const embed = new EmbedBuilder()
        .setTitle(`🎉 ${giveaway.name}`)
        .setDescription(giveaway.description)
        .setColor(0x00FF00)
        .addFields(
            { name: 'Winners', value: `${giveaway.winners}`, inline: true },
            { name: 'Ends At', value: `<t:${Math.floor(giveaway.endTime / 1000)}:F>`, inline: true },
            { name: 'Participants', value: `${giveaway.participants.length}`, inline: true }
        )
        .setFooter({ text: `Giveaway ID: ${giveaway.id}` })
        .setTimestamp();
    
    if (giveaway.imageUrl) {
        embed.setImage(giveaway.imageUrl);
    }
    
    return embed;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('giveaway')
        .setDescription('Manage giveaways')
        .addSubcommand(subcommand =>
            subcommand
                .setName('setup')
                .setDescription('Setup a new giveaway'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('end')
                .setDescription('End a giveaway without winners')
                .addStringOption(option =>
                    option.setName('id')
                        .setDescription('Giveaway ID to end')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('gend')
                .setDescription('End a giveaway with random winners')
                .addStringOption(option =>
                    option.setName('id')
                        .setDescription('Giveaway ID to end')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('List all active giveaways'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('history')
                .setDescription('View giveaway history'))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'setup') {
            const setupButton = new ButtonBuilder()
                .setCustomId('giveaway_setup_btn')
                .setLabel('Setup Giveaway')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('🎉');

            const row = new ActionRowBuilder().addComponents(setupButton);

            await interaction.reply({
                content: 'Click the button below to setup a new giveaway:',
                components: [row]
            });
        }

        else if (subcommand === 'end') {
            const giveawayId = interaction.options.getString('id');
            const activeGiveaways = await getActiveGiveaways();

            if (!activeGiveaways.giveaways) {
                return await interaction.reply({
                    content: 'No active giveaways found.',
                    ephemeral: true
                });
            }

            const giveawayIndex = activeGiveaways.giveaways.findIndex(g => g.id === giveawayId);
            if (giveawayIndex === -1) {
                return await interaction.reply({
                    content: 'Giveaway not found.',
                    ephemeral: true
                });
            }

            const giveaway = activeGiveaways.giveaways[giveawayIndex];
            
            try {
                const channel = await interaction.client.channels.fetch(giveaway.channelId);
                const message = await channel.messages.fetch(giveaway.messageId);
                
                const endedEmbed = new EmbedBuilder()
                    .setTitle(`🔚 ${giveaway.name} (ENDED)`)
                    .setDescription(giveaway.description)
                    .setColor(0xFF0000)
                    .addFields(
                        { name: 'Status', value: 'Ended by moderator without winners', inline: false },
                        { name: 'Total Participants', value: `${giveaway.participants.length}`, inline: true }
                    )
                    .setFooter({ text: `Giveaway ID: ${giveaway.id}` })
                    .setTimestamp();

                if (giveaway.imageUrl) {
                    endedEmbed.setImage(giveaway.imageUrl);
                }

                await message.edit({ embeds: [endedEmbed], components: [] });
            } catch (error) {
                console.error('Error updating giveaway message:', error);
            }

            const historyData = await getGiveawayHistory();
            if (!historyData.history) historyData.history = [];

            historyData.history.push({
                ...giveaway,
                endedAt: new Date().toISOString(),
                endedBy: interaction.user.id,
                winners: [],
                status: 'ended_no_winners'
            });

            activeGiveaways.giveaways.splice(giveawayIndex, 1);
            
            await Promise.all([
                saveActiveGiveaways(activeGiveaways),
                saveGiveawayHistory(historyData)
            ]);

            await interaction.reply({
                content: `✅ Giveaway "${giveaway.name}" has been ended without winners.`
            });
        }

        else if (subcommand === 'gend') {
            const giveawayId = interaction.options.getString('id');
            const activeGiveaways = await getActiveGiveaways();

            if (!activeGiveaways.giveaways) {
                return await interaction.reply({
                    content: 'No active giveaways found.',
                    ephemeral: true
                });
            }

            const giveawayIndex = activeGiveaways.giveaways.findIndex(g => g.id === giveawayId);
            if (giveawayIndex === -1) {
                return await interaction.reply({
                    content: 'Giveaway not found.',
                    ephemeral: true
                });
            }

            const giveaway = activeGiveaways.giveaways[giveawayIndex];

            if (giveaway.participants.length === 0) {
                return await interaction.reply({
                    content: 'Cannot end giveaway with winners - no participants!',
                    ephemeral: true
                });
            }

            const winnerCount = Math.min(giveaway.winners, giveaway.participants.length);
            const shuffled = [...giveaway.participants].sort(() => 0.5 - Math.random());
            const winners = shuffled.slice(0, winnerCount);

            try {
                const channel = await interaction.client.channels.fetch(giveaway.channelId);
                const message = await channel.messages.fetch(giveaway.messageId);
                
                const winnersText = winners.map(userId => `<@${userId}>`).join('\n');
                
                const endedEmbed = new EmbedBuilder()
                    .setTitle(`🎉 ${giveaway.name} (ENDED)`)
                    .setDescription(giveaway.description)
                    .setColor(0xFFD700)
                    .addFields(
                        { name: `🏆 Winner${winners.length > 1 ? 's' : ''}`, value: winnersText, inline: false },
                        { name: 'Total Participants', value: `${giveaway.participants.length}`, inline: true }
                    )
                    .setFooter({ text: `Giveaway ID: ${giveaway.id}` })
                    .setTimestamp();

                if (giveaway.imageUrl) {
                    endedEmbed.setImage(giveaway.imageUrl);
                }

                await message.edit({ embeds: [endedEmbed], components: [] });
                
                await channel.send({
                    content: `🎉 Congratulations ${winnersText}! You won **${giveaway.name}**!`
                });
            } catch (error) {
                console.error('Error updating giveaway message:', error);
            }

            const historyData = await getGiveawayHistory();
            if (!historyData.history) historyData.history = [];

            historyData.history.push({
                ...giveaway,
                endedAt: new Date().toISOString(),
                endedBy: interaction.user.id,
                winners: winners,
                status: 'ended_with_winners'
            });

            activeGiveaways.giveaways.splice(giveawayIndex, 1);
            
            await Promise.all([
                saveActiveGiveaways(activeGiveaways),
                saveGiveawayHistory(historyData)
            ]);

            await interaction.reply({
                content: `✅ Giveaway "${giveaway.name}" has been ended with ${winners.length} winner${winners.length > 1 ? 's' : ''}!`
            });
        }

        else if (subcommand === 'list') {
            const activeGiveaways = await getActiveGiveaways();

            if (!activeGiveaways.giveaways || activeGiveaways.giveaways.length === 0) {
                return await interaction.reply({
                    content: 'No active giveaways found.'
                });
            }

            const embed = new EmbedBuilder()
                .setTitle('🎉 Active Giveaways')
                .setColor(0x00FF00)
                .setTimestamp();

            let description = '';
            for (const giveaway of activeGiveaways.giveaways) {
                const endTime = Math.floor(giveaway.endTime / 1000);
                description += `**${giveaway.name}**\n`;
                description += `ID: \`${giveaway.id}\`\n`;
                description += `Participants: ${giveaway.participants.length}\n`;
                description += `Ends: <t:${endTime}:R>\n\n`;
            }

            embed.setDescription(description);

            await interaction.reply({ embeds: [embed] });
        }

        else if (subcommand === 'history') {
            const historyData = await getGiveawayHistory();

            if (!historyData.history || historyData.history.length === 0) {
                return await interaction.reply({
                    content: 'No giveaway history found.'
                });
            }

            const embed = new EmbedBuilder()
                .setTitle('📜 Giveaway History')
                .setColor(0x5865F2)
                .setTimestamp();

            let description = '';
            const recentHistory = historyData.history.slice(-10).reverse();
            
            for (const giveaway of recentHistory) {
                description += `**${giveaway.name}**\n`;
                description += `ID: \`${giveaway.id}\`\n`;
                
                if (giveaway.winners && giveaway.winners.length > 0) {
                    const winnersText = giveaway.winners.map(userId => `<@${userId}>`).join(', ');
                    description += `Winners: ${winnersText}\n`;
                } else {
                    description += `Winners: None\n`;
                }
                
                const endDate = new Date(giveaway.endedAt);
                description += `Ended: ${endDate.toLocaleDateString()}\n\n`;
            }

            embed.setDescription(description);
            embed.setFooter({ text: `Showing last ${recentHistory.length} giveaways` });

            await interaction.reply({ embeds: [embed] });
        }
    },

    async handleSetupButton(interaction) {
        const modal = new ModalBuilder()
            .setCustomId('giveaway_setup_modal')
            .setTitle('Setup New Giveaway');

        const nameInput = new TextInputBuilder()
            .setCustomId('giveaway_name')
            .setLabel('Giveaway Name')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMaxLength(100);

        const imageInput = new TextInputBuilder()
            .setCustomId('giveaway_image')
            .setLabel('Image URL (Optional)')
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setPlaceholder('https://media.discordapp.net/attachments/...');

        const endTimeInput = new TextInputBuilder()
            .setCustomId('giveaway_endtime')
            .setLabel('End Time (Nigeria GMT+1)')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setPlaceholder('2:30PM or 11:45AM');

        const descriptionInput = new TextInputBuilder()
            .setCustomId('giveaway_description')
            .setLabel('Description')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true)
            .setMaxLength(1000);

        const optionsInput = new TextInputBuilder()
            .setCustomId('giveaway_options')
            .setLabel('Winners (1-25) | Tag Everyone (Yes/No)')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setPlaceholder('3 | Yes');

        const rows = [
            new ActionRowBuilder().addComponents(nameInput),
            new ActionRowBuilder().addComponents(imageInput),
            new ActionRowBuilder().addComponents(endTimeInput),
            new ActionRowBuilder().addComponents(descriptionInput),
            new ActionRowBuilder().addComponents(optionsInput)
        ];

        modal.addComponents(...rows);
        await interaction.showModal(modal);
    },

    async handleSetupModal(interaction) {
        try {
            const name = interaction.fields.getTextInputValue('giveaway_name');
            const imageUrl = interaction.fields.getTextInputValue('giveaway_image') || null;
            const endTimeStr = interaction.fields.getTextInputValue('giveaway_endtime');
            const description = interaction.fields.getTextInputValue('giveaway_description');
            const optionsStr = interaction.fields.getTextInputValue('giveaway_options');

            const [winnersStr, tagEveryoneStr] = optionsStr.split('|').map(s => s.trim());
            const winners = parseInt(winnersStr);
            const tagEveryone = tagEveryoneStr.toLowerCase() === 'yes';

            if (isNaN(winners) || winners < 1 || winners > 25) {
                return await interaction.reply({
                    content: 'Winners must be a number between 1 and 25!',
                    ephemeral: true
                });
            }

            if (imageUrl && !imageUrl.startsWith('https://')) {
                return await interaction.reply({
                    content: 'Image URL must start with https://',
                    ephemeral: true
                });
            }

            let endTime;
            try {
                endTime = parseTimeToNigeria(endTimeStr);
            } catch (error) {
                return await interaction.reply({
                    content: 'Invalid time format! Use format like "2:30PM" or "11:45AM"',
                    ephemeral: true
                });
            }

            const giveawayId = generateGiveawayId();
            const giveaway = {
                id: giveawayId,
                name,
                description,
                imageUrl,
                winners,
                endTime: endTime.getTime(),
                participants: [],
                createdBy: interaction.user.id,
                createdAt: new Date().toISOString(),
                guildId: interaction.guildId,
                channelId: interaction.channelId
            };

            const embed = await createGiveawayEmbed(giveaway);

            const participateButton = new ButtonBuilder()
                .setCustomId(`giveaway_participate_${giveawayId}`)
                .setLabel('🎉 Participate')
                .setStyle(ButtonStyle.Success);

            const row = new ActionRowBuilder().addComponents(participateButton);

            const content = tagEveryone ? '@everyone' : null;
            const message = await interaction.reply({
                content,
                embeds: [embed],
                components: [row],
                fetchReply: true
            });

            giveaway.messageId = message.id;

            const activeGiveaways = await getActiveGiveaways();
            if (!activeGiveaways.giveaways) activeGiveaways.giveaways = [];
            activeGiveaways.giveaways.push(giveaway);

            await saveActiveGiveaways(activeGiveaways);

            setTimeout(async () => {
                await this.autoEndGiveaway(giveawayId, interaction.client);
            }, endTime.getTime() - Date.now());

        } catch (error) {
            console.error('Error in giveaway setup modal:', error);
            await interaction.reply({
                content: 'An error occurred while setting up the giveaway.',
                ephemeral: true
            });
        }
    },

    async handleParticipate(interaction, giveawayId) {
        try {
            const activeGiveaways = await getActiveGiveaways();
            const giveawayIndex = activeGiveaways.giveaways?.findIndex(g => g.id === giveawayId);

            if (giveawayIndex === -1 || !activeGiveaways.giveaways) {
                return await interaction.reply({
                    content: 'This giveaway no longer exists.',
                    ephemeral: true
                });
            }

            const giveaway = activeGiveaways.giveaways[giveawayIndex];

            if (giveaway.participants.includes(interaction.user.id)) {
                return await interaction.reply({
                    content: 'You are already participating in this giveaway!',
                    ephemeral: true
                });
            }

            giveaway.participants.push(interaction.user.id);
            await saveActiveGiveaways(activeGiveaways);

            const updatedEmbed = await createGiveawayEmbed(giveaway);
            await interaction.update({ embeds: [updatedEmbed] });

            await interaction.followUp({
                content: 'You have successfully joined the giveaway! Good luck! 🍀',
                ephemeral: true
            });

        } catch (error) {
            console.error('Error in giveaway participation:', error);
            await interaction.reply({
                content: 'An error occurred while joining the giveaway.',
                ephemeral: true
            });
        }
    },

    async autoEndGiveaway(giveawayId, client) {
        try {
            const activeGiveaways = await getActiveGiveaways();
            const giveawayIndex = activeGiveaways.giveaways?.findIndex(g => g.id === giveawayId);

            if (giveawayIndex === -1 || !activeGiveaways.giveaways) return;

            const giveaway = activeGiveaways.giveaways[giveawayIndex];

            if (giveaway.participants.length === 0) {
                const channel = await client.channels.fetch(giveaway.channelId);
                const message = await channel.messages.fetch(giveaway.messageId);
                
                const endedEmbed = new EmbedBuilder()
                    .setTitle(`😔 ${giveaway.name} (ENDED)`)
                    .setDescription(giveaway.description)
                    .setColor(0xFF0000)
                    .addFields(
                        { name: 'Status', value: 'No participants - No winners', inline: false }
                    )
                    .setFooter({ text: `Giveaway ID: ${giveaway.id}` })
                    .setTimestamp();

                if (giveaway.imageUrl) {
                    endedEmbed.setImage(giveaway.imageUrl);
                }

                await message.edit({ embeds: [endedEmbed], components: [] });

                const historyData = await getGiveawayHistory();
                if (!historyData.history) historyData.history = [];

                historyData.history.push({
                    ...giveaway,
                    endedAt: new Date().toISOString(),
                    winners: [],
                    status: 'ended_no_participants'
                });

                activeGiveaways.giveaways.splice(giveawayIndex, 1);
                
                await Promise.all([
                    saveActiveGiveaways(activeGiveaways),
                    saveGiveawayHistory(historyData)
                ]);

                return;
            }

            const winnerCount = Math.min(giveaway.winners, giveaway.participants.length);
            const shuffled = [...giveaway.participants].sort(() => 0.5 - Math.random());
            const winners = shuffled.slice(0, winnerCount);

            const channel = await client.channels.fetch(giveaway.channelId);
            const message = await channel.messages.fetch(giveaway.messageId);
            
            const winnersText = winners.map(userId => `<@${userId}>`).join('\n');
            
            const endedEmbed = new EmbedBuilder()
                .setTitle(`🎉 ${giveaway.name} (ENDED)`)
                .setDescription(giveaway.description)
                .setColor(0xFFD700)
                .addFields(
                    { name: `🏆 Winner${winners.length > 1 ? 's' : ''}`, value: winnersText, inline: false },
                    { name: 'Total Participants', value: `${giveaway.participants.length}`, inline: true }
                )
                .setFooter({ text: `Giveaway ID: ${giveaway.id}` })
                .setTimestamp();

            if (giveaway.imageUrl) {
                endedEmbed.setImage(giveaway.imageUrl);
            }

            await message.edit({ embeds: [endedEmbed], components: [] });
            
            await channel.send({
                content: `🎉 Congratulations ${winnersText}! You won **${giveaway.name}**!`
            });

            const historyData = await getGiveawayHistory();
            if (!historyData.history) historyData.history = [];

            historyData.history.push({
                ...giveaway,
                endedAt: new Date().toISOString(),
                winners: winners,
                status: 'auto_ended'
            });

            activeGiveaways.giveaways.splice(giveawayIndex, 1);
            
            await Promise.all([
                saveActiveGiveaways(activeGiveaways),
                saveGiveawayHistory(historyData)
            ]);

        } catch (error) {
            console.error('Error in auto-ending giveaway:', error);
        }
    }
};
