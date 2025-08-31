const axios = require('axios');
const API_BASE_URL = process.env.WEBSITE_API_URL || 'https://ffsensiwizard.vercel.app/api';

class WebsiteAPI {
    constructor(baseUrl = API_BASE_URL) {
        this.baseUrl = baseUrl;
        this.client = axios.create({
            baseURL: this.baseUrl,
            timeout: 30000,
            headers: {
                'Content-Type': 'application/json'
            }
        });
    }

    // ... existing authentication and user methods ...

    static calculateFFSensitivity(device, playStyle, experienceLevel) {
        const baseMultiplier = WebsiteAPI.calculateBaseMultiplier(device); // Changed from this.
        const playStyleMultiplier = WebsiteAPI.getPlayStyleMultiplier(playStyle); // Changed from this.
        const experienceMultiplier = WebsiteAPI.getExperienceMultiplier(experienceLevel); // Changed from this.
        
        return {
            general: Math.round(100 * baseMultiplier * playStyleMultiplier * experienceMultiplier),
            redDot: Math.round(95 * baseMultiplier * playStyleMultiplier * experienceMultiplier),
            scope2x: Math.round(85 * baseMultiplier * playStyleMultiplier * experienceMultiplier),
            scope4x: Math.round(75 * baseMultiplier * playStyleMultiplier * experienceMultiplier),
            sniperScope: Math.round(65 * baseMultiplier * playStyleMultiplier * experienceMultiplier),
            freeLook: Math.round(100 * baseMultiplier * playStyleMultiplier * experienceMultiplier),
        };
    }

    static calculateCODMSensitivity(device, fingerCount) {
        const baseMultiplier = WebsiteAPI.calculateBaseMultiplier(device); // Changed from this.
        const fingerMultiplier = WebsiteAPI.getFingerCountMultiplier(fingerCount); // Changed from this.
        
        return {
            mp: WebsiteAPI.generateCODMGameMode(baseMultiplier, fingerMultiplier, false), // Changed from this.
            br: WebsiteAPI.generateCODMGameMode(baseMultiplier, fingerMultiplier, true) // Changed from this.
        };
    }

    async calculateSensitivity(params) {
        const { username, password, game, device, playstyle, fingers } = params;
        
        try {
            const response = await this.client.post('/sensitivity', {
                username,
                password,
                game,
                device,
                playstyle,
                fingers
            });
            return { success: true, data: response.data };
        } catch (error) {
            return { 
                success: false, 
                error: error.response?.data?.error || 'Sensitivity calculation failed' 
            };
        }
    }

    static calculateBaseMultiplier(device) {
        if (!device) return 1;
        
        const refreshRateScore = (device.refreshRate || 60) / 60;
        const touchRateScore = (device.touchSamplingRate || 120) / 120;
        const performanceScore = ((device.processorScore || 80) + (device.gpuScore || 80)) / 200;
        
        return (refreshRateScore * 0.4 + touchRateScore * 0.4 + performanceScore * 0.2);
    }

    // Add the missing static helper methods:
    static getPlayStyleMultiplier(playStyle) {
        const multipliers = {
            'Aggressive': 1.1,
            'Balanced': 1.0,
            'Passive': 0.9
        };
        return multipliers[playStyle] || 1.0;
    }

    static getExperienceMultiplier(experienceLevel) {
        const multipliers = {
            'Beginner': 0.8,
            'Intermediate': 0.9,
            'Advanced': 1.0,
            'Professional': 1.1
        };
        return multipliers[experienceLevel] || 1.0;
    }

    static getFingerCountMultiplier(fingerCount) {
        const multipliers = {
            '2 Fingers': 0.8,
            '3 Fingers': 0.9,
            '4 Fingers': 1.0,
            '5 Fingers': 1.1,
            '6 Fingers': 1.15,
            '7 Fingers': 1.2,
            '8 Fingers': 1.25
        };
        return multipliers[fingerCount] || 1.0;
    }

    static generateCODMGameMode(baseMultiplier, fingerMultiplier, isBattleRoyale) {
        const modeMultiplier = isBattleRoyale ? 0.95 : 1.0;
        const finalMultiplier = baseMultiplier * fingerMultiplier * modeMultiplier;

        return {
            // Camera settings
            cameraFpp: Math.round(65 * finalMultiplier),
            steeringSensitivity: Math.round(70 * finalMultiplier),
            verticalTurningSensitivity: Math.round(60 * finalMultiplier),
            thirdPersonSensitivity: Math.round(65 * finalMultiplier),
            
            // ADS settings
            redDot: Math.round(58 * finalMultiplier),
            adsSensitivity: Math.round(55 * finalMultiplier),
            tacticalScope: Math.round(50 * finalMultiplier),
            scope3x: Math.round(45 * finalMultiplier),
            scope4x: Math.round(40 * finalMultiplier),
            scope6x: Math.round(35 * finalMultiplier),
            scope8x: Math.round(30 * finalMultiplier),
            sniperScope: Math.round(25 * finalMultiplier),
            
            // Firing settings
            firingCameraFpp: Math.round(60 * finalMultiplier),
            firingRedDot: Math.round(55 * finalMultiplier),
            firingTacticalScope: Math.round(50 * finalMultiplier),
            firingScope3x: Math.round(45 * finalMultiplier),
            firingScope4x: Math.round(40 * finalMultiplier),
            firingScope6x: Math.round(35 * finalMultiplier),
            firingScope8x: Math.round(30 * finalMultiplier)
        };
    }
}

module.exports = { WebsiteAPI };
