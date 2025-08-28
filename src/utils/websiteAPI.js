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

    async verifyUser(username, password) {
        try {
            const response = await this.client.post('/auth/verify', {
                username,
                password
            });
            return { success: true, data: response.data };
        } catch (error) {
            return { 
                success: false, 
                error: error.response?.data?.error || 'Authentication failed' 
            };
        }
    }

    async getUserInfo(username) {
        try {
            const response = await this.client.get(`/auth/verify?username=${encodeURIComponent(username)}`);
            return { success: true, data: response.data };
        } catch (error) {
            return { 
                success: false, 
                error: error.response?.data?.error || 'User not found' 
            };
        }
    }

    async searchDevices(query) {
        try {
            const response = await this.client.get(`/devices/search?q=${encodeURIComponent(query)}`);
            return { success: true, data: response.data };
        } catch (error) {
            return { 
                success: false, 
                error: error.response?.data?.error || 'Device search failed' 
            };
        }
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

    async getDeviceDetails(deviceNames) {
        try {
            const response = await this.client.post('/devices/search', {
                devices: deviceNames
            });
            return { success: true, data: response.data };
        } catch (error) {
            return { 
                success: false, 
                error: error.response?.data?.error || 'Device details fetch failed' 
            };
        }
    }
}

module.exports = { WebsiteAPI };
