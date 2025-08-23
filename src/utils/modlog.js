const { getConfig } = require('./github');

async function getModlogChannel(guild) {
    try {
        const config = await getConfig();
        const modlogId = config?.guilds?.[guild.id]?.modlogChannel;
        return modlogId ? guild.channels.cache.get(modlogId) : null;
    } catch (error) {
        console.error('Error getting modlog channel:', error);
        return null;
    }
}

async function sendModlogMessage(guild, action, user, moderator, reason = null) {
    try {
        const modlogChannel = await getModlogChannel(guild);
        if (modlogChannel) {
            // Create simple message format
            let message;
            if (reason) {
                message = `${user.tag} has been ${action.toLowerCase()} by ${moderator.tag} for ${reason}`;
            } else {
                message = `${user.tag} has been ${action.toLowerCase()} by ${moderator.tag}`;
            }
            
            await modlogChannel.send(message);
            console.log(`Modlog message sent: ${action} - ${user.tag}`);
        } else {
            console.log('No modlog channel configured for this guild');
        }
    } catch (error) {
        console.error('Error sending modlog message:', error);
    }
}

// Alternative function if you want to keep using embeds but with simple format
async function sendModlogEmbed(guild, action, user, moderator, reason = null) {
    try {
        const modlogChannel = await getModlogChannel(guild);
        if (modlogChannel) {
            const { EmbedBuilder } = require('discord.js');
            
            let description;
            if (reason) {
                description = `${user.tag} has been ${action.toLowerCase()} by ${moderator.tag} for ${reason}`;
            } else {
                description = `${user.tag} has been ${action.toLowerCase()} by ${moderator.tag}`;
            }
            
            const embed = new EmbedBuilder()
                .setDescription(description)
                .setColor(getActionColor(action))
                .setTimestamp();
            
            await modlogChannel.send({ embeds: [embed] });
            console.log(`Modlog embed sent: ${action} - ${user.tag}`);
        } else {
            console.log('No modlog channel configured for this guild');
        }
    } catch (error) {
        console.error('Error sending modlog embed:', error);
    }
}

function getActionColor(action) {
    switch (action.toLowerCase()) {
        case 'ban': return 0xFF0000; // Red
        case 'kick': return 0xFF8C00; // Orange
        case 'mute': return 0xFFFF00; // Yellow
        case 'timeout': return 0xFFFF00; // Yellow
        case 'warn': return 0xFFA500; // Orange
        default: return 0x808080; // Gray
    }
}

module.exports = { getModlogChannel, sendModlogMessage, sendModlogEmbed };