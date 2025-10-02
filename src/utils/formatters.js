const { EmbedBuilder } = require('discord.js');

function formatDate(date) {
    return `<t:${Math.floor(date.getTime() / 1000)}:F>`;
}

function formatPermissions(permissions) {
    return permissions
        .toArray()
        .map(perm => perm.toLowerCase().replace(/_/g, ' '))
        .map(perm => perm.charAt(0).toUpperCase() + perm.slice(1))
        .join(', ');
}

module.exports = { 
    formatDate, 
    formatPermissions 
};
