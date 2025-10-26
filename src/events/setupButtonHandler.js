const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = require('discord.js');
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
    
    if (interaction.isStringSelectMenu()) {
        if (interaction.customId === 'game_selection_menu') {
            await handleGameSelection(interaction);
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

        await showGameSelectionMenu(interaction);

    } catch (error) {
        console.error('Error handling DMP role claim:', error);
        await interaction.reply({
            content: '❌ An error occurred while processing your request.',
            ephemeral: true
        });
    }
}

async function showGameSelectionMenu(interaction) {
    const embed = new EmbedBuilder()
        .setColor('#667eea')
        .setTitle('🎮 CHOOSE YOUR GAMES')
        .setDescription('**Which Games Do You Play?**\n\n⚠️ Be truthful or get banned\n✨ You can select multiple games\n📝 Games are optional - you can skip')
        .addFields({
            name: '✨ DMP EMPIRE',
            value: 'Select your games from the dropdown menu below!',
            inline: false
        })
        .setFooter({ text: 'Select games and click Submit!' })
        .setTimestamp();

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('game_selection_menu')
        .setPlaceholder('🎮 Select your games...')
        .setMinValues(0)
        .setMaxValues(7)
        .addOptions(
            new StringSelectMenuOptionBuilder()
                .setLabel('⚽ Efootball')
                .setDescription('Play Efootball')
                .setValue('efootball')
                .setEmoji('⚽'),
            new StringSelectMenuOptionBuilder()
                .setLabel('🔥 Free Fire')
                .setDescription('Play Free Fire')
                .setValue('freefire')
                .setEmoji('🔥'),
            new StringSelectMenuOptionBuilder()
                .setLabel('🎯 Call of Duty')
                .setDescription('Play Call of Duty')
                .setValue('cod')
                .setEmoji('🎯'),
            new StringSelectMenuOptionBuilder()
                .setLabel('🚁 Delta Force')
                .setDescription('Play Delta Force')
                .setValue('delta')
                .setEmoji('🚁'),
            new StringSelectMenuOptionBuilder()
                .setLabel('🎮 Roblox')
                .setDescription('Play Roblox')
                .setValue('roblox')
                .setEmoji('🎮'),
            new StringSelectMenuOptionBuilder()
                .setLabel('🎖️ PUBG')
                .setDescription('Play PUBG')
                .setValue('pubg')
                .setEmoji('🎖️'),
            new StringSelectMenuOptionBuilder()
                .setLabel('🚀 Farlight84')
                .setDescription('Play Farlight84')
                .setValue('farlight')
                .setEmoji('🚀')
        );

    const row1 = new ActionRowBuilder().addComponents(selectMenu);

    await interaction.reply({
        embeds: [embed],
        components: [row1],
        ephemeral: true
    });
}

async function handleGameSelection(interaction) {
    const userId = interaction.user.id;
    const member = interaction.member;
    const selectedGames = interaction.values;

    try {
        await interaction.deferUpdate();

        const cooldowns = await github.getSetupCooldowns();
        
        const allGameRoleIds = Object.values(GAME_ROLES);
        const selectedRoleIds = selectedGames.map(game => GAME_ROLES[game]);

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

        const gameNames = selectedGames.map(game => {
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
            .setDescription(`**Your roles have been assigned!**\n\n${selectedGames.length > 0 ? `🎮 **Games Selected:**\n${gameNames.join('\n')}` : '📝 No games selected'}`)
            .addFields({
                name: '📅 Next Setup Available',
                value: 'You can update your roles again in 30 days',
                inline: false
            })
            .setFooter({ text: 'Enjoy your time in DMP Empire! 🎉' })
            .setTimestamp();

        await interaction.editReply({
            embeds: [embed],
            components: []
        });

    } catch (error) {
        console.error('Error submitting game selection:', error);
        await interaction.followUp({
            content: '❌ An error occurred while assigning roles.',
            ephemeral: true
        });
    }
}

module.exports = {
    handleSetupButtons
};
