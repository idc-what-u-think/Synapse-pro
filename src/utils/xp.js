function getMessagesForLevel(level) {
    return 5 * (level * level);
}

function getTotalMessagesUpToLevel(level) {
    let total = 0;
    for (let i = 1; i <= level; i++) {
        total += getMessagesForLevel(i);
    }
    return total;
}

function getLevel(messages) {
    let level = 1;
    while (getTotalMessagesUpToLevel(level) <= messages) {
        level++;
    }
    return level - 1;
}

function getMessagesForNextLevel(messages) {
    const currentLevel = getLevel(messages);
    return getTotalMessagesUpToLevel(currentLevel + 1) - messages;
}

module.exports = {
    getLevel,
    getMessagesForLevel,
    getTotalMessagesUpToLevel,
    getMessagesForNextLevel
};
