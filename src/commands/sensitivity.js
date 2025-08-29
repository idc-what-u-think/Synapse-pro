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
        // If all else fails, try followUp (only works if interaction was acknowledged)
        if (error.code !== 40060) { // Not "already acknowledged" error
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
            // Interaction expired or already acknowledged
            return await safeInteractionReply(interaction, options);
        }
        throw error;
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('sensitivity')
        .setDescription('Generate sensitivity settings for your device'),
    
    async execute(interaction) {
        const userId = interaction.user.id;
        
        try {
            // Acknowledge the interaction immediately
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

            linkedUsers[userId] = {
                ...linkedUsers[userId],
                role: user.role,
                vipStatus: vipStatus,
                vipExpiresAt: user.vip_expires_at,
                lastVerified: new Date().toISOString()
            };
            await github.saveData('data/linked_users.json', linkedUsers, 'Update user verification');

            const gameSelect = new StringSelectMenuBuilder()
                .setCustomId(`game_select_${userId}_${Date.now()}`) // Unique ID
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
            welcomeMessage += ` Select your game:`;

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

    async handleGameSelection(interaction) {
        try {
            // Check if interaction is valid
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
                    .setCustomId(`finger_select_${userId}_${Date.now()}`) // Unique ID
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
                    .setCustomId(`playstyle_select_${userId}_${Date.now()}`) // Unique ID
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
                .setCustomId(`playstyle_select_${userId}_${Date.now()}`) // Unique ID
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

            const modal = new ModalBuilder()
                .setCustomId(`device_modal_${userId}_${Date.now()}`) // Unique ID
                .setTitle('Enter Your Device');

            const deviceInput = new TextInputBuilder()
                .setCustomId('device_name')
                .setLabel('Device Name')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('e.g., iPhone 14, Samsung Galaxy S23')
                .setRequired(true)
                .setMaxLength(100);

            const deviceRow = new ActionRowBuilder().addComponents(deviceInput);
            modal.addComponents(deviceRow);

            const linkedUsers = await github.getData('data/linked_users.json') || {};
            linkedUsers[userId] = linkedUsers[userId] || {};
            linkedUsers[userId].selectedPlaystyle = playstyle;
            await github.saveData('data/linked_users.json', linkedUsers, 'Update playstyle selection');

            await interaction.showModal(modal);

        } catch (error) {
            console.error('Playstyle selection error:', error);
            await safeInteractionUpdate(interaction, {
                content: '❌ An error occurred processing your selection.',
                components: []
            });
        }
    },

    async handleDeviceModal(interaction) {
        try {
            if (!interaction.isModalSubmit()) return;
            
            await interaction.deferReply({ ephemeral: true });

            const deviceQuery = interaction.fields.getTextInputValue('device_name');
            const userId = interaction.user.id;

            const linkedUsers = await github.getData('data/linked_users.json') || {};
            const userData = linkedUsers[userId];

            if (!userData) {
                await interaction.editReply('❌ Session expired. Please start over with `/sensitivity`');
                return;
            }

            const searchResult = await websiteAPI.searchDevices(deviceQuery);
            
            if (!searchResult.success) {
                await interaction.editReply('❌ Device search failed. Please try again.');
                return;
            }

            const matchingDevices = searchResult.data.devices.map(d => d.name);

            if (matchingDevices.length === 0) {
                await interaction.editReply(`❌ No devices found matching "${deviceQuery}". Please try a different search term.`);
                return;
            }

            if (matchingDevices.length === 1) {
                await this.generateSensitivity(interaction, matchingDevices[0], userData);
                return;
            }

            const deviceOptions = matchingDevices.slice(0, 10).map(device => 
                new StringSelectMenuOptionBuilder()
                    .setLabel(device)
                    .setValue(device)
            );

            const deviceSelect = new StringSelectMenuBuilder()
                .setCustomId(`device_final_select_${userId}_${Date.now()}`) // Unique ID
                .setPlaceholder('Select your exact device')
                .addOptions(deviceOptions);

            const row = new ActionRowBuilder().addComponents(deviceSelect);

            await interaction.editReply({
                content: `Found ${matchingDevices.length} devices matching "${deviceQuery}". Please select your exact device:`,
                components: [row]
            });

        } catch (error) {
            console.error('Device modal error:', error);
            await safeInteractionReply(interaction, {
                content: '❌ An error occurred processing your device.',
                ephemeral: true
            });
        }
    },

    async handleDeviceFinalSelection(interaction) {
        try {
            if (!interaction.isStringSelectMenu()) return;
            
            const deviceName = interaction.values[0];
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

            // Defer the update to buy time for processing
            await interaction.deferUpdate();
            
            await this.generateSensitivity(interaction, deviceName, userData);

        } catch (error) {
            console.error('Device final selection error:', error);
            await safeInteractionReply(interaction, {
                content: '❌ An error occurred generating your sensitivity.',
                ephemeral: true
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
                .select('password_hash')
                .eq('id', userCredentials.supabaseUserId)
                .single();

            if (userError || !supabaseUser) {
                await safeInteractionReply(interaction, {
                    content: '❌ Could not verify account. Please login again.',
                    ephemeral: true
                });
                return;
            }

            const sensitivityParams = {
                username: userCredentials.username,
                password: supabaseUser.password_hash,
                game: userData.selectedGame,
                device: deviceName,
                playstyle: userData.selectedPlaystyle,
                ...(userData.selectedFingers && { fingers: userData.selectedFingers })
            };

            const result = await websiteAPI.calculateSensitivity(sensitivityParams);

            if (!result.success) {
                await safeInteractionReply(interaction, {
                    content: `❌ ${result.error}`,
                    ephemeral: true
                });
                return;
            }

            const { sensitivity, user, game, device, playstyle, fingers } = result.data;
            const isVip = user.role === 'vip' || user.role === 'admin';
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
                    .setFooter({ text: `Generated for ${user.username}` })
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
                    .setFooter({ text: `Generated for ${user.username}` })
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
            if (error.response?.data?.error) {
                errorMessage = `❌ ${error.response.data.error}`;
            }

            await safeInteractionReply(interaction, {
                content: errorMessage,
                ephemeral: true
            });
        }
    }
};
