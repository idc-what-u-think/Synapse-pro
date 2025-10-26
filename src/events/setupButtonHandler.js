const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
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

async function handleSetupButtons(interaction) {
    if (interaction.isButton()) {
        if (interaction.customId === 'claim_dmp_role') {
            await handleDMPRoleClaim(interaction);
        }
    }
    
    if (interaction.isModalSubmit()) {
        if (interaction.customId === 'game_selection_modal') {
            await handleGameModalSubmit(interaction);
        }
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

        await showGameSelectionModal(interaction);

    } catch (error) {
        console.error('Error handling DMP role claim:', error);
        await interaction.reply({
            content: '❌ An error occurred while processing your request.',
            ephemeral: true
        });
    }
}

async function showGameSelectionModal(interaction) {
    const modal = new ModalBuilder()
        .setCustomId('game_selection_modal')
        .setTitle('🎮 Select Your Games');

    const gameInput = new TextInputBuilder()
        .setCustomId('selected_games')
        .setLabel('Which games do you play?')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('Type the game names, one per line:\n\nEfootball\nFree Fire\nCall of Duty\nDelta Force\nRoblox\nPUBG\nFarlight84')
        .setRequired(false)
        .setMaxLength(500);

    const row = new ActionRowBuilder().addComponents(gameInput);
    modal.addComponents(row);

    await interaction.showModal(modal);
}

async function handleGameModalSubmit(interaction) {
    const userId = interaction.user.id;
    const member = interaction.member;
    const selectedGamesText = interaction.fields.getTextInputValue('selected_games').toLowerCase();

    try {
        await interaction.deferReply({ ephemeral: true });

        const cooldowns = await github.getSetupCooldowns();
        
        const gameMapping = {
            'efootball': 'efootball',
            'e-football': 'efootball',
            'free fire': 'freefire',
            'freefire': 'freefire',
            'call of duty': 'cod',
            'cod': 'cod',
            'codm': 'cod',
            'delta force': 'delta',
            'delta': 'delta',
            'roblox': 'roblox',
            'pubg': 'pubg',
            'farlight': 'farlight',
            'farlight84': 'farlight',
            'farlight 84': 'farlight'
        };

        const selectedGames = new Set();
        const lines = selectedGamesText.split('\n').map(line => line.trim()).filter(line => line);

        for (const line of lines) {
            const normalizedGame = gameMapping[line.toLowerCase()];
            if (normalizedGame) {
                selectedGames.add(normalizedGame);
            }
        }

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

        const gameNames = Array.from(selectedGames).map(game => {
            const names = {
                'efootball': '⚽ Efootball',
                'freefire': '🔥 Free Fire',
                'cod': '🎯 Call of Duty',
                'delta': '🚁 Delta Force',
                'roblox': '🎮 Roblox',
                'pubg': '🎖️ PUBG',
                'farlight': '🚀 Farlight84'
            };
            return names[game];
        });

        const embed = new EmbedBuilder()
            .setColor('#00ff00')
            .setTitle('✅ Setup Complete!')
            .setDescription(`**Your roles have been assigned!**\n\n${selectedGames.size > 0 ? `🎮 **Games Selected:**\n${gameNames.join('\n')}` : '📝 No games selected'}`)
            .addFields({
                name: '📅 Next Setup Available',
                value: 'You can update your roles again in 30 days',
                inline: false
            })
            .setFooter({ text: 'Enjoy your time in DMP Empire! 🎉' })
            .setTimestamp();

        await interaction.editReply({
            embeds: [embed]
        });

    } catch (error) {
        console.error('Error submitting game selection:', error);
        await interaction.editReply({
            content: '❌ An error occurred while assigning roles.'
        });
    }
}

module.exports = {
    handleSetupButtons
};
