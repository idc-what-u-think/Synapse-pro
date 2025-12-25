// src/commands/restart.js
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('restart')
        .setDescription('Restart and redeploy the bot from GitHub (Owner only)')
        .addStringOption(option =>
            option.setName('type')
                .setDescription('Type of restart')
                .addChoices(
                    { name: 'Quick Restart (no code update)', value: 'quick' },
                    { name: 'Full Redeploy (pull latest code)', value: 'redeploy' }
                )
                .setRequired(false))
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Reason for restart (optional)')
                .setRequired(false)),
    
    async execute(interaction) {
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

        const type = interaction.options.getString('type') || 'redeploy';
        const reason = interaction.options.getString('reason') || 'Manual restart';

        // Get bot uptime
        const uptime = process.uptime();
        const days = Math.floor(uptime / 86400);
        const hours = Math.floor((uptime % 86400) / 3600);
        const minutes = Math.floor((uptime % 3600) / 60);
        const seconds = Math.floor(uptime % 60);
        const uptimeString = `${days}d ${hours}h ${minutes}m ${seconds}s`;

        if (type === 'redeploy') {
            const deployHookUrl = process.env.RENDER_DEPLOY_HOOK_URL;
            
            if (!deployHookUrl) {
                return await interaction.reply({ 
                    content: '❌ RENDER_DEPLOY_HOOK_URL not set! Set it in Render environment variables.\n\nFind it at: Render Dashboard → Your Service → Settings → Deploy Hook', 
                    ephemeral: true 
                });
            }

            const embed = new EmbedBuilder()
                .setTitle('🔄 Redeploying Bot...')
                .setDescription('Triggering full redeploy from GitHub. This will:\n• Pull latest code from repository\n• Rebuild the bot\n• Restart with new code')
                .addFields(
                    { name: '📊 Current Uptime', value: uptimeString, inline: true },
                    { name: '🔧 Reason', value: reason, inline: true },
                    { name: '⏱️ Expected Downtime', value: '~1-2 minutes', inline: true }
                )
                .setColor(0xFFA500)
                .setFooter({ text: `Initiated by ${interaction.user.tag}` })
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });

            console.log('='.repeat(50));
            console.log('[REDEPLOY] Full redeploy initiated via Deploy Hook');
            console.log(`[REDEPLOY] User: ${interaction.user.tag} (${interaction.user.id})`);
            console.log(`[REDEPLOY] Reason: ${reason}`);
            console.log(`[REDEPLOY] Uptime: ${uptimeString}`);
            console.log(`[REDEPLOY] Time: ${new Date().toISOString()}`);
            console.log('='.repeat(50));

            // Trigger Render deploy hook
            setTimeout(async () => {
                try {
                    const response = await fetch(deployHookUrl, { method: 'POST' });
                    
                    if (response.ok) {
                        console.log('[REDEPLOY] Deploy hook triggered successfully');
                    } else {
                        console.error('[REDEPLOY] Deploy hook failed:', response.status);
                    }
                } catch (error) {
                    console.error('[REDEPLOY] Error triggering deploy hook:', error);
                }
            }, 2000);

        } else {
            // Quick restart (just restarts the process, no code update)
            const embed = new EmbedBuilder()
                .setTitle('⚡ Quick Restart...')
                .setDescription('Restarting bot process (no code update).\n\n⚠️ **Note:** This won\'t update code. Use "Full Redeploy" to get latest changes from GitHub.')
                .addFields(
                    { name: '📊 Current Uptime', value: uptimeString, inline: true },
                    { name: '🔧 Reason', value: reason, inline: true },
                    { name: '⏱️ Expected Downtime', value: '~30 seconds', inline: true }
                )
                .setColor(0x00BFFF)
                .setFooter({ text: `Initiated by ${interaction.user.tag}` })
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });

            console.log('='.repeat(50));
            console.log('[RESTART] Quick restart initiated');
            console.log(`[RESTART] User: ${interaction.user.tag} (${interaction.user.id})`);
            console.log(`[RESTART] Reason: ${reason}`);
            console.log(`[RESTART] Uptime: ${uptimeString}`);
            console.log('='.repeat(50));

            setTimeout(() => {
                console.log('[RESTART] Exiting process now...');
                process.exit(0);
            }, 2000);
        }
    },
};
