const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

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
                    { name: 'Aggressive', value: 'aggressive' },
                    { name: 'Precise', value: 'precise' },
                    { name: 'Defensive', value: 'defensive' }
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

        await interaction.deferReply();

        try {
            // Call your website API
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
                const response = await fetch(`${apiUrl}/api/generate/freefire`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        device_name: device,
                        play_style: playStyle,
                        experience_level: experience,
                        calculator_type: 'free'
                    })
                });
                result = await response.json();
            }

            if (!result.success) {
                let errorMsg = `❌ **Error:** ${result.message || 'Failed to generate sensitivity'}\n\n`;
                
                if (result.suggestions && result.suggestions.length > 0) {
                    errorMsg += '**Did you mean:**\n';
                    result.suggestions.forEach(s => {
                        errorMsg += `• ${s}\n`;
                    });
                    errorMsg += '\n';
                }
                
                errorMsg += '📱 Visit https://gamingsensitivity.vercel.app to find the exact device name.';
                
                return await interaction.editReply(errorMsg);
            }

            // Format response
            if (game === 'codm') {
                const mp = result.data.mp;
                const embed = new EmbedBuilder()
                    .setTitle('🎮 CODM Sensitivity Settings')
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
                    .setTitle('🎮 Free Fire Sensitivity Settings')
                    .setColor(0xFF4500)
                    .setDescription(`**Device:** ${device}\n**Play Style:** ${playStyle}\n**Experience:** ${experience}`)
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
            await interaction.editReply('❌ An error occurred while generating sensitivity settings. Please try again later.');
        }
    }
};
