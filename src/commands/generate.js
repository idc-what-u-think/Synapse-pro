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
                .setDescription('Your device name (e.g., iPhone 14 Pro)')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('finger_count')
                .setDescription('[CODM Only] Number of fingers')
                .addChoices(
                    { name: '2 Fingers', value: '2fingers' },
                    { name: '3 Fingers', value: '3fingers' },
                    { name: '4 Fingers', value: '4fingers' },
                    { name: '4+', value: '4+' }
                ))
        .addStringOption(option =>
            option.setName('play_style')
                .setDescription('[Free Fire] Your play style')
                .addChoices(
                    { name: 'Balanced', value: 'balanced' },
                    { name: 'Aggressive', value: 'aggressive' },
                    { name: 'Precise', value: 'precise' },
                    { name: 'Defensive', value: 'defensive' }
                ))
        .addStringOption(option =>
            option.setName('experience')
                .setDescription('[Free Fire] Your experience')
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

        // DEFER IMMEDIATELY - BEFORE ANY OTHER CODE
        await interaction.deferReply();

        try {
            // Load user data
            let sensiData = await github.getSensiUsers();
            if (!sensiData || !sensiData.users) {
                sensiData = { users: {} };
            }
            
            const userData = sensiData.users[userId];

            if (!userData) {
                return await interaction.editReply({
                    content: '❌ You don\'t have an account! Use `/signup` first.'
                });
            }

            // Check if banned
            if (userData.isBanned) {
                return await interaction.editReply({
                    content: `🚫 **You are banned.**\nReason: ${userData.banReason || 'Not specified'}`
                });
            }

            // Validate requirements
            if (game === 'codm' && !fingerCount) {
                return await interaction.editReply({
                    content: '❌ **Error:** CODM requires finger count selection.'
                });
            }

            if (game === 'freefire' && (!playStyle || !experience)) {
                return await interaction.editReply({
                    content: '❌ **Error:** Free Fire requires play style and experience level.'
                });
            }

            const effectiveRole = userData.role;

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
                let errorMsg = `❌ **Error:** ${result.message}\n\n`;
                if (result.suggestions && result.suggestions.length > 0) {
                    errorMsg += '**Did you mean:**\n' + result.suggestions.map(s => `• ${s}`).join('\n');
                }
                errorMsg += '\n\n📱 Visit https://gamingsensitivity.vercel.app';
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

            // Log generation - FIX: Ensure logs array exists
            let generationsData = await github.getSensiGenerations();
            if (!generationsData || !generationsData.logs) {
                generationsData = { logs: [] };
            }
            
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

            // Send result
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
                    .setColor(0xFF4500)
                    .setDescription(`**Device:** ${device}\n**Style:** ${playStyle}\n**Experience:** ${experience}`)
                    .addFields(
                        {
                            name: '🎯 Sensitivity Values',
                            value: `General: **${data.general}**\nRed Dot: **${data.redDot}**\n2x Scope: **${data.scope2x}**\n4x Scope: **${data.scope4x}**\nSniper: **${data.sniperScope}**\nFree Look: **${data.freeLook}**`,
                            inline: false
                        }
                    )
                    .setFooter({ text: 'gamingsensitivity.vercel.app' })
                    .setTimestamp();

                if (data.recommendedDPI) {
                    embed.addFields({
                        name: '📋 Recommendations',
                        value: `DPI: **${data.recommendedDPI}**\nFire Button: **${data.fireButtonSize}%**\nDrag Angle: **${data.dragAngle}°**`
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
