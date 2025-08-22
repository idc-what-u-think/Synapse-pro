const { getData } = require('./github');

async function getModlogChannel(guild, octokit, owner, repo) {
    const config = await getData(octokit, owner, repo, 'config.json');
    const modlogId = config?.guilds?.[guild.id]?.modlogChannel;
    return modlogId ? guild.channels.cache.get(modlogId) : null;
}

async function sendModlogEmbed(interaction, octokit, owner, repo, embed) {
    const modlogChannel = await getModlogChannel(interaction.guild, octokit, owner, repo);
    if (modlogChannel) {
        await modlogChannel.send({ embeds: [embed] });
    }
}

module.exports = { getModlogChannel, sendModlogEmbed };
