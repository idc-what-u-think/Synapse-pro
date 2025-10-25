const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const github = require('../utils/github');

const GAME_ROLES = {
    'efootball': '1431675487821758494',
    'freefire': '1431674312427045075',
    'cod': '1431675383106768997',
    'delta': '1431676286832476373',
    'roblox': '1431676304775970877',
    'pubg': '1431675940420845641',
    'farlight': '1431675721750675616'
};

const DMP_ROLE_ID = '1373766139997589654';
const COOLDOWN_DURATION = 30 * 24 * 60 * 60 * 1000;

const userGameSelections = new Map();

async function handleSetupButtons(interaction) {
    if (!interaction.isButton()) return;

    if (interaction.customId === 'claim_dmp_role') {
        await handleDMPRoleClaim(interaction);
    }
    else if (interaction.customId.startsWith('game_')) {
        await handleGameSelection(interaction);
    }
    else if (interaction.customId === 'submit_games') {
        await handleGameSubmit(interaction);
    }
}

async function handleDMPRoleClaim(interaction) {
    const userId = interaction.user.id;
    const member = interaction.member;

    try {
        const cooldowns = await github.getSetupCooldowns();
        
        if (cooldowns[userId]) {
            const lastSetup = cooldowns[userId].timestamp;
            const timeElapsed = Date.now() - lastSetup;
            const timeRemaining = COOLDOWN_DURATION - timeElapsed;

            if (timeRemaining > 0) {
                const days = Math.floor(timeRemaining / (24 * 60 * 60 * 1000));
                const hours = Math.floor((timeRemaining % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
                const minutes = Math.floor((timeRemaining % (60 * 60 * 1000)) / (60 * 1000));

                return await interaction.reply({
                    content: `🚫 **Setup Cooldown Active**\n\nYou can setup your roles again after: **${days}d ${hours}h ${minutes}m**`,
                    flags: [4096],
                    ephemeral: true
                });
            }
        }

        if (!member.roles.cache.has(DMP_ROLE_ID)) {
            await member.roles.add(DMP_ROLE_ID);
        }

        await showGameSelection(interaction, cooldowns[userId]?.roles || []);

    } catch (error) {
        console.error('Error handling DMP role claim:', error);
        await interaction.reply({
            content: '❌ An error occurred while processing your request.',
            ephemeral: true
        });
    }
}

async function showGameSelection(interaction, previousRoles = []) {
    const embed = new EmbedBuilder()
        .setColor('#667eea')
        .setTitle('🎮 CHOOSE YOUR GAMES')
        .setDescription('**Which Games Do You Play?**\n\n⚠️ Be truthful or get banned\n✨ You can pick more than 1 game\n📝 Games are optional - you can skip if you don\'t play any')
        .addFields({
            name: '✨ DMP EMPIRE',
            value: 'Select your games below!',
            inline: false
        })
        .setFooter({ text: 'Click the games you play, then submit!' })
        .setTimestamp();

    const row1 = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('game_efootball')
                .setLabel('⚽ Efootball')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('game_freefire')
                .setLabel('🔥 Free Fire')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('game_cod')
                .setLabel('🎯 Call of Duty')
                .setStyle(ButtonStyle.Secondary)
        );

    const row2 = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('game_delta')
                .setLabel('🚁 Delta Force')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('game_roblox')
                .setLabel('🎮 Roblox')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('game_pubg')
                .setLabel('🎖️ PUBG')
                .setStyle(ButtonStyle.Secondary)
        );

    const row3 = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('game_farlight')
                .setLabel('🚀 Farlight84')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('submit_games')
                .setLabel('✨ COMPLETE SETUP')
                .setStyle(ButtonStyle.Success)
        );

    await interaction.update({
        embeds: [embed],
        components: [row1, row2, row3]
    });
}

async function handleGameSelection(interaction) {
    const userId = interaction.user.id;
    const gameKey = interaction.customId.replace('game_', '');
    
    if (!userGameSelections.has(userId)) {
        userGameSelections.set(userId, new Set());
    }

    const selectedGames = userGameSelections.get(userId);

    if (selectedGames.has(gameKey)) {
        selectedGames.delete(gameKey);
    } else {
        selectedGames.add(gameKey);
    }

    const components = interaction.message.components.map(row => {
        const newRow = new ActionRowBuilder();
        row.components.forEach(button => {
            const gameKey = button.customId?.replace('game_', '');
            const isSelected = selectedGames.has(gameKey);
            
            const newButton = ButtonBuilder.from(button);
            if (button.customId?.startsWith('game_')) {
                newButton.setStyle(isSelected ? ButtonStyle.Primary : ButtonStyle.Secondary);
            }
            newRow.addComponents(newButton);
        });
        return newRow;
    });

    await interaction.update({ components });
}

async function handleGameSubmit(interaction) {
    const userId = interaction.user.id;
    const member = interaction.member;
    const selectedGames = userGameSelections.get(userId) || new Set();

    try {
        const cooldowns = await github.getSetupCooldowns();
        const previousRoles = cooldowns[userId]?.roles || [];

        const allGameRoleIds = Object.values(GAME_ROLES);
        const selectedRoleIds = Array.from(selectedGames).map(game => GAME_ROLES[game]);

        for (const roleId of allGameRoleIds) {
            if (member.roles.cache.has(roleId)) {
                await member.roles.remove(roleId);
            }
        }

        for (const roleId of selectedRoleIds) {
            if (!member.roles.cache.has(roleId)) {
                await member.roles.add(roleId);
            }
        }

        cooldowns[userId] = {
            timestamp: Date.now(),
            roles: selectedRoleIds
        };
        await github.saveSetupCooldowns(cooldowns, `Setup completed for ${userId}`);

        userGameSelections.delete(userId);

        const embed = new EmbedBuilder()
            .setColor('#00ff00')
            .setTitle('✅ Setup Complete!')
            .setDescription(`**Your roles have been assigned!**\n\n${selectedGames.size > 0 ? `🎮 Games Selected: **${selectedGames.size}**` : '📝 No games selected'}`)
            .addFields({
                name: '📅 Next Setup Available',
                value: 'You can update your roles again in 30 days',
                inline: false
            })
            .setFooter({ text: 'Enjoy your time in DMP Empire! 🎉' })
            .setTimestamp();

        await interaction.update({
            embeds: [embed],
            components: []
        });

    } catch (error) {
        console.error('Error submitting game selection:', error);
        await interaction.reply({
            content: '❌ An error occurred while assigning roles.',
            ephemeral: true
        });
    }
}

module.exports = {
    handleSetupButtons
};
