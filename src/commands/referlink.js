const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const github = require('../utils/github');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('referlink')
        .setDescription('Manage server referral system')
        .addSubcommand(subcommand =>
            subcommand
                .setName('get')
                .setDescription('Get your unique referral link'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('stats')
                .setDescription('View your referral statistics'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('leaderboard')
                .setDescription('View referral leaderboard'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('on')
                .setDescription('Enable referral system (Admin only)')
                .addStringOption(option =>
                    option.setName('from')
                        .setDescription('Start time (e.g., 12AM, 1PM, 9:30AM, 11:45PM)')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('to')
                        .setDescription('End time (e.g., 12AM, 1PM, 9:30AM, 11:45PM)')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('off')
                .setDescription('Disable referral system (Admin only)')),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'get') {
            await handleGetLink(interaction);
        } else if (subcommand === 'stats') {
            await handleStats(interaction);
        } else if (subcommand === 'leaderboard') {
            await handleLeaderboard(interaction);
        } else if (subcommand === 'on') {
            await handleToggle(interaction, true);
        } else if (subcommand === 'off') {
            await handleToggle(interaction, false);
        }
    }
};

async function handleGetLink(interaction) {
    const userId = interaction.user.id;
    const guild = interaction.guild;

    try {
        await interaction.deferReply({ ephemeral: true });

        const config = await github.getConfig();
        const referralConfig = config?.guilds?.[guild.id]?.referral;

        if (!referralConfig?.enabled) {
            return await interaction.editReply({
                content: '❌ The referral system is currently disabled on this server.'
            });
        }

        const referrals = await github.getData('data/referrals/links.json') || {};

        if (!referrals[userId]) {
            referrals[userId] = { inviteCode: null, referralCount: 0, timestamp: Date.now() };
        }

        let inviteCode = referrals[userId].inviteCode;
        let invite;

        if (inviteCode) {
            const invites = await guild.invites.fetch();
            invite = invites.find(inv => inv.code === inviteCode);
        }

        if (!invite) {
            const channel = guild.channels.cache.find(ch => ch.type === 0 && ch.permissionsFor(guild.members.me).has('CreateInstantInvite'));

            if (!channel) {
                return await interaction.editReply({
                    content: '❌ Could not find a suitable channel to create an invite link.'
                });
            }

            invite = await channel.createInvite({
                maxAge: 0,
                maxUses: 0,
                unique: true,
                reason: `Referral link for ${interaction.user.tag}`
            });

            referrals[userId].inviteCode = invite.code;
            await github.saveData('data/referrals/links.json', referrals, 'Update referral links');
            
            if (!interaction.client.inviteCache) {
                interaction.client.inviteCache = new Map();
            }
            const guildInvites = interaction.client.inviteCache.get(guild.id) || new Map();
            guildInvites.set(invite.code, { 
                uses: invite.uses || 0, 
                inviterId: userId 
            });
            interaction.client.inviteCache.set(guild.id, guildInvites);
            
            console.log(`✅ Created and cached new referral invite ${invite.code} for ${interaction.user.tag}`);
        }

        const embed = new EmbedBuilder()
            .setColor('#00ff00')
            .setTitle('🔗 Your Referral Link')
            .setDescription(`Share this link to invite people to the server!\nYou'll get credit for everyone who joins using your link.`)
            .addFields(
                { name: 'Your Link', value: `${invite.url}`, inline: false },
                { name: 'Total Referrals', value: `${referrals[userId].referralCount} members`, inline: true },
                { name: 'Active Hours', value: `${referralConfig.from} - ${referralConfig.to}`, inline: true }
            )
            .setFooter({ text: 'This link never expires and has unlimited uses!' })
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });

    } catch (error) {
        console.error('Error in referlink get:', error);
        await interaction.editReply({
            content: '❌ An error occurred while generating your referral link.'
        });
    }
}

async function handleStats(interaction) {
    const userId = interaction.user.id;

    try {
        await interaction.deferReply({ ephemeral: true });

        const referrals = await github.getData('data/referrals/links.json') || {};
        const tracking = await github.getData('data/referrals/tracking.json') || {};

        const userReferrals = referrals[userId] || { referralCount: 0 };
        const userTracking = tracking[userId] || [];

        const embed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle('📊 Your Referral Stats')
            .setDescription(`Total people you've referred: **${userReferrals.referralCount}**`)
            .addFields({
                name: 'Recent Referrals',
                value: userTracking.length > 0 
                    ? userTracking.slice(-5).reverse().map(t => `• ${t.username} - <t:${Math.floor(t.joinedAt / 1000)}:R>`).join('\n')
                    : 'No referrals yet'
            })
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });

    } catch (error) {
        console.error('Error in referlink stats:', error);
        await interaction.editReply({
            content: '❌ An error occurred while fetching your stats.'
        });
    }
}

async function handleLeaderboard(interaction) {
    try {
        await interaction.deferReply();

        const referrals = await github.getData('data/referrals/links.json') || {};

        const sorted = Object.entries(referrals)
            .map(([userId, data]) => ({ userId, count: data.referralCount || 0 }))
            .filter(entry => entry.count > 0)
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);

        if (sorted.length === 0) {
            return await interaction.editReply({
                content: '📊 No referrals yet! Be the first to invite someone.'
            });
        }

        const embed = new EmbedBuilder()
            .setColor('#FFD700')
            .setTitle('🏆 Referral Leaderboard')
            .setDescription(await Promise.all(sorted.map(async (entry, idx) => {
                const user = await interaction.client.users.fetch(entry.userId).catch(() => null);
                const username = user ? user.username : 'Unknown User';
                const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}.`;
                return `${medal} **${username}** - ${entry.count} referrals`;
            })).then(lines => lines.join('\n')))
            .setFooter({ text: `Total participants: ${sorted.length}` })
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });

    } catch (error) {
        console.error('Error in referlink leaderboard:', error);
        await interaction.editReply({
            content: '❌ An error occurred while fetching the leaderboard.'
        });
    }
}

async function handleToggle(interaction, enable) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return await interaction.reply({
            content: '❌ You need Administrator permission to use this command.',
            ephemeral: true
        });
    }

    try {
        await interaction.deferReply({ ephemeral: true });

        const config = await github.getConfig();
        if (!config.guilds) config.guilds = {};
        if (!config.guilds[interaction.guild.id]) config.guilds[interaction.guild.id] = {};
        if (!config.guilds[interaction.guild.id].referral) {
            config.guilds[interaction.guild.id].referral = {};
        }

        if (enable) {
            const from = interaction.options.getString('from');
            const to = interaction.options.getString('to');

            if (!isValidTime(from) || !isValidTime(to)) {
                return await interaction.editReply({
                    content: '❌ Invalid time format. Use format like: 12AM, 1PM, 9:30AM, 11:45PM'
                });
            }

            config.guilds[interaction.guild.id].referral = {
                enabled: true,
                from: from.toUpperCase(),
                to: to.toUpperCase()
            };

            await github.saveConfig(config, 'Enable referral system');

            await cacheGuildInvites(interaction.client, interaction.guild);

            const embed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle('✅ Referral System Enabled')
                .setDescription('The referral contest is now active!')
                .addFields(
                    { name: 'Active Hours', value: `${from.toUpperCase()} - ${to.toUpperCase()}`, inline: true },
                    { name: 'Status', value: '🟢 Active', inline: true }
                )
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

        } else {
            config.guilds[interaction.guild.id].referral.enabled = false;
            await github.saveConfig(config, 'Disable referral system');

            const embed = new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('🔴 Referral System Disabled')
                .setDescription('The referral contest has been turned off.')
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        }

    } catch (error) {
        console.error('Error toggling referral system:', error);
        await interaction.editReply({
            content: '❌ An error occurred while updating the referral system.'
        });
    }
}

function isValidTime(time) {
    return /^(1[0-2]|[1-9])(:[0-5][0-9])?(AM|PM)$/i.test(time);
}

function convertTo24Hour(time) {
    const match = time.match(/(\d+)(?::(\d+))?(AM|PM)/i);
    if (!match) return 0;
    
    let hour = parseInt(match[1]);
    const minutes = match[2] ? parseInt(match[2]) : 0;
    const period = match[3].toUpperCase();
    
    if (period === 'PM' && hour !== 12) {
        hour += 12;
    } else if (period === 'AM' && hour === 12) {
        hour = 0;
    }
    
    return hour + (minutes / 60);
}

function isTimeInRange(current, from, to) {
    const now = new Date();
    const currentDecimal = current + (now.getMinutes() / 60);
    
    if (from <= to) {
        return currentDecimal >= from && currentDecimal < to;
    } else {
        return currentDecimal >= from || currentDecimal < to;
    }
}

async function cacheGuildInvites(client, guild) {
    try {
        const invites = await guild.invites.fetch();
        if (!client.inviteCache) {
            client.inviteCache = new Map();
        }
        const inviteMap = new Map();
        invites.forEach(invite => {
            inviteMap.set(invite.code, { uses: invite.uses, inviterId: invite.inviter?.id });
        });
        client.inviteCache.set(guild.id, inviteMap);
        console.log(`💾 Cached ${inviteMap.size} invites for ${guild.name}`);
    } catch (error) {
        console.error('Error caching invites:', error);
    }
}
