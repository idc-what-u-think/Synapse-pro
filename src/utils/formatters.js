const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionsBitField } = require('discord.js');
const { PlayStyle, ExperienceLevel, FingerCount } = require('../types/gameEnums');

// Existing utility functions
function formatDate(date) {
    return `<t:${Math.floor(date.getTime() / 1000)}:F>`;
}

function formatPermissions(permissions) {
    return permissions
        .toArray()
        .map(perm => perm.toLowerCase().replace(/_/g, ' '))
        .map(perm => perm.charAt(0).toUpperCase() + perm.slice(1))
        .join(', ');
}

// New sensitivity formatting functions
class ResultFormatter {
    static createFFEmbed(device, settings, playStyle, experienceLevel) {
        // Validate settings object
        if (!settings) {
            throw new Error('Settings object is required');
        }

        return new EmbedBuilder()
            .setTitle('🎯 Free Fire Sensitivity Settings')
            .setDescription(`Optimized settings for **${device.name}**`)
            .setColor(0x2563eb) // Use hex number instead of string
            .addFields(
                { 
                    name: '📱 Device Information', 
                    value: this.formatDeviceInfo(device), 
                    inline: false 
                },
                { 
                    name: '🎮 Configuration', 
                    value: `**Play Style:** ${playStyle}\n**Experience Level:** ${experienceLevel}`, 
                    inline: false 
                },
                { 
                    name: '⚙️ Sensitivity Settings', 
                    value: this.formatFFSensitivitySettings(settings), 
                    inline: false 
                }
            )
            .setTimestamp()
            .setFooter({ 
                text: 'Sensitivity Calculator • Generated at'
            });
    }

    static createCODMEmbed(device, settings, fingerCount, mode = 'mp') {
        // Validate settings object
        if (!settings || !settings[mode]) {
            throw new Error(`Settings object or ${mode} mode settings are missing`);
        }

        const modeSettings = settings[mode];
        const modeName = mode === 'mp' ? 'Multiplayer' : 'Battle Royale';
        const modeEmoji = mode === 'mp' ? '⚔️' : '🏟️';

        return new EmbedBuilder()
            .setTitle(`${modeEmoji} CODM ${modeName} Settings`)
            .setDescription(`Optimized settings for **${device.name}**`)
            .setColor(0x2563eb) // Use hex number instead of string
            .addFields(
                { 
                    name: '📱 Device Information', 
                    value: this.formatDeviceInfo(device), 
                    inline: false 
                },
                { 
                    name: '🎮 Configuration', 
                    value: `**Control Type:** ${fingerCount}\n**Game Mode:** ${modeName}`, 
                    inline: false 
                },
                { 
                    name: '📷 Camera Settings', 
                    value: this.formatCODMCameraSettings(modeSettings), 
                    inline: true 
                },
                { 
                    name: '🔍 ADS Settings', 
                    value: this.formatCODMADSSettings(modeSettings), 
                    inline: true 
                },
                { 
                    name: '🔥 Firing Settings', 
                    value: this.formatCODMFiringSettings(modeSettings), 
                    inline: true 
                }
            )
            .setTimestamp()
            .setFooter({ 
                text: 'Sensitivity Calculator • Generated at'
            });
    }

    static formatDeviceInfo(device) {
        if (!device) {
            return 'Device information not available';
        }

        const lines = [`📱 **${device.name}**`];
        
        if (device.refreshRate) {
            lines.push(`🔄 ${device.refreshRate}Hz Refresh Rate`);
        }
        
        if (device.touchSamplingRate) {
            lines.push(`📱 ${device.touchSamplingRate}Hz Touch Rate`);
        }
        
        if (device.processorScore) {
            lines.push(`📊 Performance Score: ${device.processorScore}`);
        }

        return lines.join('\n');
    }

    static formatFFSensitivitySettings(settings) {
        const lines = [];
        
        if (settings.general !== undefined && settings.general !== null) {
            lines.push(`**General:** ${settings.general}`);
        }
        if (settings.redDot !== undefined && settings.redDot !== null) {
            lines.push(`**Red Dot:** ${settings.redDot}`);
        }
        if (settings.scope2x !== undefined && settings.scope2x !== null) {
            lines.push(`**2x Scope:** ${settings.scope2x}`);
        }
        if (settings.scope4x !== undefined && settings.scope4x !== null) {
            lines.push(`**4x Scope:** ${settings.scope4x}`);
        }
        if (settings.sniperScope !== undefined && settings.sniperScope !== null) {
            lines.push(`**Sniper Scope:** ${settings.sniperScope}`);
        }
        if (settings.freeLook !== undefined && settings.freeLook !== null) {
            lines.push(`**Free Look:** ${settings.freeLook}`);
        }

        return lines.length > 0 ? lines.join('\n') : 'No sensitivity settings available';
    }

    static createButtons() {
        return new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('copy_settings')
                    .setLabel('Copy Settings')
                    .setEmoji('📋')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('share_settings')
                    .setLabel('Share')
                    .setEmoji('🔗')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('export_settings')
                    .setLabel('Export Image')
                    .setEmoji('📥')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId('reconfigure')
                    .setLabel('Reconfigure')
                    .setEmoji('⚙️')
                    .setStyle(ButtonStyle.Danger)
            );
    }

    static createModeButtons() {
        return new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('mode_mp')
                    .setLabel('Multiplayer')
                    .setEmoji('⚔️')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('mode_br')
                    .setLabel('Battle Royale')
                    .setEmoji('🏟️')
                    .setStyle(ButtonStyle.Secondary)
            );
    }

    static formatCODMCameraSettings(settings) {
        if (!settings) {
            return 'Camera settings not available';
        }

        const lines = [];
        
        if (settings.cameraFpp !== undefined && settings.cameraFpp !== null) {
            lines.push(`**Camera:** ${settings.cameraFpp}`);
        }
        if (settings.steeringSensitivity !== undefined && settings.steeringSensitivity !== null) {
            lines.push(`**Steering:** ${settings.steeringSensitivity}`);
        }
        if (settings.verticalTurningSensitivity !== undefined && settings.verticalTurningSensitivity !== null) {
            lines.push(`**Vertical:** ${settings.verticalTurningSensitivity}`);
        }
        if (settings.thirdPersonSensitivity !== undefined && settings.thirdPersonSensitivity !== null) {
            lines.push(`**Third Person:** ${settings.thirdPersonSensitivity}`);
        }

        return lines.length > 0 ? lines.join('\n') : 'No camera settings available';
    }

    static formatCODMADSSettings(settings) {
        if (!settings) {
            return 'ADS settings not available';
        }

        const lines = [];
        
        if (settings.redDot !== undefined && settings.redDot !== null) {
            lines.push(`**Red Dot:** ${settings.redDot}`);
        }
        if (settings.adsSensitivity !== undefined && settings.adsSensitivity !== null) {
            lines.push(`**General:** ${settings.adsSensitivity}`);
        }
        if (settings.tacticalScope !== undefined && settings.tacticalScope !== null) {
            lines.push(`**Tactical:** ${settings.tacticalScope}`);
        }
        if (settings.scope3x !== undefined && settings.scope3x !== null) {
            lines.push(`**3x:** ${settings.scope3x}`);
        }
        if (settings.scope4x !== undefined && settings.scope4x !== null) {
            lines.push(`**4x:** ${settings.scope4x}`);
        }
        if (settings.scope6x !== undefined && settings.scope6x !== null) {
            lines.push(`**6x:** ${settings.scope6x}`);
        }
        if (settings.scope8x !== undefined && settings.scope8x !== null) {
            lines.push(`**8x:** ${settings.scope8x}`);
        }
        if (settings.sniperScope !== undefined && settings.sniperScope !== null) {
            lines.push(`**Sniper:** ${settings.sniperScope}`);
        }

        return lines.length > 0 ? lines.join('\n') : 'No ADS settings available';
    }

    static formatCODMFiringSettings(settings) {
        if (!settings) {
            return 'Firing settings not available';
        }

        const lines = [];
        
        if (settings.firingCameraFpp !== undefined && settings.firingCameraFpp !== null) {
            lines.push(`**Camera:** ${settings.firingCameraFpp}`);
        }
        if (settings.firingRedDot !== undefined && settings.firingRedDot !== null) {
            lines.push(`**Red Dot:** ${settings.firingRedDot}`);
        }
        if (settings.firingTacticalScope !== undefined && settings.firingTacticalScope !== null) {
            lines.push(`**Tactical:** ${settings.firingTacticalScope}`);
        }
        if (settings.firingScope3x !== undefined && settings.firingScope3x !== null) {
            lines.push(`**3x:** ${settings.firingScope3x}`);
        }
        if (settings.firingScope4x !== undefined && settings.firingScope4x !== null) {
            lines.push(`**4x:** ${settings.firingScope4x}`);
        }
        if (settings.firingScope6x !== undefined && settings.firingScope6x !== null) {
            lines.push(`**6x:** ${settings.firingScope6x}`);
        }
        if (settings.firingScope8x !== undefined && settings.firingScope8x !== null) {
            lines.push(`**8x:** ${settings.firingScope8x}`);
        }

        return lines.length > 0 ? lines.join('\n') : 'No firing settings available';
    }

    // Utility method to create settings text for copying
    static createSettingsText(device, settings, game, additionalInfo = {}) {
        const lines = [
            `🎯 ${game === 'FF' ? 'Free Fire' : 'Call of Duty Mobile'} Sensitivity Settings`,
            `📱 Device: ${device.name}`,
            '',
        ];

        if (game === 'FF') {
            if (additionalInfo.playStyle) {
                lines.push(`🎮 Play Style: ${additionalInfo.playStyle}`);
            }
            if (additionalInfo.experienceLevel) {
                lines.push(`📈 Experience: ${additionalInfo.experienceLevel}`);
            }
            lines.push('');
            lines.push('⚙️ Sensitivity Settings:');
            
            if (settings.general !== undefined) lines.push(`General: ${settings.general}`);
            if (settings.redDot !== undefined) lines.push(`Red Dot: ${settings.redDot}`);
            if (settings.scope2x !== undefined) lines.push(`2x Scope: ${settings.scope2x}`);
            if (settings.scope4x !== undefined) lines.push(`4x Scope: ${settings.scope4x}`);
            if (settings.sniperScope !== undefined) lines.push(`Sniper Scope: ${settings.sniperScope}`);
            if (settings.freeLook !== undefined) lines.push(`Free Look: ${settings.freeLook}`);
        } else {
            if (additionalInfo.fingerCount) {
                lines.push(`✋ Control Type: ${additionalInfo.fingerCount}`);
            }
            
            const mode = additionalInfo.mode || 'mp';
            const modeSettings = settings[mode];
            const modeName = mode === 'mp' ? 'Multiplayer' : 'Battle Royale';
            
            lines.push(`🎮 Mode: ${modeName}`);
            lines.push('');
            
            // Camera settings
            lines.push('📷 Camera Settings:');
            if (modeSettings.cameraFpp !== undefined) lines.push(`Camera: ${modeSettings.cameraFpp}`);
            if (modeSettings.steeringSensitivity !== undefined) lines.push(`Steering: ${modeSettings.steeringSensitivity}`);
            if (modeSettings.verticalTurningSensitivity !== undefined) lines.push(`Vertical: ${modeSettings.verticalTurningSensitivity}`);
            
            lines.push('');
            
            // ADS settings
            lines.push('🔍 ADS Settings:');
            if (modeSettings.redDot !== undefined) lines.push(`Red Dot: ${modeSettings.redDot}`);
            if (modeSettings.adsSensitivity !== undefined) lines.push(`General: ${modeSettings.adsSensitivity}`);
            if (modeSettings.tacticalScope !== undefined) lines.push(`Tactical: ${modeSettings.tacticalScope}`);
            if (modeSettings.scope3x !== undefined) lines.push(`3x: ${modeSettings.scope3x}`);
            if (modeSettings.scope4x !== undefined) lines.push(`4x: ${modeSettings.scope4x}`);
            
            lines.push('');
            
            // Firing settings
            lines.push('🔥 Firing Settings:');
            if (modeSettings.firingCameraFpp !== undefined) lines.push(`Camera: ${modeSettings.firingCameraFpp}`);
            if (modeSettings.firingRedDot !== undefined) lines.push(`Red Dot: ${modeSettings.firingRedDot}`);
            if (modeSettings.firingTacticalScope !== undefined) lines.push(`Tactical: ${modeSettings.firingTacticalScope}`);
        }

        return lines.join('\n');
    }

    static handleModeSwitch(interaction, settings, device, fingerCount, mode) {
        const embed = this.createCODMEmbed(device, settings, fingerCount, mode);
        const buttons = this.createButtons();
        const modeButtons = this.createModeButtons();
        
        return {
            embeds: [embed],
            components: [modeButtons, buttons]
        };
    }
}

module.exports = { 
    ResultFormatter, 
    formatDate, 
    formatPermissions 
};
