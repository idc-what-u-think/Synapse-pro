const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ChannelType } = require('discord.js');
const { getConfig, saveConfig } = require('../utils/github');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('modlog')
        .setDescription('Configure moderation log channel')
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('Channel for moderation logs (leave empty to disable)')
                .addChannelTypes(ChannelType.GuildText)) // Restrict to text channels only
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        try {
            const channel = interaction.options.getChannel('channel');
            let config;
            
            // Handle case where config doesn't exist or getData fails
            try {
                console.log('Loading config...');
                config = await getConfig();
                console.log('Config loaded successfully:', JSON.stringify(config, null, 2));
            } catch (error) {
                console.error('Error loading config:', error);
                config = { guilds: {} }; // Initialize with proper structure if it doesn't exist
            }
            
            // Ensure config structure exists
            if (!config.guilds) config.guilds = {};
            if (!config.guilds[interaction.guild.id]) config.guilds[interaction.guild.id] = {};
            
            if (channel) {
                // Verify the channel is a text channel and bot has permissions
                if (channel.type !== ChannelType.GuildText) {
                    return await interaction.reply({
                        content: 'Please select a text channel for moderation logs.',
                        ephemeral: true
                    });
                }
                
                // Check if bot has permission to send messages in the channel
                const botMember = interaction.guild.members.cache.get(interaction.client.user.id);
                if (!channel.permissionsFor(botMember).has(['SendMessages', 'EmbedLinks'])) {
                    return await interaction.reply({
                        content: `I don't have permission to send messages in ${channel}. Please check my permissions.`,
                        ephemeral: true
                    });
                }
                
                // Set the modlog channel in config
                config.guilds[interaction.guild.id].modlogChannel = channel.id;
                console.log('Updated config:', JSON.stringify(config, null, 2));
                
                try {
                    console.log('Saving config...');
                    await saveConfig(config, `Set modlog channel to #${channel.name}`);
                    console.log('Config saved successfully');
                } catch (error) {
                    console.error('Error saving config:', error);
                    return await interaction.reply({
                        content: 'Failed to save configuration. Please try again.',
                        ephemeral: true
                    });
                }
                
                // Send test message to the channel
                const testEmbed = new EmbedBuilder()
                    .setColor(0x00FF00)
                    .setTitle('Modlog Channel Set')
                    .setDescription('This channel will now receive moderation logs.')
                    .addFields([
                        { name: 'Guild', value: interaction.guild.name, inline: true },
                        { name: 'Set by', value: interaction.user.tag, inline: true }
                    ])
                    .setTimestamp();
                
                try {
                    await channel.send({ embeds: [testEmbed] });
                    console.log('Test message sent to modlog channel');
                } catch (error) {
                    console.error('Error sending test message:', error);
                    // Still reply with success since the config was saved
                    return await interaction.reply({
                        content: `Modlog channel set to ${channel}, but I couldn't send a test message. Please check my permissions.`,
                        ephemeral: true
                    });
                }
                
                await interaction.reply({
                    content: `✅ Modlog channel set to ${channel}`,
                    ephemeral: true
                });
                
            } else {
                // Remove modlog channel
                if (config.guilds[interaction.guild.id] && config.guilds[interaction.guild.id].modlogChannel) {
                    delete config.guilds[interaction.guild.id].modlogChannel;
                    console.log('Removed modlog channel from config');
                    
                    try {
                        console.log('Saving updated config...');
                        await saveConfig(config, 'Disabled modlog channel');
                        console.log('Config saved successfully');
                    } catch (error) {
                        console.error('Error saving config:', error);
                        return await interaction.reply({
                            content: 'Failed to save configuration. Please try again.',
                            ephemeral: true
                        });
                    }
                }
                
                await interaction.reply({
                    content: '✅ Modlog has been disabled.',
                    ephemeral: true
                });
            }
            
        } catch (error) {
            console.error('Error in modlog command:', error);
            
            // Handle case where interaction hasn't been replied to yet
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: 'An error occurred while configuring the modlog channel.',
                    ephemeral: true
                });
            }
        }
    },
};