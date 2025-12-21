const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

const API_KEY = 'sk_f0ebb47d0fe12f5811542e45b18218b1340ca2727bf07fe1737a51069613d285';
const API_URL = 'https://gamingsensitivity.vercel.app';

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
                    { name: 'Aggressive', value: 'aggressive' },
                    { name: 'Rusher', value: 'rusher' },
                    { name: 'Precise', value: 'precise' },
                    { name: 'Sniper', value: 'sniper' },
                    { name: 'Balanced', value: 'balanced' },
                    { name: 'Versatile', value: 'versatile' },
                    { name: 'Defensive', value: 'defensive' }
                ))
        .addStringOption(option =>
            option.setName('experience')
                .setDescription('[Free Fire] Your experience level')
                .addChoices(
                    { name: 'Beginner', value: 'beginner' },
                    { name: 'Novice', value: 'novice' },
                    { name: 'Intermediate', value: 'intermediate' },
                    { name: 'Casual', value: 'casual' },
                    { name: 'Advanced', value: 'advanced' },
                    { name: 'Experienced', value: 'experienced' },
                    { name: 'Professional', value: 'professional' },
                    { name: 'Expert', value: 'expert' }
                ))
        .addStringOption(option =>
            option.setName('calculator_type')
                .setDescription('[Free Fire] Calculator type (default: free)')
                .addChoices(
                    { name: 'Free', value: 'free' },
                    { name: 'VIP', value: 'vip' }
                )),
    
    async execute(interaction) {
        const game = interaction.options.getString('game');
        const device = interaction.options.getString('device');
        const fingerCount = interaction.options.getString('finger_count');
        const playStyle = interaction.options.getString('play_style');
        const experience = interaction.options.getString('experience');
        const calculatorType = interaction.options.getString('calculator_type') || 'free';

        // Defer reply immediately
        await interaction.deferReply();

        try {
            // Validate game-specific requirements
            if (game === 'codm' && !fingerCount) {
                return await interaction.editReply({
                    content: '❌ **Error:** CODM requires finger count selection.\n\nPlease use the `/generate` command again and select a finger count option.'
                });
            }

            if (game === 'freefire' && (!playStyle || !experience)) {
                return await interaction.editReply({
                    content: '❌ **Error:** Free Fire requires both play style and experience level.\n\nPlease use the `/generate` command again and fill in all required options.'
                });
            }

            // Generate sensitivity based on game
            let result;

            if (game === 'codm') {
                const response = await fetch(`${API_URL}/api/generate/codm`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-API-Key': API_KEY
                    },
                    body: JSON.stringify({
                        device_name: device,
                        finger_count: fingerCount
                    })
                });
                result = await response.json();
            } else {
                const response = await fetch(`${API_URL}/api/generate/freefire`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-API-Key': API_KEY
                    },
                    body: JSON.stringify({
                        device_name: device,
                        play_style: playStyle,
                        experience_level: experience,
                        calculator_type: calculatorType
                    })
                });
                result = await response.json();
            }

            // Handle API errors
            if (!result.success) {
                let errorMsg = `❌ **Error:** ${result.message}\n\n`;
                if (result.suggestions && result.suggestions.length > 0) {
                    errorMsg += '**💡 Did you mean:**\n' + result.suggestions.map(s => `• ${s}`).join('\n');
                }
                errorMsg += '\n\n📱 Visit: https://gamingsensitivity.vercel.app';
                return await interaction.editReply(errorMsg);
            }

            // Send result based on game
            const roleEmoji = calculatorType === 'vip' ? '⭐' : '🆓';

            if (game === 'codm') {
                const mp = result.data.mp;
                const embed = new EmbedBuilder()
                    .setTitle(`${roleEmoji} CODM Sensitivity Settings`)
                    .setColor(0x5865F2)
                    .setDescription(`**📱 Device:** ${device}\n**🖐️ Fingers:** ${fingerCount}`)
                    .addFields(
                        {
                            name: '📸 Camera & Movement',
                            value: `\`\`\`\nCamera FPP: ${mp.cameraFpp}\nSteering:   ${mp.steeringSensitivity}\nVertical:   ${mp.verticalTurningSensitivity}\`\`\``,
                            inline: false
                        },
                        {
                            name: '🎯 ADS Sensitivity',
                            value: `\`\`\`\nRed Dot:  ${mp.redDot}\nADS:      ${mp.adsSensitivity}\n4x Scope: ${mp.scope4x}\nSniper:   ${mp.sniperScope}\`\`\``,
                            inline: true
                        },
                        {
                            name: '🔫 Firing Sensitivity',
                            value: `\`\`\`\nFiring Cam:  ${mp.firingCameraFpp}\nFiring Red:  ${mp.firingRedDot}\nFiring 4x:   ${mp.firingScope4x}\`\`\``,
                            inline: true
                        }
                    )
                    .setFooter({ text: '🎮 gamingsensitivity.vercel.app' })
                    .setTimestamp();

                await interaction.editReply({ embeds: [embed] });
            } else {
                const data = result.data;
                const embed = new EmbedBuilder()
                    .setTitle(`${roleEmoji} Free Fire Sensitivity Settings`)
                    .setColor(0xFF4500)
                    .setDescription(
                        `**📱 Device:** ${device}\n` +
                        `**🎯 Play Style:** ${playStyle}\n` +
                        `**🎓 Experience:** ${experience}\n` +
                        `**💎 Type:** ${calculatorType.toUpperCase()}`
                    )
                    .addFields(
                        {
                            name: '🎯 Sensitivity Values',
                            value: `\`\`\`\nGeneral:    ${data.general}\nRed Dot:    ${data.redDot}\n2x Scope:   ${data.scope2x}\n4x Scope:   ${data.scope4x}\nSniper:     ${data.sniperScope}\nFree Look:  ${data.freeLook}\`\`\``,
                            inline: false
                        }
                    )
                    .setFooter({ text: '🎮 gamingsensitivity.vercel.app' })
                    .setTimestamp();

                if (data.recommendedDPI) {
                    embed.addFields({
                        name: '💡 Recommendations',
                        value: `\`\`\`\nDPI:         ${data.recommendedDPI}\nFire Button: ${data.fireButtonSize}%\nDrag Angle:  ${data.dragAngle}°\`\`\``,
                        inline: false
                    });
                }

                await interaction.editReply({ embeds: [embed] });
            }

        } catch (error) {
            console.error('Generate error:', error);
            await interaction.editReply({
                content: '❌ **An error occurred while generating sensitivity settings.**\n\n' +
                         'Please try again later or contact support if the issue persists.\n\n' +
                         `Error: ${error.message}`
            });
        }
    }
};
