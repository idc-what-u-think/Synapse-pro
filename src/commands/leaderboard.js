const { SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const { getData } = require('../utils/github');
const { getLevel } = require('../utils/xp');

function getRankColor(rank) {
    switch(rank) {
        case 1: return '🥇 #1'; // Gold
        case 2: return '🥈 #2'; // Silver
        case 3: return '🥉 #3'; // Bronze
        default: return `#${rank}`; // Normal
    }
}

function formatNumber(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('leaderboard')
        .setDescription('Show server level leaderboard')
        .addIntegerOption(option =>
            option.setName('page')
                .setDescription('Page number')
                .setMinValue(1)),

    async execute(interaction, octokit, owner, repo) {
        await interaction.deferReply();
        
        const data = await getData(octokit, owner, repo, 'levels.json');
        const guildData = data?.[interaction.guild.id] || {};
        
        // Convert to array and sort by messages
        const sortedUsers = Object.entries(guildData)
            .filter(([userId]) => userId !== 'levelUpChannel') // Filter out config
            .map(([userId, userData]) => ({
                id: userId,
                messages: userData.messages || 0,
                level: getLevel(userData.messages || 0)
            }))
            .sort((a, b) => b.messages - a.messages);

        const usersPerPage = 10;
        const maxPages = Math.ceil(sortedUsers.length / usersPerPage);
        let page = interaction.options.getInteger('page') || 1;
        page = Math.min(Math.max(1, page), maxPages);

        const startIdx = (page - 1) * usersPerPage;
        const pageUsers = sortedUsers.slice(startIdx, startIdx + usersPerPage);

        const embed = new EmbedBuilder()
            .setColor(0xFFD700)
            .setTitle('📊 Server Leaderboard')
            .setDescription(await Promise.all(pageUsers.map(async (user, idx) => {
                const rank = startIdx + idx + 1;
                const member = await interaction.guild.members.fetch(user.id).catch(() => null);
                const username = member ? member.user.username : 'Unknown User';
                const isCurrentUser = user.id === interaction.user.id;
                
                return `${getRankColor(rank)} ${isCurrentUser ? '**' : ''}${username}${isCurrentUser ? '**' : ''}\n` +
                       `Level ${user.level} • ${formatNumber(user.messages)} messages`;
            })))
            .setFooter({ text: `Page ${page}/${maxPages} • ${sortedUsers.length} total users` });

        // Add pagination buttons if needed
        const components = [];
        if (maxPages > 1) {
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('prev')
                    .setLabel('Previous')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(page === 1),
                new ButtonBuilder()
                    .setCustomId('next')
                    .setLabel('Next')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(page === maxPages)
            );
            components.push(row);
        }

        const response = await interaction.editReply({
            embeds: [embed],
            components
        });

        if (components.length > 0) {
            const collector = response.createMessageComponentCollector({ time: 60000 });

            collector.on('collect', async i => {
                if (i.user.id !== interaction.user.id) return;

                page = i.customId === 'next' ? page + 1 : page - 1;
                const newStartIdx = (page - 1) * usersPerPage;
                const newPageUsers = sortedUsers.slice(newStartIdx, newStartIdx + usersPerPage);

                const newEmbed = EmbedBuilder.from(embed)
                    .setDescription(await Promise.all(newPageUsers.map(async (user, idx) => {
                        const rank = newStartIdx + idx + 1;
                        const member = await interaction.guild.members.fetch(user.id).catch(() => null);
                        const username = member ? member.user.username : 'Unknown User';
                        const isCurrentUser = user.id === interaction.user.id;
                        
                        return `${getRankColor(rank)} ${isCurrentUser ? '**' : ''}${username}${isCurrentUser ? '**' : ''}\n` +
                               `Level ${user.level} • ${formatNumber(user.messages)} messages`;
                    })))
                    .setFooter({ text: `Page ${page}/${maxPages} • ${sortedUsers.length} total users` });

                const newRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('prev')
                        .setLabel('Previous')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(page === 1),
                    new ButtonBuilder()
                        .setCustomId('next')
                        .setLabel('Next')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(page === maxPages)
                );

                await i.update({
                    embeds: [newEmbed],
                    components: [newRow]
                });
            });

            collector.on('end', () => {
                const disabledRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('prev')
                        .setLabel('Previous')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(true),
                    new ButtonBuilder()
                        .setCustomId('next')
                        .setLabel('Next')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(true)
                );
                
                interaction.editReply({
                    components: [disabledRow]
                }).catch(() => {});
            });
        }
    },
};
