const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const github = require('../utils/github');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('sync')
        .setDescription('Force sync cache to GitHub or view cache stats')
        .addSubcommand(subcommand =>
            subcommand
                .setName('now')
                .setDescription('Force immediate sync of cache to GitHub')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('stats')
                .setDescription('View cache statistics and sync info')
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();

        try {
            if (subcommand === 'stats') {
                await handleStats(interaction);
            } else if (subcommand === 'now') {
                await handleForceSync(interaction);
            }
        } catch (error) {
            console.error('Error in sync command:', error);
            
            const errorMessage = {
                content: '❌ An error occurred while processing the sync command.',
                ephemeral: true
            };

            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(errorMessage);
            } else {
                await interaction.reply(errorMessage);
            }
        }
    }
};

async function handleStats(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const stats = github.getCacheStats();
    
    // Calculate time since last sync
    let timeSinceSync = 'Never';
    if (stats.lastSync !== 'Never') {
        const lastSyncTime = new Date(stats.lastSync).getTime();
        const now = Date.now();
        const diff = now - lastSyncTime;
        
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        
        timeSinceSync = `${hours}h ${minutes}m ago`;
    }

    // Calculate time until next sync
    let timeUntilSync = 'Unknown';
    if (stats.lastSync !== 'Never') {
        const lastSyncTime = new Date(stats.lastSync).getTime();
        const nextSyncTime = lastSyncTime + (24 * 60 * 60 * 1000); // 24 hours
        const now = Date.now();
        const diff = nextSyncTime - now;
        
        if (diff > 0) {
            const hours = Math.floor(diff / (1000 * 60 * 60));
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            timeUntilSync = `${hours}h ${minutes}m`;
        } else {
            timeUntilSync = 'Overdue';
        }
    }

    const embed = new EmbedBuilder()
        .setColor(stats.pendingChanges > 0 ? '#FFA500' : '#00FF00')
        .setTitle('📊 GitHub Cache Statistics')
        .setDescription('Current status of the in-memory cache and sync schedule')
        .addFields(
            { 
                name: '💾 Cache Status', 
                value: stats.loaded ? '✅ Loaded' : '❌ Not Loaded', 
                inline: true 
            },
            { 
                name: '📁 Total Files', 
                value: `${stats.totalFiles}`, 
                inline: true 
            },
            { 
                name: '⚠️ Pending Changes', 
                value: `${stats.pendingChanges}`, 
                inline: true 
            },
            { 
                name: '🕐 Last Sync', 
                value: stats.lastSync === 'Never' ? 'Never' : timeSinceSync, 
                inline: true 
            },
            { 
                name: '⏰ Next Sync', 
                value: timeUntilSync, 
                inline: true 
            },
            { 
                name: '🔄 Sync Interval', 
                value: '24 hours', 
                inline: true 
            }
        )
        .setFooter({ text: 'Use /sync now to force immediate sync' })
        .setTimestamp();

    // Add changed files if there are any
    if (stats.changedFiles && stats.changedFiles.length > 0) {
        const fileList = stats.changedFiles.slice(0, 10).join(', ');
        const moreFiles = stats.changedFiles.length > 10 ? `\n...and ${stats.changedFiles.length - 10} more` : '';
        embed.addFields({
            name: '📝 Changed Files',
            value: `\`\`\`${fileList}${moreFiles}\`\`\``,
            inline: false
        });
    }

    await interaction.editReply({ embeds: [embed] });
}

async function handleForceSync(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const stats = github.getCacheStats();

    if (stats.pendingChanges === 0) {
        const embed = new EmbedBuilder()
            .setColor('#00FF00')
            .setTitle('✅ No Changes to Sync')
            .setDescription('There are no pending changes in the cache. Everything is already synced to GitHub!')
            .addFields(
                { name: '📊 Cache Status', value: 'Up to date', inline: true },
                { name: '🕐 Last Sync', value: stats.lastSync, inline: true }
            )
            .setTimestamp();

        return await interaction.editReply({ embeds: [embed] });
    }

    // Show syncing embed
    const syncingEmbed = new EmbedBuilder()
        .setColor('#FFA500')
        .setTitle('🔄 Syncing to GitHub...')
        .setDescription(`Syncing ${stats.pendingChanges} changed file(s) to GitHub. Please wait...`)
        .setTimestamp();

    await interaction.editReply({ embeds: [syncingEmbed] });

    // Perform the sync
    const startTime = Date.now();
    const success = await github.forceSyncToGitHub();
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    // Show result
    const resultEmbed = new EmbedBuilder()
        .setColor(success ? '#00FF00' : '#FF0000')
        .setTitle(success ? '✅ Sync Successful!' : '❌ Sync Failed')
        .setDescription(
            success 
                ? `Successfully synced ${stats.pendingChanges} file(s) to GitHub in ${duration}s`
                : 'Failed to sync some files to GitHub. Check logs for details.'
        )
        .addFields(
            { name: '📁 Files Synced', value: `${stats.pendingChanges}`, inline: true },
            { name: '⏱️ Duration', value: `${duration}s`, inline: true },
            { name: '🕐 Synced At', value: new Date().toLocaleString(), inline: true }
        )
        .setTimestamp();

    await interaction.editReply({ embeds: [resultEmbed] });
}
