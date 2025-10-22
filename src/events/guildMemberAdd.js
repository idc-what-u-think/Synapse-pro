const { Events } = require('discord.js');
const { getConfig } = require('../utils/github');
const github = require('../utils/github');

module.exports = {
    name: Events.GuildMemberAdd,
    async execute(member, client) {
        try {
            console.log(`New member joined: ${member.user.tag} in ${member.guild.name}`);
            
            await trackReferral(member);
            
            const config = await getConfig();
            const guildConfig = config?.guilds?.[member.guild.id];
            const welcomeConfig = guildConfig?.welcome;

            if (!welcomeConfig?.enabled || !welcomeConfig.channel) {
                console.log(`Welcome system not configured for ${member.guild.name}`);
                return;
            }

            const welcomeChannel = member.guild.channels.cache.get(welcomeConfig.channel);
            if (!welcomeChannel) {
                console.log(`Welcome channel not found for ${member.guild.name}`);
                return;
            }

            const botMember = member.guild.members.cache.get(client.user.id);
            if (!welcomeChannel.permissionsFor(botMember).has(['SendMessages', 'EmbedLinks'])) {
                console.error(`Missing permissions to send welcome message in #${welcomeChannel.name}`);
                return;
            }

            const welcomeCommand = client.commands.get('welcome');
            if (welcomeCommand && typeof welcomeCommand.sendWelcomeMessage === 'function') {
                await welcomeCommand.sendWelcomeMessage(member, member.guild, welcomeConfig, welcomeChannel);
            } else {  
                console.error('Welcome command not found or sendWelcomeMessage function missing');
            }
        } catch (error) {
            console.error('Error in guildMemberAdd event:', error);
        }
    },
};

async function trackReferral(member) {
    try {
        const config = await getConfig();
        const referralConfig = config?.guilds?.[member.guild.id]?.referral;

        if (!referralConfig?.enabled) {
            return;
        }

        const now = new Date();
        const currentHour = now.getHours();
        const fromHour = convertTo24Hour(referralConfig.from);
        const toHour = convertTo24Hour(referralConfig.to);

        const isActive = isTimeInRange(currentHour, fromHour, toHour);

        if (!isActive) {
            console.log('Referral system is outside active hours');
            return;
        }

        const invites = await member.guild.invites.fetch();
        const cachedInvites = client.inviteCache?.get(member.guild.id) || new Map();

        let usedInvite = null;

        for (const [code, invite] of invites) {
            const cached = cachedInvites.get(code);
            if (cached && invite.uses > cached.uses) {
                usedInvite = invite;
                break;
            }
        }

        if (!usedInvite) {
            console.log('Could not determine which invite was used');
            await cacheInvites(client, member.guild);
            return;
        }

        const referrals = await github.getData('data/referrals/links.json') || {};
        const inviterId = usedInvite.inviterId;

        if (referrals[inviterId] && referrals[inviterId].inviteCode === usedInvite.code) {
            referrals[inviterId].referralCount = (referrals[inviterId].referralCount || 0) + 1;

            const tracking = await github.getData('data/referrals/tracking.json') || {};
            if (!tracking[inviterId]) {
                tracking[inviterId] = [];
            }
            tracking[inviterId].push({
                userId: member.id,
                username: member.user.tag,
                joinedAt: Date.now()
            });

            await github.saveData('data/referrals/links.json', referrals, 'Update referral count');
            await github.saveData('data/referrals/tracking.json', tracking, 'Track new referral');

            console.log(`Referral tracked: ${member.user.tag} invited by user ${inviterId}`);
        }

        await cacheInvites(client, member.guild);

    } catch (error) {
        console.error('Error tracking referral:', error);
    }
}

async function cacheInvites(client, guild) {
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
    } catch (error) {
        console.error('Error caching invites:', error);
    }
}

function convertTo24Hour(time) {
    const match = time.match(/(\d+)(AM|PM)/i);
    if (!match) return 0;
    
    let hour = parseInt(match[1]);
    const period = match[2].toUpperCase();
    
    if (period === 'PM' && hour !== 12) {
        hour += 12;
    } else if (period === 'AM' && hour === 12) {
        hour = 0;
    }
    
    return hour;
}

function isTimeInRange(current, from, to) {
    if (from <= to) {
        return current >= from && current < to;
    } else {
        return current >= from || current < to;
    }
}
