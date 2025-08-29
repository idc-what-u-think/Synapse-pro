const { SlashCommandBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ActionRowBuilder, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { createClient } = require('@supabase/supabase-js');
const { WebsiteAPI } = require('../utils/websiteAPI');
const github = require('../utils/github');
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const websiteAPI = new WebsiteAPI();

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

// Device search function using your WebsiteAPI class
async function searchDevicesFromAPI(query) {
    try {
        if (!query || query.length < 1) return [];
        
        const result = await websiteAPI.searchDevices(query);
        
        if (result.success && result.data && result.data.devices) {
            return result.data.devices;
        }
        
        return [];
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
                selectedDevice: deviceQuery,
                username: user.username,
                password: user.password_hash // Store for API calls
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

    // Fixed autocomplete handler
    async autocomplete(interaction) {
        try {
            const focusedValue = interaction.options.getFocused();
            
            // Prevent multiple responses by checking if already responded
            if (interaction.responded) {
                return;
            }
            
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
                    if (!interaction.responded) {
                        await interaction.respond([]);
                    }
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

            // Only respond if we haven't already
            if (!interaction.responded) {
                await interaction.respond(choices);
            }

        } catch (error) {
            console.error('Autocomplete error:', error);
            // Always respond, even with empty array, to prevent Discord errors
            if (!interaction.responded) {
                try {
                    await interaction.respond([]);
                } catch (respondError) {
                    // If even this fails, log it but don't throw
                    console.error('Failed to respond with empty array:', respondError);
                }
            }
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

            // Now we have all the data needed, call website API to generate sensitivity
            const userData = linkedUsers[userId];
            const deviceName = userData.selectedDevice;

            if (!deviceName) {
                await safeInteractionReply(interaction, {
                    content: '❌ Device information lost. Please start over with `/sensitivity`',
                    ephemeral: true
                });
                return;
            }

            await this.generateSensitivityFromAPI(interaction, userData);

        } catch (error) {
            console.error('Playstyle selection error:', error);
            await safeInteractionUpdate(interaction, {
                content: '❌ An error occurred processing your selection.',
                components: []
            });
        }
    },

    async generateSensitivityFromAPI(interaction, userData) {
        try {
            const userId = interaction.user.id;
            
            if (!userData.username || !userData.password) {
                await safeInteractionReply(interaction, {
                    content: '❌ Authentication credentials not found. Please login again.',
                    ephemeral: true
                });
                return;
            }

            // Prepare parameters for API call
            const apiParams = {
                username: userData.username,
                password: userData.password,
                game: userData.selectedGame,
                device: userData.selectedDevice,
                playstyle: userData.selectedPlaystyle
            };

            // Add fingers parameter for CODM
            if (userData.selectedGame === 'codm' && userData.selectedFingers) {
                apiParams.fingers = userData.selectedFingers;
            }

            // Call your website API to calculate sensitivity
            const apiResult = await websiteAPI.calculateSensitivity(apiParams);

            if (!apiResult.success) {
                await safeInteractionReply(interaction, {
                    content: `❌ Failed to generate sensitivity: ${apiResult.error}`,
                    ephemeral: true
                });
                return;
            }

            // Extract data from API response
            const { sensitivity, user: apiUser, game, device, playstyle, fingers } = apiResult.data;
            const isVip = userData.vipStatus === 'VIP';

            let embed;

            if (game === 'freefire') {
                embed = new EmbedBuilder()
                    .setColor(0xFF4500)
                    .setTitle('🔥 Free Fire Sensitivity')
                    .setDescription(`**Device:** ${device}\n**Playstyle:** ${playstyle}\n**Account:** ${isVip ? 'VIP 👑' : 'Free'}`)
                    .addFields(
                        { name: '📱 Camera', value: `${sensitivity.camera}`, inline: true },
                        { name: '🎯 ADS', value: `${sensitivity.ads}`, inline: true },
                        { name: '💥 Fire Button', value: `${sensitivity.fire}`, inline: true },
                        { name: '🔄 Gyroscope', value: `${sensitivity.gyro}`, inline: true }
                    )
                    .setFooter({ text: `Generated for ${apiUser.username}` })
                    .setTimestamp();

            } else if (game === 'codm') {
                embed = new EmbedBuilder()
                    .setColor(0x00FF00)
                    .setTitle('🔫 CODM Sensitivity')
                    .setDescription(`**Device:** ${device}\n**Fingers:** ${fingers}\n**Playstyle:** ${playstyle}\n**Account:** ${isVip ? 'VIP 👑' : 'Free'}`)
                    .addFields(
                        { name: '📱 Camera', value: `${sensitivity.camera}`, inline: true },
                        { name: '🎯 ADS', value: `${sensitivity.ads}`, inline: true },
                        { name: '💥 Hip Fire', value: `${sensitivity.hipfire}`, inline: true },
                        { name: '🔍 Scope', value: `${sensitivity.scope}`, inline: true }
                    )
                    .setFooter({ text: `Generated for ${apiUser.username}` })
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
            if (error.message && error.message.includes('timeout')) {
                errorMessage += ' The API request timed out. Please try again.';
            }

            await safeInteractionReply(interaction, {
                content: errorMessage,
                ephemeral: true
            });
        }
    }
};
