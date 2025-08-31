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
        const baseMultiplier = this.calculateBaseMultiplier(device);
        const playStyleMultiplier = this.getPlayStyleMultiplier(playStyle);
        const experienceMultiplier = this.getExperienceMultiplier(experienceLevel);

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
        const baseMultiplier = this.calculateBaseMultiplier(device);
        const fingerMultiplier = this.getFingerCountMultiplier(fingerCount);

        return {
            mp: this.generateCODMGameMode(baseMultiplier, fingerMultiplier, false),
            br: this.generateCODMGameMode(baseMultiplier, fingerMultiplier, true)
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
        const refreshRateScore = device.refreshRate / 60;
        const touchRateScore = device.touchSamplingRate / 120;
        const performanceScore = (device.processorScore + device.gpuScore) / 200;
        
        return (refreshRateScore * 0.4 + touchRateScore * 0.4 + performanceScore * 0.2);
    }

    // ... other existing helper methods remain unchanged ...
}

module.exports = { WebsiteAPI };
