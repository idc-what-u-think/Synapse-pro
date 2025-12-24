const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('football')
        .setDescription('Get football/soccer scores and information')
        .addSubcommand(subcommand =>
            subcommand
                .setName('team')
                .setDescription('Search for a team')
                .addStringOption(option =>
                    option.setName('name')
                        .setDescription('Team name')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('today')
                .setDescription('Get today\'s matches')),
    
    async execute(interaction) {
        await interaction.deferReply();

        try {
            const subcommand = interaction.options.getSubcommand();

            if (subcommand === 'team') {
                const teamName = interaction.options.getString('name');
                const response = await fetch(`https://www.thesportsdb.com/api/v1/json/3/searchteams.php?t=${encodeURIComponent(teamName)}`);
                const data = await response.json();

                if (!data.teams || data.teams.length === 0) {
                    return await interaction.editReply({ content: '❌ No team found with that name!' });
                }

                const team = data.teams[0];

                const embed = new EmbedBuilder()
                    .setTitle(team.strTeam)
                    .setDescription(team.strDescriptionEN ? team.strDescriptionEN.substring(0, 2000) : 'No description available')
                    .setThumbnail(team.strTeamBadge)
                    .addFields(
                        { name: '🏆 League', value: team.strLeague || 'Unknown', inline: true },
                        { name: '📍 Stadium', value: team.strStadium || 'Unknown', inline: true },
                        { name: '📅 Formed', value: team.intFormedYear || 'Unknown', inline: true },
                        { name: '🌐 Website', value: team.strWebsite ? `[Visit](http://${team.strWebsite})` : 'N/A', inline: true }
                    )
                    .setColor(0x00FF00)
                    .setFooter({ text: 'Powered by TheSportsDB' })
                    .setTimestamp();

                if (team.strTeamBanner) {
                    embed.setImage(team.strTeamBanner);
                }

                await interaction.editReply({ embeds: [embed] });

            } else if (subcommand === 'today') {
                const today = new Date().toISOString().split('T')[0];
                const response = await fetch(`https://www.thesportsdb.com/api/v1/json/3/eventsday.php?d=${today}&s=Soccer`);
                const data = await response.json();

                if (!data.events || data.events.length === 0) {
                    return await interaction.editReply({ content: '⚽ No soccer matches scheduled for today!' });
                }

                const matches = data.events.slice(0, 10);
                const matchList = matches.map(match => 
                    `**${match.strHomeTeam}** vs **${match.strAwayTeam}**\n` +
                    `${match.strLeague} - ${match.strTime || 'TBD'}\n` +
                    `Score: ${match.intHomeScore || '?'} - ${match.intAwayScore || '?'}`
                ).join('\n\n');

                const embed = new EmbedBuilder()
                    .setTitle(`⚽ Today's Football Matches - ${today}`)
                    .setDescription(matchList || 'No matches found')
                    .setColor(0x00FF00)
                    .setFooter({ text: 'Powered by TheSportsDB' })
                    .setTimestamp();

                await interaction.editReply({ embeds: [embed] });
            }

        } catch (error) {
            console.error('Football error:', error);
            await interaction.editReply({ content: '❌ Failed to fetch football data. Try again!' });
        }
    },
};
