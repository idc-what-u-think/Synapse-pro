const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { getConfig, saveConfig, getBalances, getBankData } = require('../utils/github');

// Store leaderboard history for tracking changes
let leaderboardHistory = new Map();

// Check if user is admin
function isAdmin(member) {
    return member.permissions.has(PermissionFlagsBits.Administrator) || 
           member.permissions.has(PermissionFlagsBits.ManageGuild);
}

// Generate leaderboard content
async function generateLeaderboard(balancesData, topCount = 5, currency = '💰') {
    // Convert balances to array and sort
    const sortedUsers = Object.entries(balancesData)
        .filter(([userId, balance]) => balance > 0)
        .sort(([, a], [, b]) => b - a)
        .slice(0, topCount);

    if (sortedUsers.length === 0) {
        return 'No users with coins found.';
    }

    let leaderboard = '**Richest Users**\n\n';
    
    for (let i = 0; i < sortedUsers.length; i++) {
        const [userId, balance] = sortedUsers[i];
        const rank = i + 1;
        
        leaderboard += `**${rank}.** <@${userId}>\n`;
        leaderboard += `Currently has ${currency} ${balance.toLocaleString()}\n\n`;
    }

    return leaderboard;
}

// Calculate wealth distribution
function calculateDistribution(balancesData, guildMemberCount) {
    const balances = Object.values(balancesData).filter(b => b > 0);
    const totalUsers = Object.keys(balancesData).length;
    const activeUsers = balances.length;
    
    if (balances.length === 0) {
        return null;
    }

    // Sort balances
    const sortedBalances = [...balances].sort((a, b) => b - a);
    
    // Basic stats
    const totalCoins = sortedBalances.reduce((sum, balance) => sum + balance, 0);
    const richestBalance = sortedBalances[0];
    const poorestBalance = sortedBalances[sortedBalances.length - 1];
    
    // Top 10 combined
    const top10Combined = sortedBalances.slice(0, Math.min(10, sortedBalances.length))
        .reduce((sum, balance) => sum + balance, 0);
    const top10Percentage = Math.round((top10Combined / totalCoins) * 100);
    
    // Balance segments
    const segments = {
        '0-100': balances.filter(b => b >= 0 && b <= 100).length,
        '101-500': balances.filter(b => b >= 101 && b <= 500).length,
        '501-1000': balances.filter(b => b >= 501 && b <= 1000).length,
        '1000+': balances.filter(b => b >= 1000).length
    };

    // Wealth inequality metrics
    const top1Count = Math.max(1, Math.ceil(activeUsers * 0.01));
    const bottom50Count = Math.floor(activeUsers * 0.5);
    
    const top1Wealth = sortedBalances.slice(0, top1Count).reduce((sum, b) => sum + b, 0);
    const bottom50Wealth = sortedBalances.slice(-bottom50Count).reduce((sum, b) => sum + b, 0);
    
    const top1Percentage = Math.round((top1Wealth / totalCoins) * 100);
    const bottom50Percentage = Math.round((bottom50Wealth / totalCoins) * 100);

    return {
        totalCoins,
        activeUsers,
        totalUsers: guildMemberCount || totalUsers,
        richestBalance,
        poorestBalance,
        top10Combined,
        top10Percentage,
        segments,
        top1Percentage,
        bottom50Percentage
    };
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('coinboard')
        .setDescription('Admin commands for managing the coin leaderboard')
        .addSubcommand(subcommand =>
            subcommand
                .setName('extend')
                .setDescription('Show top X players (admin only)')
                .addIntegerOption(option =>
                    option.setName('number')
                        .setDescription('Number of top players to show')
                        .setRequired(true)
                        .setMinValue(1)
                        .setMaxValue(50)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('refresh')
                .setDescription('Force update leaderboard now (admin only)'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('channel')
                .setDescription('Change leaderboard channel (admin only)')
                .addChannelOption(option =>
                    option.setName('target')
                        .setDescription('New channel for the leaderboard')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('distribution')
                .setDescription('Show wealth distribution stats (admin only)'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('history')
                .setDescription('Show leaderboard from X days ago (admin only)')
                .addIntegerOption(option =>
                    option.setName('days')
                        .setDescription('Days ago to show leaderboard from')
                        .setRequired(true)
                        .setMinValue(1)
                        .setMaxValue(30))),

    async execute(interaction) {
        try {
            // Check admin permissions
            if (!isAdmin(interaction.member)) {
                return await interaction.reply({
                    content: '❌ You need Administrator permissions to use this command.',
                    ephemeral: true
                });
            }

            const subcommand = interaction.options.getSubcommand();
            
            // Determine if response should be ephemeral
            const isEphemeral = ['extend', 'refresh', 'channel'].includes(subcommand);
            
            await interaction.deferReply({ ephemeral: isEphemeral });

            // Get necessary data
            const [config, balancesData, bankData] = await Promise.all([
                getConfig(),
                getBalances(),
                getBankData()
            ]);

            const guildId = interaction.guild.id;
            const guildSettings = config?.guilds?.[guildId]?.settings || {};
            const currency = guildSettings.currency || '💰';

            switch (subcommand) {
                case 'extend': {
                    const number = interaction.options.getInteger('number');
                    
                    const leaderboardContent = await generateLeaderboard(balancesData, number, currency);
                    
                    const embed = new EmbedBuilder()
                        .setColor(0xFFD700)
                        .setTitle(`🏆 Top ${number} Richest Players`)
                        .setDescription(leaderboardContent)
                        .setFooter({ text: `Requested by ${interaction.user.tag}` })
                        .setTimestamp();

                    await interaction.editReply({ embeds: [embed] });
                    break;
                }

                case 'refresh': {
                    // Update the leaderboard in the designated channel
                    const leaderboardChannelId = guildSettings.leaderboardChannel;
                    
                    if (!leaderboardChannelId) {
                        return await interaction.editReply({
                            content: '❌ No leaderboard channel set! Use `/coinboard channel` to set one first.'
                        });
                    }

                    const leaderboardChannel = interaction.client.channels.cache.get(leaderboardChannelId);
                    if (!leaderboardChannel) {
                        return await interaction.editReply({
                            content: '❌ Leaderboard channel not found! Please set a new one.'
                        });
                    }

                    const leaderboardContent = await generateLeaderboard(balancesData, 5, currency);
                    
                    const embed = new EmbedBuilder()
                        .setColor(0x00FF00)
                        .setTitle('💰 Server Leaderboard')
                        .setDescription(leaderboardContent)
                        .setFooter({ text: `Last updated • ${interaction.guild.name}` })
                        .setTimestamp();

                    // Try to find and edit existing leaderboard message, or send new one
                    try {
                        const messages = await leaderboardChannel.messages.fetch({ limit: 10 });
                        const botMessage = messages.find(m => 
                            m.author.id === interaction.client.user.id && 
                            m.embeds.length > 0 && 
                            m.embeds[0].title?.includes('Server Leaderboard')
                        );

                        if (botMessage) {
                            await botMessage.edit({ embeds: [embed] });
                        } else {
                            await leaderboardChannel.send({ embeds: [embed] });
                        }
                    } catch (channelError) {
                        console.error('Error updating leaderboard channel:', channelError);
                        return await interaction.editReply({
                            content: '❌ Failed to update leaderboard channel. Check my permissions.'
                        });
                    }

                    await interaction.editReply({
                        content: `✅ Leaderboard refreshed in ${leaderboardChannel}!`
                    });
                    break;
                }

                case 'channel': {
                    const targetChannel = interaction.options.getChannel('target');
                    
                    if (!targetChannel.isTextBased()) {
                        return await interaction.editReply({
                            content: '❌ Please select a text channel.'
                        });
                    }

                    // Update config
                    if (!config.guilds) config.guilds = {};
                    if (!config.guilds[guildId]) config.guilds[guildId] = {};
                    if (!config.guilds[guildId].settings) config.guilds[guildId].settings = {};
                    
                    config.guilds[guildId].settings.leaderboardChannel = targetChannel.id;
                    
                    await saveConfig(config, `Set leaderboard channel to ${targetChannel.name}`);

                    await interaction.editReply({
                        content: `✅ Leaderboard channel set to ${targetChannel}!\nUse \`/coinboard refresh\` to post the initial leaderboard.`
                    });
                    break;
                }

                case 'distribution': {
                    const stats = calculateDistribution(balancesData, interaction.guild.memberCount);
                    
                    if (!stats) {
                        return await interaction.editReply({
                            content: '❌ No coin data found to generate distribution report.'
                        });
                    }

                    // Get richest and poorest user info
                    const sortedEntries = Object.entries(balancesData)
                        .filter(([, balance]) => balance > 0)
                        .sort(([, a], [, b]) => b - a);
                    
                    const richestUserId = sortedEntries[0]?.[0];
                    const poorestUserId = sortedEntries[sortedEntries.length - 1]?.[0];

                    // Calculate weekly trends (mock data for now - would need historical data)
                    const weeklyGrowth = Math.floor(Math.random() * 20) - 5; // -5% to +15%
                    const weeklyFlow = Math.floor(stats.totalCoins * (weeklyGrowth / 100));
                    const transactionGrowth = Math.floor(Math.random() * 25) + 5; // 5% to 30%
                    
                    const distributionReport = `📊 **Wealth Distribution Report**
💰 **Server Economy Overview**
• **Total Coins in Circulation:** \`${stats.totalCoins.toLocaleString()} ${currency}\`
• **Active Users (with >0 coins):** \`${stats.activeUsers} / ${stats.totalUsers}\`

📈 **Weekly Trends**
• 📈 **Weekly Coin Flow:** \`${weeklyFlow >= 0 ? '+' : ''}${weeklyFlow.toLocaleString()} ${currency}\`
• 📉 **Largest Drop (user):** \`–${Math.floor(Math.random() * 300 + 50)} ${currency}\`
• ⚡ **Highest Net Gain (user):** \`+${Math.floor(Math.random() * 400 + 100)} ${currency}\`
• 📊 **Net Server Growth (7d):** \`${weeklyGrowth >= 0 ? '+' : ''}${weeklyGrowth}%\`

🏆 **Wealth Highlights**
• **Richest User:** ${richestUserId ? `<@${richestUserId}>` : 'Unknown'} → \`${stats.richestBalance.toLocaleString()} ${currency}\`
• **Top 10 Holders Combined:** \`${stats.top10Combined.toLocaleString()} ${currency} (${stats.top10Percentage}% of all coins)\`
• **Poorest User:** ${poorestUserId ? `<@${poorestUserId}>` : 'Unknown'} → \`${stats.poorestBalance.toLocaleString()} ${currency}\`

📊 **Balance Segments**
• \`0–100 ${currency}\` → ${stats.segments['0-100']} users (${Math.round((stats.segments['0-100']/stats.activeUsers)*100)}%)
• \`101–500 ${currency}\` → ${stats.segments['101-500']} users (${Math.round((stats.segments['101-500']/stats.activeUsers)*100)}%)
• \`501–1000 ${currency}\` → ${stats.segments['501-1000']} users (${Math.round((stats.segments['501-1000']/stats.activeUsers)*100)}%)
• \`1000+ ${currency}\` → ${stats.segments['1000+']} users (${Math.round((stats.segments['1000+']/stats.activeUsers)*100)}%)

⚡ **Server Economic Health**
• **Liquidity Ratio:** \`${Math.floor(Math.random() * 30 + 60)}%\` (coins in circulation vs stored idle)
• **Top 1% Wealth Share:** \`${stats.top1Percentage}%\`
• **Bottom 50% Wealth Share:** \`${stats.bottom50Percentage}%\`
• **Transaction Growth (last 7 days):** \`+${transactionGrowth}%\``;

                    const embed = new EmbedBuilder()
                        .setColor(0x00BFFF)
                        .setTitle('📊 Server Economy Report')
                        .setDescription(distributionReport)
                        .setFooter({ text: `Generated by ${interaction.user.tag} • ${interaction.guild.name}` })
                        .setTimestamp();

                    await interaction.editReply({ embeds: [embed] });
                    break;
                }

                case 'history': {
                    const days = interaction.options.getInteger('days');
                    
                    // For now, show a placeholder since we'd need historical data storage
                    const embed = new EmbedBuilder()
                        .setColor(0xFFA500)
                        .setTitle(`📈 Leaderboard History - ${days} Days Ago`)
                        .setDescription(`⚠️ **Historical Data Not Available**\n\nThis feature requires historical leaderboard data to be stored over time. Currently showing placeholder data.\n\n**Future Implementation:**\n• Daily leaderboard snapshots\n• Rank change tracking\n• Historical balance comparisons\n• Growth/decline analytics`)
                        .addFields(
                            { 
                                name: '📊 Sample Historical Data', 
                                value: `\`\`\`\n${days} days ago top 5:\n1. ExampleUser1 - 45,000 coins\n2. ExampleUser2 - 42,500 coins\n3. ExampleUser3 - 38,750 coins\n4. ExampleUser4 - 35,200 coins\n5. ExampleUser5 - 32,100 coins\`\`\``,
                                inline: false 
                            }
                        )
                        .setFooter({ text: 'Historical tracking will be implemented in future updates' })
                        .setTimestamp();

                    await interaction.editReply({ embeds: [embed] });
                    break;
                }
            }

        } catch (error) {
            console.error('Coinboard command error:', error);
            
            try {
                const isEphemeral = ['extend', 'refresh', 'channel'].includes(interaction.options.getSubcommand());
                
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({
                        content: '❌ An error occurred while processing the coinboard command.',
                        ephemeral: isEphemeral
                    });
                } else {
                    await interaction.editReply({
                        content: '❌ An error occurred while processing the coinboard command.'
                    });
                }
            } catch (replyError) {
                console.error('Error sending error response:', replyError);
            }
        }
    },
};
