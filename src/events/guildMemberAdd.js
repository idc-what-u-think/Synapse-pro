const { Events } = require('discord.js');
const { getConfig } = require('../utils/github');
const github = require('../utils/github');

module.exports = {
    name: Events.GuildMemberAdd,
    async execute(member, client) {
        try {
            console.log(`New member joined: ${member.user.tag} in ${member.guild.name}`);
            
            await trackReferral(member, client);
            
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

async function trackReferral(member, client) {
    try {
        console.log('🔍 Starting referral tracking...');
        
        const config = await getConfig();
        const referralConfig = config?.guilds?.[member.guild.id]?.referral;

        console.log('📋 Referral config:', referralConfig);

        if (!referralConfig?.enabled) {
            console.log('❌ Referral system is not enabled');
            return;
        }

        const now = new Date();
        const utcHour = now.getUTCHours();
        const utcMinute = now.getUTCMinutes();
        
        const localHour = (utcHour + 1) % 24;
        const localMinute = utcMinute;
        
        const fromHour = convertTo24Hour(referralConfig.from);
        const toHour = convertTo24Hour(referralConfig.to);

        console.log(`⏰ UTC time: ${utcHour}:${utcMinute}`);
        console.log(`⏰ Local time (GMT+1): ${localHour}:${localMinute} (${localHour + (localMinute / 60)})`);
        console.log(`⏰ From: ${referralConfig.from} (${fromHour})`);
        console.log(`⏰ To: ${referralConfig.to} (${toHour})`);

        const isActive = isTimeInRange(localHour, fromHour, toHour);
        console.log(`✅ Time active: ${isActive}`);

        if (!isActive) {
            console.log('❌ Referral system is outside active hours');
            return;
        }

        console.log('📨 Fetching invites...');
        const invites = await member.guild.invites.fetch();
        const cachedInvites = client.inviteCache?.get(member.guild.id) || new Map();

        console.log(`📊 Current invites: ${invites.size}, Cached invites: ${cachedInvites.size}`);

        let usedInvite = null;

        for (const [code, invite] of invites) {
            const cached = cachedInvites.get(code);
            console.log(`🔎 Checking invite ${code}: current uses=${invite.uses}, cached uses=${cached?.uses}`);
            
            if (cached && invite.uses > cached.uses) {
                usedInvite = invite;
                console.log(`✅ Found used invite: ${code} by ${invite.inviter?.tag}`);
                break;
            }
        }

        if (!usedInvite) {
            console.log('❌ Could not determine which invite was used');
            await cacheInvites(client, member.guild);
            return;
        }

        const inviterId = usedInvite.inviterId;
        console.log(`👤 Inviter ID: ${inviterId}, New member ID: ${member.id}`);

        if (inviterId === member.id) {
            console.log('❌ User tried to refer themselves - blocked');
            await cacheInvites(client, member.guild);
            return;
        }

        const referrals = await github.getData('data/referrals/links.json') || {};
        console.log('📁 Current referrals data:', JSON.stringify(referrals, null, 2));

        if (referrals[inviterId] && referrals[inviterId].inviteCode === usedInvite.code) {
            console.log('✅ Match found! Updating referral count...');
            
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

            console.log(`🎉 Referral tracked: ${member.user.tag} invited by user ${inviterId}`);
        } else {
            console.log('❌ No matching referral link found');
            console.log(`   Inviter has referral link: ${!!referrals[inviterId]}`);
            console.log(`   Stored code: ${referrals[inviterId]?.inviteCode}`);
            console.log(`   Used code: ${usedInvite.code}`);
        }

        await cacheInvites(client, member.guild);

    } catch (error) {
        console.error('❌ Error tracking referral:', error);
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
        console.log(`💾 Cached ${inviteMap.size} invites for ${guild.name}`);
    } catch (error) {
        console.error('Error caching invites:', error);
    }
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
    const currentDecimal = current + (now.getUTCMinutes() / 60);
    
    if (from <= to) {
        return currentDecimal >= from && currentDecimal < to;
    } else {
        return currentDecimal >= from || currentDecimal < to;
    }
}
