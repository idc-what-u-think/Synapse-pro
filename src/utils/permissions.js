const { PermissionsBitField } = require('discord.js');
const { getData, saveData } = require('./github');

async function storeChannelPermissions(channel, octokit, owner, repo) {
    const modData = await getData(octokit, owner, repo, 'moderation.json');
    if (!modData.lockedChannels) modData.lockedChannels = {};
    
    const everyonePerms = channel.permissionOverwrites.cache.get(channel.guild.id);
    modData.lockedChannels[channel.id] = {
        originalPerms: everyonePerms ? everyonePerms.allow.bitfield : 0,
        timestamp: new Date().toISOString(),
        guildId: channel.guild.id
    };
    
    await saveData(octokit, owner, repo, 'moderation.json', modData,
        `Stored permissions for channel ${channel.name}`);
}

async function getStoredPermissions(channel, octokit, owner, repo) {
    const modData = await getData(octokit, owner, repo, 'moderation.json');
    return modData.lockedChannels?.[channel.id];
}

module.exports = { storeChannelPermissions, getStoredPermissions };
