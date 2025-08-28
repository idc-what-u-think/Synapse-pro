async generateSensitivity(interaction, deviceName, userData) {
        try {
            const linkedUsers = await github.getData('data/linked_users.json') || {};
            const userCredentials = linkedUsers[interaction.user.id];
            
            if (!userCredentialsconst { SlashCommandBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ActionRowBuilder, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { WebsiteAPI } = require('../utils/websiteAPI');
const github = require('../utils/github');

const websiteAPI = new WebsiteAPI();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('sensitivity')
        .setDescription('Generate sensitivity settings for your device'),
    
    async execute(interaction) {
        const userId = interaction.user.id;
        
        try {
            const linkedUsers = await github.getData('data/linked_users.json') || {};
            
            if (!linkedUsers[userId]) {
                await interaction.reply({
                    content: '❌ You need to link your account first using `/login`',
                    ephemeral: true
                });
                return;
            }

            const userInfo = await websiteAPI.getUserInfo(linkedUsers[userId].username);
            
            if (!userInfo.success) {
                await interaction.reply({
                    content: '❌ Account verification failed. Please login again.',
                    ephemeral: true
                });
                return;
            }

            const user = userInfo.data.user;
            
            if (user.suspended) {
                await interaction.reply({
                    content: '❌ Your account is suspended',
                    ephemeral: true
                });
                return;
            }

            linkedUsers[userId].role = user.role;
            await github.saveData('data/linked_users.json', linkedUsers, 'Update user role');

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

            await interaction.reply({
                content: `Welcome ${linkedUsers[userId].username}! (${user.role}) Select your game:`,
                components: [row],
                ephemeral: true
            });

        } catch (error) {
            console.error('Sensitivity command error:', error);
            await interaction.reply({
                content: '❌ An error occurred. Please try again.',
                ephemeral: true
            });
        }
    },

    async handleGameSelection(interaction) {
        const game = interaction.values[0];
        const userId = interaction.user.id;

        try {
            const linkedUsers = await github.getData('data/linked_users.json') || {};
            const userRole = linkedUsers[userId]?.role || 'user';

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

                await interaction.update({
                    content: 'How many fingers do you play with?',
                    components: [row]
                });

                linkedUsers[userId].selectedGame = 'codm';
                await github.saveData('data/linked_users.json', linkedUsers, 'Update game selection');

            } else if (game === 'freefire') {
                const isVip = userRole === 'vip' || userRole === 'admin';

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

                await interaction.update({
                    content: isVip ? 'Choose your playstyle (VIP):' : 'Choose your playstyle (Free - Balanced only):',
                    components: [row]
                });

                linkedUsers[userId].selectedGame = 'freefire';
                await github.saveData('data/linked_users.json', linkedUsers, 'Update game selection');
            }

        } catch (error) {
            console.error('Game selection error:', error);
            await interaction.reply({
                content: '❌ An error occurred processing your selection.',
                ephemeral: true
            });
        }
    },

    async handleFingerSelection(interaction) {
        const fingers = interaction.values[0];
        const userId = interaction.user.id;

        try {
            const linkedUsers = await github.getData('data/linked_users.json') || {};
            const userRole = linkedUsers[userId]?.role || 'user';
            const isVip = userRole === 'vip' || userRole === 'admin';

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

            await interaction.update({
                content: isVip ? `${fingers} selected. Choose your playstyle (VIP):` : `${fingers} selected. Choose your playstyle (Free - Balanced only):`,
                components: [row]
            });

            linkedUsers[userId].selectedFingers = fingers;
            await github.saveData('data/linked_users.json', linkedUsers, 'Update finger selection');

        } catch (error) {
            console.error('Finger selection error:', error);
            await interaction.reply({
                content: '❌ An error occurred processing your selection.',
                ephemeral: true
            });
        }
    },

    async handlePlaystyleSelection(interaction) {
        const playstyle = interaction.values[0];

        const modal = new ModalBuilder()
            .setCustomId('device_modal')
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

        const userId = interaction.user.id;
        const linkedUsers = await github.getData('data/linked_users.json') || {};
        linkedUsers[userId].selectedPlaystyle = playstyle;
        await github.saveData('data/linked_users.json', linkedUsers, 'Update playstyle selection');

        await interaction.showModal(modal);
    },

    async handleDeviceModal(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const deviceQuery = interaction.fields.getTextInputValue('device_name');
        const userId = interaction.user.id;

        try {
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
                .setCustomId('device_final_select')
                .setPlaceholder('Select your exact device')
                .addOptions(deviceOptions);

            const row = new ActionRowBuilder().addComponents(deviceSelect);

            await interaction.editReply({
                content: `Found ${matchingDevices.length} devices matching "${deviceQuery}". Please select your exact device:`,
                components: [row]
            });

        } catch (error) {
            console.error('Device modal error:', error);
            await interaction.editReply('❌ An error occurred processing your device.');
        }
    },

    async handleDeviceFinalSelection(interaction) {
        const deviceName = interaction.values[0];
        const userId = interaction.user.id;

        try {
            const linkedUsers = await github.getData('data/linked_users.json') || {};
            const userData = linkedUsers[userId];

            await this.generateSensitivity(interaction, deviceName, userData);

        } catch (error) {
            console.error('Device final selection error:', error);
            await interaction.reply({
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
                const reply = interaction.replied || interaction.deferred ? 'editReply' : 'reply';
                await interaction[reply]('❌ User credentials not found. Please login again.');
                return;
            }

            const sensitivityParams = {
                username: userCredentials.username,
                password: userCredentials.password || '',
                game: userData.selectedGame,
                device: deviceName,
                playstyle: userData.selectedPlaystyle,
                ...(userData.selectedFingers && { fingers: userData.selectedFingers })
            };

            const result = await websiteAPI.calculateSensitivity(sensitivityParams);

            if (!result.success) {
                const reply = interaction.replied || interaction.deferred ? 'editReply' : 'reply';
                await interaction[reply](`❌ ${result.error}`);
                return;
            }

            const { sensitivity, user, game, device, playstyle, fingers } = result.data;
            const isVip = user.role === 'vip' || user.role === 'admin';
            let embed;

            if (game === 'freefire') {
                embed = new EmbedBuilder()
                    .setColor(0xFF4500)
                    .setTitle('🔥 Free Fire Sensitivity')
                    .setDescription(`**Device:** ${device}\n**Playstyle:** ${playstyle}\n**Account:** ${isVip ? 'VIP' : 'Free'}`)
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
                    .setDescription(`**Device:** ${device}\n**Fingers:** ${fingers}\n**Playstyle:** ${playstyle}\n**Account:** ${isVip ? 'VIP' : 'Free'}`)
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
                
                const reply = interaction.replied || interaction.deferred ? 'editReply' : 'reply';
                await interaction[reply]('✅ Your sensitivity settings have been sent to your DMs!');

            } catch (dmError) {
                const reply = interaction.replied || interaction.deferred ? 'editReply' : 'reply';
                await interaction[reply]({ 
                    content: '❌ Could not send DM. Please enable DMs from server members.',
                    embeds: [embed]
                });
            }

        } catch (error) {
            console.error('Generate sensitivity error:', error);
            const reply = interaction.replied || interaction.deferred ? 'editReply' : 'reply';
            await interaction[reply]('❌ An error occurred generating your sensitivity.');
        }
    }
};
