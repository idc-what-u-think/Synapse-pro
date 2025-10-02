const { getConfig } = require('./github');
const { EmbedBuilder } = require('discord.js');

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
            // Create simple message format with user mention
            let message;
            if (reason) {
                message = `${user} has been ${action.toLowerCase()} by ${moderator.tag} for ${reason}`;
            } else {
                message = `${user} has been ${action.toLowerCase()} by ${moderator.tag}`;
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

async function sendModlogEmbed(guild, action, user, moderator, reason = null) {
    try {
        const modlogChannel = await getModlogChannel(guild);
        if (modlogChannel) {
            let description;
            if (reason) {
                description = `${user} has been ${action.toLowerCase()} by ${moderator.tag} for ${reason}`;
            } else {
                description = `${user} has been ${action.toLowerCase()} by ${moderator.tag}`;
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
        case 'ban':
        case 'banned':
            return 0xFF0000; // Red
        case 'kick':
        case 'kicked':
            return 0xFF8C00; // Orange
        case 'mute':
        case 'muted':
        case 'timeout':
            return 0xFFFF00; // Yellow
        case 'warn':
        case 'warned':
            return 0xFFA500; // Orange
        case 'unban':
        case 'unbanned':
            return 0x00FF00; // Green
        default:
            return 0x808080; // Gray
    }
}

module.exports = { getModlogChannel, sendModlogMessage, sendModlogEmbed };
