function parseDuration(duration) {
    const regex = /(\d+)([dhms])/g;
    let total = 0;
    let match;

    const units = {
        'd': 86400000,
        'h': 3600000,
        'm': 60000,
        's': 1000
    };

    while ((match = regex.exec(duration)) !== null) {
        const [, amount, unit] = match;
        total += parseInt(amount) * units[unit];
    }

    return total;
}

function formatDuration(ms) {
    const seconds = Math.floor((ms / 1000) % 60);
    const minutes = Math.floor((ms / (1000 * 60)) % 60);
    const hours = Math.floor((ms / (1000 * 60 * 60)) % 24);
    const days = Math.floor(ms / (1000 * 60 * 60 * 24));

    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (seconds > 0) parts.push(`${seconds}s`);

    return parts.join(' ') || '0s';
}

module.exports = { parseDuration, formatDuration };
