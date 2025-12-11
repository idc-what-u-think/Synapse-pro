const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const github = require('../utils/github');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('generate')
        .setDescription('Generate optimized sensitivity settings')
        .addStringOption(option =>
            option.setName('game')
                .setDescription('Select the game')
                .setRequired(true)
                .addChoices(
                    { name: 'Free Fire', value: 'freefire' },
                    { name: 'Call of Duty Mobile', value: 'codm' }
                ))
        .addStringOption(option =>
            option.setName('device')
                .setDescription('Your device name (e.g., iPhone 14 Pro, Samsung Galaxy S23)')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('finger_count')
                .setDescription('[CODM Only] Number of fingers you use')
                .addChoices(
                    { name: '2 Fingers (Thumbs)', value: '2fingers' },
                    { name: '3 Fingers', value: '3fingers' },
                    { name: '4 Fingers', value: '4fingers' },
                    { name: '4+ Fingers (Boss level)', value: '4+' }
                ))
        .addStringOption(option =>
            option.setName('play_style')
                .setDescription('[Free Fire Only] Your play style')
                .addChoices(
                    { name: 'Balanced', value: 'balanced' },
                    { name: 'Aggressive (VIP)', value: 'aggressive' },
                    { name: 'Precise (VIP)', value: 'precise' },
                    { name: 'Defensive (VIP)', value: 'defensive' }
                ))
        .addStringOption(option =>
            option.setName('experience')
                .setDescription('[Free Fire Only] Your experience level')
                .addChoices(
                    { name: 'Beginner', value: 'beginner' },
                    { name: 'Intermediate', value: 'intermediate' },
                    { name: 'Advanced', value: 'advanced' },
                    { name: 'Professional', value: 'professional' }
                )),
    
    async execute(interaction) {
        const game = interaction.options.getString('game');
        const device = interaction.options.getString('device');
        const fingerCount = interaction.options.getString('finger_count');
        const playStyle = interaction.options.getString('play_style');
        const experience = interaction.options.getString('experience');
        const userId = interaction.user.id;
        const username = interaction.user.username;
        const serverId = interaction.guild?.id || 'DM';

        // Load user data
        const sensiData = await github.getSensiUsers();
        const userData = sensiData.users[userId];

        if (!userData) {
            return await interaction.reply({
                content: '❌ You don\'t have an account! Use `/signup` first.',
                ephemeral: true
            });
        }

        // Check if banned
        if (userData.isBanned) {
            return await interaction.reply({
                content: `🚫 **You are banned from using this bot.**\nReason: ${userData.banReason || 'Not specified'}`,
                ephemeral: true
            });
        }

        // Validate game-specific requirements
        if (game === 'codm' && !fingerCount) {
            return await interaction.reply({
                content: '❌ **Error:** CODM requires finger count selection.',
                ephemeral: true
            });
        }

        if (game === 'freefire' && (!playStyle || !experience)) {
            return await interaction.reply({
                content: '❌ **Error:** Free Fire requires play style and experience level.',
                ephemeral: true
            });
        }

        // Check VIP features
        const isVipPlayStyle = ['aggressive', 'precise', 'defensive'].includes(playStyle);
        const effectiveRole = userData.role; // Can add server VIP logic later

        if (isVipPlayStyle && effectiveRole === 'free') {
            return await interaction.reply({
                content: '⚠️ **VIP Feature**\nThe selected play style requires VIP access. Using "Balanced" instead or upgrade to VIP!',
                ephemeral: true
            });
        }

        await interaction.deferReply();

        try {
            // Call website API
            const apiUrl = 'https://gamingsensitivity.vercel.app';
            let result;

            if (game === 'codm') {
                const response = await fetch(`${apiUrl}/api/generate/codm`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        device_name: device,
                        finger_count: fingerCount
                    })
                });
                result = await response.json();
            } else {
                const calculatorType = effectiveRole === 'vip' ? 'vip' : 'free';
                const response = await fetch(`${apiUrl}/api/generate/freefire`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        device_name: device,
                        play_style: playStyle || 'balanced',
                        experience_level: experience,
                        calculator_type: calculatorType
                    })
                });
                result = await response.json();
            }

            if (!result.success) {
                let errorMsg = `❌ **Error:** ${result.message || 'Failed to generate sensitivity'}\n\n`;
                
                if (result.suggestions && result.suggestions.length > 0) {
                    errorMsg += '**Did you mean:**\n';
                    result.suggestions.forEach(s => errorMsg += `• ${s}\n`);
                }
                
                errorMsg += '\n📱 Visit https://gamingsensitivity.vercel.app to find the exact device name.';
                return await interaction.editReply(errorMsg);
            }

            // Update user stats
            const today = new Date().toISOString().split('T')[0];
            if (userData.lastGenerationDate !== today) {
                userData.generationsToday = 0;
            }
            userData.generationsToday++;
            userData.totalGenerations++;
            userData.lastGenerationDate = today;
            await github.saveSensiUsers(sensiData, `Generation by ${username}`);

            // Log generation
            const generationsData = await github.getSensiGenerations();
            generationsData.logs.push({
                id: Date.now().toString(),
                userId: userId,
                username: username,
                serverId: serverId,
                serverName: interaction.guild?.name || 'DM',
                game: game,
                deviceName: device,
                calculatorType: result.calculator_type || 'free',
                generatedAt: new Date().toISOString()
            });
            await github.saveSensiGenerations(generationsData, 'Log generation');

            // Format response
            const roleEmoji = effectiveRole === 'vip' ? '⭐' : '🆓';

            if (game === 'codm') {
                const mp = result.data.mp;
                const embed = new EmbedBuilder()
                    .setTitle(`${roleEmoji} CODM Sensitivity Settings`)
                    .setColor(0x5865F2)
                    .setDescription(`**Device:** ${device}\n**Fingers:** ${fingerCount}`)
                    .addFields(
                        {
                            name: '📸 Camera & Movement',
                            value: `Camera FPP: **${mp.cameraFpp}**\nSteering: **${mp.steeringSensitivity}**\nVertical: **${mp.verticalTurningSensitivity}**`,
                            inline: true
                        },
                        {
                            name: '🎯 ADS Sensitivity',
                            value: `Red Dot: **${mp.redDot}**\nADS: **${mp.adsSensitivity}**\n4x Scope: **${mp.scope4x}**\nSniper: **${mp.sniperScope}**`,
                            inline: true
                        },
                        {
                            name: '🔫 Firing Sensitivity',
                            value: `Firing Cam: **${mp.firingCameraFpp}**\nFiring Red: **${mp.firingRedDot}**\nFiring 4x: **${mp.firingScope4x}**`,
                            inline: false
                        }
                    )
                    .setFooter({ text: 'gamingsensitivity.vercel.app' })
                    .setTimestamp();

                await interaction.editReply({ embeds: [embed] });
            } else {
                const data = result.data;
                const embed = new EmbedBuilder()
                    .setTitle(`${roleEmoji} Free Fire Sensitivity Settings`)
                    .setColor(effectiveRole === 'vip' ? 0xFFD700 : 0xFF4500)
                    .setDescription(`**Device:** ${device}\n**Play Style:** ${playStyle}\n**Experience:** ${experience}\n**Calculator:** ${effectiveRole.toUpperCase()}`)
                    .addFields({
                        name: '🎯 Sensitivity Values',
                        value: `General: **${data.general}**\nRed Dot: **${data.redDot}**\n2x Scope: **${data.scope2x}**\n4x Scope: **${data.scope4x}**\nSniper: **${data.sniperScope}**\nFree Look: **${data.freeLook}**`
                    })
                    .setFooter({ text: 'gamingsensitivity.vercel.app' })
                    .setTimestamp();

                if (data.recommendedDPI) {
                    embed.addFields({
                        name: '📋 Recommendations',
                        value: `DPI: **${data.recommendedDPI}**\nFire Button: **${data.fireButtonSize}%**\nDrag Angle: **${data.dragAngle}°**`
                    });
                }

                if (effectiveRole === 'free') {
                    embed.addFields({
                        name: '💎 Upgrade to VIP',
                        value: 'Unlock advanced features, more play styles, and image exports!'
                    });
                }

                await interaction.editReply({ embeds: [embed] });
            }

        } catch (error) {
            console.error('Generate error:', error);
            await interaction.editReply('❌ An error occurred. Please try again later.');
        }
    }
};
