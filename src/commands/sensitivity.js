const { SlashCommandBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ActionRowBuilder, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { createClient } = require('@supabase/supabase-js');
const { WebsiteAPI } = require('../utils/websiteAPI');
const github = require('../utils/github');
const fetch = require('node-fetch'); // Make sure to install: npm install node-fetch

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const websiteAPI = new WebsiteAPI();

// Your API base URL
const API_BASE_URL = process.env.WEBSITE_API_URL || 'https://your-website.com'; // Add this to your .env

// Helper function to safely respond to interactions
async function safeInteractionReply(interaction, options) {
    try {
        if (interaction.replied) {
            return await interaction.editReply(options);
        } else if (interaction.deferred) {
            return await interaction.editReply(options);
        } else {
            return await interaction.reply(options);
        }
    } catch (error) {
        console.error('Failed to respond to interaction:', error);
        if (error.code !== 40060) {
            try {
                return await interaction.followUp({ ...options, ephemeral: true });
            } catch (followUpError) {
                console.error('Follow-up also failed:', followUpError);
            }
        }
    }
}

// Helper function to safely update interactions
async function safeInteractionUpdate(interaction, options) {
    try {
        return await interaction.update(options);
    } catch (error) {
        console.error('Failed to update interaction:', error);
        if (error.code === 10062 || error.code === 40060) {
            return await safeInteractionReply(interaction, options);
        }
        throw error;
    }
}

// Device search function using your API
async function searchDevicesFromAPI(query) {
    try {
        if (!query || query.length < 1) return [];
        
        const response = await fetch(`${API_BASE_URL}/api/devices/search?q=${encodeURIComponent(query)}`);
        
        if (!response.ok) {
            console.error('API request failed:', response.status);
            return [];
        }
        
        const data = await response.json();
        return data.devices || [];
    } catch (error) {
        console.error('Device search API error:', error);
        return [];
    }
}

// Fallback to local database if API fails
function searchDevicesLocally(query) {
    try {
        const deviceDatabase = require('../data/deviceDatabase').deviceDatabase;
        const lowercaseQuery = query.toLowerCase();
        
        return Object.keys(deviceDatabase)
            .filter(device => device.toLowerCase().includes(lowercaseQuery))
            .slice(0, 25)
            .map(deviceName => ({
                name: deviceName,
                info: deviceDatabase[deviceName]
            }));
    } catch (error) {
        console.error('Local device search error:', error);
        return [];
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('sensitivity')
        .setDescription('Generate sensitivity settings for your device')
        .addStringOption(option =>
            option.setName('device')
                .setDescription('Search for your device (start typing to see suggestions)')
                .setAutocomplete(true)
                .setRequired(true)
        ),
    
    async execute(interaction) {
        const userId = interaction.user.id;
        const deviceQuery = interaction.options.getString('device');
        
        try {
            await interaction.deferReply({ ephemeral: true });

            const linkedUsers = await github.getData('data/linked_users.json') || {};
            
            if (!linkedUsers[userId]) {
                await interaction.editReply({
                    content: '❌ You need to link your account first using `/login`'
                });
                return;
            }

            const userData = linkedUsers[userId];

            const { data: user, error: userError } = await supabase
                .from('users')
                .select('*')
                .eq('id', userData.supabaseUserId)
                .single();

            if (userError || !user) {
                await interaction.editReply({
                    content: '❌ Account verification failed. Please login again with `/login`'
                });
                return;
            }

            if (user.suspended_at) {
                let suspensionMessage = '❌ Your account is suspended';
                if (user.suspension_reason) {
                    suspensionMessage += `\nReason: ${user.suspension_reason}`;
                }
                await interaction.editReply({
                    content: suspensionMessage
                });
                return;
            }

            let vipStatus = 'Regular';
            if (user.vip_expires_at) {
                const vipExpiry = new Date(user.vip_expires_at);
                if (vipExpiry > new Date()) {
                    vipStatus = 'VIP';
                } else {
                    vipStatus = 'VIP Expired';
                }
            }

            // Update user data
            linkedUsers[userId] = {
                ...linkedUsers[userId],
                role: user.role,
                vipStatus: vipStatus,
                vipExpiresAt: user.vip_expires_at,
                lastVerified: new Date().toISOString(),
                selectedDevice: deviceQuery // Store the selected device
            };
            await github.saveData('data/linked_users.json', linkedUsers, 'Update user verification');

            // Now proceed with game selection since device is already chosen
            const gameSelect = new StringSelectMenuBuilder()
                .setCustomId('game_select')
                .setPlaceholder('Choose a game')
                .addOptions(
                    new StringSelectMenuOptionBuilder()
                        .setLabel('Call of Duty Mobile')
                        .setValue('codm')
                        .setEmoji('🔫'),
                    new StringSelectMenuOptionBuilder()
                        .setLabel('Free Fire')
                        .setValue('freefire')
                        .setEmoji('🔥')
                );

            const row = new ActionRowBuilder().addComponents(gameSelect);

            let welcomeMessage = `Welcome ${user.username}! (${user.role})`;
            if (vipStatus === 'VIP') {
                welcomeMessage += ` 👑`;
            }
            welcomeMessage += `\n📱 **Device Selected:** ${deviceQuery}\nSelect your game:`;

            await interaction.editReply({
                content: welcomeMessage,
                components: [row]
            });

        } catch (error) {
            console.error('Sensitivity command error:', error);
            await safeInteractionReply(interaction, {
                content: '❌ An error occurred. Please try again.',
                ephemeral: true
            });
        }
    },

    // NEW: Autocomplete handler
    async autocomplete(interaction) {
        try {
            const focusedValue = interaction.options.getFocused();
            
            if (!focusedValue || focusedValue.length < 1) {
                // Show popular devices when no input
                try {
                    const deviceDatabase = require('../data/deviceDatabase').deviceDatabase;
                    const popularDevices = Object.keys(deviceDatabase).slice(0, 10);
                    const choices = popularDevices.map(device => ({
                        name: device.length > 100 ? device.substring(0, 97) + '...' : device,
                        value: device
                    }));
                    
                    await interaction.respond(choices);
                } catch (error) {
                    await interaction.respond([]);
                }
                return;
            }

            // First try API search
            let devices = await searchDevicesFromAPI(focusedValue);
            
            // Fallback to local database if API fails or returns empty
            if (devices.length === 0) {
                devices = searchDevicesLocally(focusedValue);
            }

            // Format for Discord autocomplete
            const choices = devices.slice(0, 25).map(device => {
                const deviceName = device.name;
                const specs = device.info;
                
                // Create a descriptive name showing key specs
                let displayName = deviceName;
                if (specs) {
                    const screenSize = specs.screenSize ? `${specs.screenSize}"` : '';
                    const refreshRate = specs.refreshRate ? `${specs.refreshRate}Hz` : '';
                    const additional = [screenSize, refreshRate].filter(Boolean).join(' • ');
                    
                    if (additional) {
                        const maxLength = 100 - additional.length - 3; // Account for " - " separator
                        const truncatedName = deviceName.length > maxLength ? 
                            deviceName.substring(0, maxLength - 3) + '...' : deviceName;
                        displayName = `${truncatedName} - ${additional}`;
                    }
                }
                
                return {
                    name: displayName.length > 100 ? displayName.substring(0, 97) + '...' : displayName,
                    value: deviceName
                };
            });

            await interaction.respond(choices);

        } catch (error) {
            console.error('Autocomplete error:', error);
            // Always respond, even with empty array, to prevent Discord errors
            await interaction.respond([]);
        }
    },

    async handleGameSelection(interaction) {
        try {
            if (!interaction.isStringSelectMenu()) return;
            
            const game = interaction.values[0];
            const userId = interaction.user.id;

            const linkedUsers = await github.getData('data/linked_users.json') || {};
            const userData = linkedUsers[userId];
            
            if (!userData) {
                await safeInteractionUpdate(interaction, {
                    content: '❌ Session expired. Please start over with `/sensitivity`',
                    components: []
                });
                return;
            }

            const isVip = userData.vipStatus === 'VIP';

            if (game === 'codm') {
                const fingerSelect = new StringSelectMenuBuilder()
                    .setCustomId('finger_select')
                    .setPlaceholder('How many fingers do you use?')
                    .addOptions(
                        new StringSelectMenuOptionBuilder().setLabel('2 Fingers').setValue('2f'),
                        new StringSelectMenuOptionBuilder().setLabel('3 Fingers').setValue('3f'),
                        new StringSelectMenuOptionBuilder().setLabel('4 Fingers').setValue('4f'),
                        new StringSelectMenuOptionBuilder().setLabel('4+ Fingers').setValue('4f+')
                    );

                const row = new ActionRowBuilder().addComponents(fingerSelect);

                await safeInteractionUpdate(interaction, {
                    content: 'How many fingers do you play with?',
                    components: [row]
                });

                linkedUsers[userId].selectedGame = 'codm';
                await github.saveData('data/linked_users.json', linkedUsers, 'Update game selection');

            } else if (game === 'freefire') {
                const playstyleOptions = [
                    new StringSelectMenuOptionBuilder().setLabel('Balanced').setValue('Balanced').setEmoji('⚖️')
                ];

                if (isVip) {
                    playstyleOptions.push(
                        new StringSelectMenuOptionBuilder().setLabel('Aggressive').setValue('Aggressive').setEmoji('⚡'),
                        new StringSelectMenuOptionBuilder().setLabel('Precise').setValue('Precise').setEmoji('🎯'),
                        new StringSelectMenuOptionBuilder().setLabel('Defensive').setValue('Defensive').setEmoji('🛡️')
                    );
                }

                const playstyleSelect = new StringSelectMenuBuilder()
                    .setCustomId('playstyle_select')
                    .setPlaceholder('Choose your playstyle')
                    .addOptions(playstyleOptions);

                const row = new ActionRowBuilder().addComponents(playstyleSelect);

                await safeInteractionUpdate(interaction, {
                    content: isVip ? 'Choose your playstyle (VIP): 👑' : 'Choose your playstyle (Free - Balanced only):',
                    components: [row]
                });

                linkedUsers[userId].selectedGame = 'freefire';
                await github.saveData('data/linked_users.json', linkedUsers, 'Update game selection');
            }

        } catch (error) {
            console.error('Game selection error:', error);
            await safeInteractionUpdate(interaction, {
                content: '❌ An error occurred processing your selection.',
                components: []
            });
        }
    },

    async handleFingerSelection(interaction) {
        try {
            if (!interaction.isStringSelectMenu()) return;
            
            const fingers = interaction.values[0];
            const userId = interaction.user.id;

            const linkedUsers = await github.getData('data/linked_users.json') || {};
            const userData = linkedUsers[userId];
            
            if (!userData) {
                await safeInteractionUpdate(interaction, {
                    content: '❌ Session expired. Please start over with `/sensitivity`',
                    components: []
                });
                return;
            }

            const isVip = userData.vipStatus === 'VIP';

            const playstyleOptions = [
                new StringSelectMenuOptionBuilder().setLabel('Balanced').setValue('Balanced').setEmoji('⚖️')
            ];

            if (isVip) {
                playstyleOptions.push(
                    new StringSelectMenuOptionBuilder().setLabel('Aggressive').setValue('Aggressive').setEmoji('⚡'),
                    new StringSelectMenuOptionBuilder().setLabel('Precise').setValue('Precise').setEmoji('🎯'),
                    new StringSelectMenuOptionBuilder().setLabel('Defensive').setValue('Defensive').setEmoji('🛡️')
                );
            }

            const playstyleSelect = new StringSelectMenuBuilder()
                .setCustomId('playstyle_select')
                .setPlaceholder('Choose your playstyle')
                .addOptions(playstyleOptions);

            const row = new ActionRowBuilder().addComponents(playstyleSelect);

            await safeInteractionUpdate(interaction, {
                content: isVip ? `${fingers} selected. Choose your playstyle (VIP): 👑` : `${fingers} selected. Choose your playstyle (Free - Balanced only):`,
                components: [row]
            });

            linkedUsers[userId].selectedFingers = fingers;
            await github.saveData('data/linked_users.json', linkedUsers, 'Update finger selection');

        } catch (error) {
            console.error('Finger selection error:', error);
            await safeInteractionUpdate(interaction, {
                content: '❌ An error occurred processing your selection.',
                components: []
            });
        }
    },

    async handlePlaystyleSelection(interaction) {
        try {
            if (!interaction.isStringSelectMenu()) return;
            
            const playstyle = interaction.values[0];
            const userId = interaction.user.id;

            await interaction.deferUpdate();

            const linkedUsers = await github.getData('data/linked_users.json') || {};
            linkedUsers[userId] = linkedUsers[userId] || {};
            linkedUsers[userId].selectedPlaystyle = playstyle;
            await github.saveData('data/linked_users.json', linkedUsers, 'Update playstyle selection');

            // Now we have all the data needed, generate sensitivity
            const userData = linkedUsers[userId];
            const deviceName = userData.selectedDevice;

            if (!deviceName) {
                await safeInteractionReply(interaction, {
                    content: '❌ Device information lost. Please start over with `/sensitivity`',
                    ephemeral: true
                });
                return;
            }

            await this.generateSensitivity(interaction, deviceName, userData);

        } catch (error) {
            console.error('Playstyle selection error:', error);
            await safeInteractionUpdate(interaction, {
                content: '❌ An error occurred processing your selection.',
                components: []
            });
        }
    },

    async generateSensitivity(interaction, deviceName, userData) {
        try {
            const linkedUsers = await github.getData('data/linked_users.json') || {};
            const userCredentials = linkedUsers[interaction.user.id];
            
            if (!userCredentials || !userCredentials.username) {
                await safeInteractionReply(interaction, {
                    content: '❌ User credentials not found. Please login again.',
                    ephemeral: true
                });
                return;
            }

            const { data: supabaseUser, error: userError } = await supabase
                .from('users')
                .select('*')
                .eq('id', userCredentials.supabaseUserId)
                .single();

            if (userError || !supabaseUser) {
                await safeInteractionReply(interaction, {
                    content: '❌ Could not verify account. Please login again.',
                    ephemeral: true
                });
                return;
            }

            // Try to get device info from API first
            let deviceInfo = null;
            try {
                const apiDevices = await searchDevicesFromAPI(deviceName);
                const exactMatch = apiDevices.find(d => d.name === deviceName);
                if (exactMatch) {
                    deviceInfo = exactMatch.info;
                }
            } catch (error) {
                console.log('API device lookup failed, using local database');
            }

            // Fallback to local database
            if (!deviceInfo) {
                try {
                    const deviceDatabase = require('../data/deviceDatabase').deviceDatabase;
                    deviceInfo = deviceDatabase[deviceName];
                } catch (error) {
                    await safeInteractionReply(interaction, {
                        content: '❌ Device database not available.',
                        ephemeral: true
                    });
                    return;
                }
            }

            if (!deviceInfo) {
                await safeInteractionReply(interaction, {
                    content: '❌ Device information not found.',
                    ephemeral: true
                });
                return;
            }

            // Create device object
            const device = {
                name: deviceName,
                screen_size_inches: deviceInfo.screenSize || 6.1,
                refresh_rate_hz: deviceInfo.refreshRate || 60,
                touch_sampling_rate_hz: deviceInfo.touchSamplingRate || 120,
                type: (deviceInfo.screenSize || 6.1) >= 7 ? "tablet" : "phone"
            };

            // Calculate sensitivity based on device specs and user preferences
            let sensitivity;
            const game = userData.selectedGame;
            const playstyle = userData.selectedPlaystyle;
            const fingers = userData.selectedFingers;
            const isVip = supabaseUser.role === 'vip' || supabaseUser.role === 'admin';

            if (game === 'freefire') {
                // Free Fire sensitivity calculation
                const baseMultiplier = device.type === 'tablet' ? 0.8 : 1.0;
                const refreshMultiplier = device.refresh_rate_hz >= 90 ? 1.1 : 1.0;
                const playstyleMultipliers = {
                    'Balanced': 1.0,
                    'Aggressive': 1.2,
                    'Precise': 0.8,
                    'Defensive': 0.9
                };

                const multiplier = baseMultiplier * refreshMultiplier * (playstyleMultipliers[playstyle] || 1.0);

                sensitivity = {
                    camera: Math.round(75 * multiplier),
                    ads: Math.round(60 * multiplier),
                    fire: Math.round(85 * multiplier),
                    gyro: Math.round(50 * multiplier)
                };

            } else if (game === 'codm') {
                // CODM sensitivity calculation
                const baseMultiplier = device.type === 'tablet' ? 0.7 : 1.0;
                const refreshMultiplier = device.refresh_rate_hz >= 90 ? 1.15 : 1.0;
                const fingerMultipliers = {
                    '2f': 1.0,
                    '3f': 1.1,
                    '4f': 1.2,
                    '4f+': 1.3
                };
                const playstyleMultipliers = {
                    'Balanced': 1.0,
                    'Aggressive': 1.25,
                    'Precise': 0.75,
                    'Defensive': 0.85
                };

                const multiplier = baseMultiplier * refreshMultiplier * 
                                (fingerMultipliers[fingers] || 1.0) * 
                                (playstyleMultipliers[playstyle] || 1.0);

                sensitivity = {
                    camera: Math.round(65 * multiplier),
                    ads: Math.round(55 * multiplier),
                    hipfire: Math.round(70 * multiplier),
                    scope: Math.round(45 * multiplier)
                };
            }

            let embed;

            if (game === 'freefire') {
                embed = new EmbedBuilder()
                    .setColor(0xFF4500)
                    .setTitle('🔥 Free Fire Sensitivity')
                    .setDescription(`**Device:** ${deviceName}\n**Screen:** ${device.screen_size_inches}" • **Refresh:** ${device.refresh_rate_hz}Hz\n**Playstyle:** ${playstyle}\n**Account:** ${isVip ? 'VIP 👑' : 'Free'}`)
                    .addFields(
                        { name: '📱 Camera', value: `${sensitivity.camera}`, inline: true },
                        { name: '🎯 ADS', value: `${sensitivity.ads}`, inline: true },
                        { name: '💥 Fire Button', value: `${sensitivity.fire}`, inline: true },
                        { name: '🔄 Gyroscope', value: `${sensitivity.gyro}`, inline: true }
                    )
                    .setFooter({ text: `Generated for ${supabaseUser.username}` })
                    .setTimestamp();

            } else if (game === 'codm') {
                embed = new EmbedBuilder()
                    .setColor(0x00FF00)
                    .setTitle('🔫 CODM Sensitivity')
                    .setDescription(`**Device:** ${deviceName}\n**Screen:** ${device.screen_size_inches}" • **Refresh:** ${device.refresh_rate_hz}Hz\n**Fingers:** ${fingers}\n**Playstyle:** ${playstyle}\n**Account:** ${isVip ? 'VIP 👑' : 'Free'}`)
                    .addFields(
                        { name: '📱 Camera', value: `${sensitivity.camera}`, inline: true },
                        { name: '🎯 ADS', value: `${sensitivity.ads}`, inline: true },
                        { name: '💥 Hip Fire', value: `${sensitivity.hipfire}`, inline: true },
                        { name: '🔍 Scope', value: `${sensitivity.scope}`, inline: true }
                    )
                    .setFooter({ text: `Generated for ${supabaseUser.username}` })
                    .setTimestamp();
            }

            try {
                await interaction.user.send({ embeds: [embed] });
                
                await safeInteractionReply(interaction, {
                    content: '✅ Your sensitivity settings have been sent to your DMs!',
                    ephemeral: true
                });

            } catch (dmError) {
                console.log('Could not send DM, showing embed in channel');
                await safeInteractionReply(interaction, { 
                    content: '❌ Could not send DM. Please enable DMs from server members.',
                    embeds: [embed],
                    ephemeral: true
                });
            }

        } catch (error) {
            console.error('Generate sensitivity error:', error);
            
            let errorMessage = '❌ An error occurred generating your sensitivity.';

            await safeInteractionReply(interaction, {
                content: errorMessage,
                ephemeral: true
            });
        }
    }
};
