const { SlashCommandBuilder, StringSelectMenuBuilder, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, EmbedBuilder } = require('discord.js');
const { createClient } = require('@supabase/supabase-js');
const { refreshUserSession } = require('./login');
const deviceDatabase = require('../data/deviceDatabase');
const { calculateFreeSensitivity } = require('../utils/freeSensitivityCalculator');
const { calculateSensitivity } = require('../utils/sensitivityCalculator');
const { calculateCODMSensitivity } = require('../utils/codmSensitivityCalculator');

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const userSessions = new Map();

const sensitivityCommand = {
    data: new SlashCommandBuilder()
        .setName('sensitivity')
        .setDescription('Generate sensitivity settings for Free Fire or CODM'),

    async execute(interaction) {
        const session = await refreshUserSession(interaction.user.id);
        
        if (!session) {
            return await interaction.reply({ 
                content: 'Please use `/login` to link your account first.', 
                ephemeral: true 
            });
        }

        if (session.suspended) {
            return await interaction.reply({ 
                content: `Your account is suspended. Reason: ${session.reason}`, 
                ephemeral: true 
            });
        }

        const gameSelect = new StringSelectMenuBuilder()
            .setCustomId('game_select')
            .setPlaceholder('Choose a game')
            .addOptions([
                {
                    label: 'Free Fire',
                    description: 'Generate Free Fire sensitivity',
                    value: 'freefire'
                },
                {
                    label: 'Call of Duty: Mobile',
                    description: 'Generate CODM sensitivity',
                    value: 'codm'
                }
            ]);

        const row = new ActionRowBuilder().addComponents(gameSelect);

        userSessions.set(interaction.user.id, {
            ...session,
            step: 'game_selection'
        });

        await interaction.reply({
            content: `Welcome **${session.username}** (${session.role.toUpperCase()})! Choose your game:`,
            components: [row],
            ephemeral: true
        });
    }
};

async function handleGameSelection(interaction) {
    const userSession = userSessions.get(interaction.user.id);
    if (!userSession) {
        return await interaction.reply({ content: 'Session expired. Please use `/sensitivity` again.', ephemeral: true });
    }

    const game = interaction.values[0];
    userSession.game = game;
    userSession.step = game === 'codm' ? 'finger_selection' : 'playstyle_selection';

    if (game === 'codm') {
        const fingerSelect = new StringSelectMenuBuilder()
            .setCustomId('finger_select')
            .setPlaceholder('How many fingers do you use?')
            .addOptions([
                { label: '2 Fingers', description: '2 finger gameplay', value: '2f' },
                { label: '3 Fingers', description: '3 finger gameplay', value: '3f' },
                { label: '4 Fingers', description: '4 finger gameplay', value: '4f' },
                { label: '4+ Fingers', description: '4+ finger gameplay', value: '4f+' }
            ]);

        const row = new ActionRowBuilder().addComponents(fingerSelect);

        await interaction.update({
            content: 'How many fingers do you use to play CODM?',
            components: [row]
        });
    } else {
        await showPlaystyleSelection(interaction, userSession);
    }

    userSessions.set(interaction.user.id, userSession);
}

async function handleFingerSelection(interaction) {
    const userSession = userSessions.get(interaction.user.id);
    if (!userSession) {
        return await interaction.reply({ content: 'Session expired. Please use `/sensitivity` again.', ephemeral: true });
    }

    userSession.fingers = interaction.values[0];
    userSession.step = 'playstyle_selection';
    userSessions.set(interaction.user.id, userSession);

    await showPlaystyleSelection(interaction, userSession);
}

async function showPlaystyleSelection(interaction, userSession) {
    const isVipOrAdmin = userSession.role === 'vip' || userSession.role === 'admin';
    const isFreeFireFree = userSession.game === 'freefire' && !isVipOrAdmin;

    let playstyleOptions = [];

    if (isFreeFireFree) {
        playstyleOptions = [
            { label: 'Balanced', description: 'Balanced gameplay style', value: 'balanced' }
        ];
    } else {
        playstyleOptions = [
            { label: 'Balanced', description: 'Balanced gameplay style', value: 'balanced' },
            { label: 'Aggressive', description: 'Fast-paced aggressive style', value: 'aggressive' },
            { label: 'Precise', description: 'Precision-focused style', value: 'precise' },
            { label: 'Defensive', description: 'Defensive gameplay style', value: 'defensive' }
        ];
    }

    const playstyleSelect = new StringSelectMenuBuilder()
        .setCustomId('playstyle_select')
        .setPlaceholder('Choose your playstyle')
        .addOptions(playstyleOptions);

    const row = new ActionRowBuilder().addComponents(playstyleSelect);

    const content = isFreeFireFree 
        ? 'As a free user, only **Balanced** playstyle is available. Upgrade to VIP for more options!'
        : 'Choose your playstyle:';

    await interaction.update({
        content: content,
        components: [row]
    });
}

async function handlePlaystyleSelection(interaction) {
    const userSession = userSessions.get(interaction.user.id);
    if (!userSession) {
        return await interaction.reply({ content: 'Session expired. Please use `/sensitivity` again.', ephemeral: true });
    }

    userSession.playstyle = interaction.values[0];
    userSession.step = 'device_input';
    userSessions.set(interaction.user.id, userSession);

    const modal = new ModalBuilder()
        .setCustomId('device_modal')
        .setTitle('Device Selection');

    const deviceInput = new TextInputBuilder()
        .setCustomId('device_input')
        .setLabel('Enter your device name')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setPlaceholder('e.g., iPhone 14 Pro, Samsung Galaxy S23')
        .setMaxLength(100);

    const row = new ActionRowBuilder().addComponents(deviceInput);
    modal.addComponents(row);

    await interaction.showModal(modal);
}

async function handleDeviceModal(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const userSession = userSessions.get(interaction.user.id);
    if (!userSession) {
        return await interaction.editReply('Session expired. Please use `/sensitivity` again.');
    }

    const deviceQuery = interaction.fields.getTextInputValue('device_input');
    const matchedDevices = searchDevices(deviceQuery);

    if (matchedDevices.length === 0) {
        return await interaction.editReply(`No devices found matching "${deviceQuery}". Please try a different search term.`);
    }

    if (matchedDevices.length === 1) {
        await generateSensitivity(interaction, userSession, matchedDevices[0]);
        return;
    }

    const deviceOptions = matchedDevices.slice(0, 10).map(device => ({
        label: device,
        description: `${deviceDatabase[device].screenSize}" | ${deviceDatabase[device].refreshRate}Hz`,
        value: device
    }));

    const deviceSelect = new StringSelectMenuBuilder()
        .setCustomId('device_final_select')
        .setPlaceholder('Select your exact device')
        .addOptions(deviceOptions);

    const row = new ActionRowBuilder().addComponents(deviceSelect);

    await interaction.editReply({
        content: `Found ${matchedDevices.length} matching devices. Please select your exact device:`,
        components: [row]
    });
}

async function handleDeviceFinalSelection(interaction) {
    const userSession = userSessions.get(interaction.user.id);
    if (!userSession) {
        return await interaction.reply({ content: 'Session expired. Please use `/sensitivity` again.', ephemeral: true });
    }

    const selectedDevice = interaction.values[0];
    await generateSensitivity(interaction, userSession, selectedDevice);
}

async function generateSensitivity(interaction, userSession, deviceName) {
    try {
        await interaction.deferUpdate();

        const deviceInfo = {
            name: deviceName,
            ...deviceDatabase[deviceName]
        };

        let sensitivityResult;
        const isVipOrAdmin = userSession.role === 'vip' || userSession.role === 'admin';

        if (userSession.game === 'freefire') {
            if (isVipOrAdmin) {
                sensitivityResult = calculateSensitivity(deviceInfo, userSession.playstyle);
            } else {
                sensitivityResult = calculateFreeSensitivity(deviceInfo, userSession.playstyle);
            }
        } else {
            sensitivityResult = calculateCODMSensitivity(deviceInfo, {
                playstyle: userSession.playstyle,
                fingers: userSession.fingers
            });
        }

        const embed = new EmbedBuilder()
            .setColor(userSession.role === 'vip' || userSession.role === 'admin' ? 0xFFD700 : 0x00FF00)
            .setTitle(`${userSession.game === 'freefire' ? 'Free Fire' : 'CODM'} Sensitivity Settings`)
            .addFields([
                { name: 'Device', value: deviceName, inline: true },
                { name: 'Playstyle', value: userSession.playstyle.charAt(0).toUpperCase() + userSession.playstyle.slice(1), inline: true }
            ])
            .setFooter({ text: `Generated for ${userSession.username} (${userSession.role.toUpperCase()})` })
            .setTimestamp();

        if (userSession.game === 'codm') {
            embed.addFields([
                { name: 'Fingers', value: userSession.fingers.toUpperCase(), inline: true }
            ]);
        }

        if (typeof sensitivityResult === 'object' && sensitivityResult !== null) {
            Object.entries(sensitivityResult).forEach(([key, value]) => {
                embed.addFields([
                    { name: key.charAt(0).toUpperCase() + key.slice(1), value: value.toString(), inline: true }
                ]);
            });
        }

        try {
            const dmChannel = await interaction.user.createDM();
            await dmChannel.send({ embeds: [embed] });

            await interaction.editReply({
                content: '✅ Sensitivity settings have been sent to your DMs!',
                components: []
            });
        } catch (dmError) {
            console.error('Failed to send DM:', dmError);
            await interaction.editReply({
                content: '❌ Could not send DM. Please check your privacy settings.',
                components: []
            });
        }

    } catch (error) {
        console.error('Sensitivity generation error:', error);
        await interaction.editReply({
            content: '❌ An error occurred while generating sensitivity. Please try again.',
            components: []
        });
    } finally {
        userSessions.delete(interaction.user.id);
    }
}

function searchDevices(query) {
    const lowercaseQuery = query.toLowerCase();
    return Object.keys(deviceDatabase).filter(device =>
        device.toLowerCase().includes(lowercaseQuery)
    ).slice(0, 10);
}

module.exports = {
    sensitivityCommand,
    handleGameSelection,
    handleFingerSelection,
    handlePlaystyleSelection,
    handleDeviceModal,
    handleDeviceFinalSelection,
    data: sensitivityCommand.data,
    execute: sensitivityCommand.execute
};
