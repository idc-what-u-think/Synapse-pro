const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { getConfig, saveConfig } = require('../utils/github-storage');

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

// Rate limiting storage (in-memory - consider using database for persistence)
const rateLimits = new Map();
const RATE_LIMIT_REQUESTS = 10; // 10 requests per minute
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute in milliseconds

// =============================================================================
// COMMAND 1: /aichannelset - Set AI channel
// =============================================================================

const aichannelset = {
    data: new SlashCommandBuilder()
        .setName('aichannelset')
        .setDescription('Set the channel where AI will automatically respond')
        .addChannelOption(option =>
            option
                .setName('channel')
                .setDescription('Channel where AI will respond automatically')
                .setRequired(true)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

    async execute(interaction) {
        const channel = interaction.options.getChannel('channel');
        const guildId = interaction.guild.id;

        try {
            // Get current config
            const config = await getConfig();
            
            // Initialize guild config if doesn't exist
            if (!config[guildId]) {
                config[guildId] = {};
            }

            // Set AI channel
            config[guildId].aiChannel = channel.id;

            // Save config
            await saveConfig(config, `Set AI channel for guild ${guildId}`);

            const embed = new EmbedBuilder()
                .setColor(0x00FF00)
                .setTitle('✅ AI Channel Configured')
                .setDescription(`AI will now automatically respond in ${channel}`)
                .addFields([
                    {
                        name: '📍 Channel Set',
                        value: `<#${channel.id}>`,
                        inline: true
                    },
                    {
                        name: '⚙️ Behavior',
                        value: 'AI responds automatically in this channel only. In other channels, AI only responds when tagged by admins.',
                        inline: false
                    }
                ])
                .setFooter({ 
                    text: `Configured by ${interaction.user.username}`,
                    iconURL: interaction.user.displayAvatarURL()
                })
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });

        } catch (error) {
            console.error('Error setting AI channel:', error);
            await interaction.reply({
                content: '❌ **Error:** Failed to set AI channel. Please try again.',
                ephemeral: true
            });
        }
    }
};

// =============================================================================
// COMMAND 2: /aichannelremove - Remove AI channel
// =============================================================================

const aichannelremove = {
    data: new SlashCommandBuilder()
        .setName('aichannelremove')
        .setDescription('Remove the configured AI channel (AI will only respond when tagged)')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

    async execute(interaction) {
        const guildId = interaction.guild.id;

        try {
            // Get current config
            const config = await getConfig();
            
            if (!config[guildId] || !config[guildId].aiChannel) {
                return interaction.reply({
                    content: '❌ **No AI channel is currently configured.**',
                    ephemeral: true
                });
            }

            const oldChannelId = config[guildId].aiChannel;
            
            // Remove AI channel
            delete config[guildId].aiChannel;

            // Save config
            await saveConfig(config, `Removed AI channel for guild ${guildId}`);

            const embed = new EmbedBuilder()
                .setColor(0xFF9900)
                .setTitle('🗑️ AI Channel Removed')
                .setDescription('AI channel configuration has been removed')
                .addFields([
                    {
                        name: '📍 Previous Channel',
                        value: `<#${oldChannelId}>`,
                        inline: true
                    },
                    {
                        name: '⚙️ New Behavior',
                        value: 'AI will now only respond when tagged by administrators.',
                        inline: false
                    }
                ])
                .setFooter({ 
                    text: `Removed by ${interaction.user.username}`,
                    iconURL: interaction.user.displayAvatarURL()
                })
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });

        } catch (error) {
            console.error('Error removing AI channel:', error);
            await interaction.reply({
                content: '❌ **Error:** Failed to remove AI channel. Please try again.',
                ephemeral: true
            });
        }
    }
};

// =============================================================================
// COMMAND 3: /maintenance - Toggle maintenance mode
// =============================================================================

const maintenance = {
    data: new SlashCommandBuilder()
        .setName('maintenance')
        .setDescription('Toggle maintenance mode (AI only responds to admins)')
        .addBooleanOption(option =>
            option
                .setName('enabled')
                .setDescription('Enable or disable maintenance mode')
                .setRequired(true)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        const enabled = interaction.options.getBoolean('enabled');
        const guildId = interaction.guild.id;

        try {
            // Get current config
            const config = await getConfig();
            
            // Initialize guild config if doesn't exist
            if (!config[guildId]) {
                config[guildId] = {};
            }

            // Set maintenance mode
            config[guildId].maintenanceMode = enabled;

            // Save config
            await saveConfig(config, `${enabled ? 'Enabled' : 'Disabled'} maintenance mode for guild ${guildId}`);

            const embed = new EmbedBuilder()
                .setColor(enabled ? 0xFF0000 : 0x00FF00)
                .setTitle(enabled ? '🔧 Maintenance Mode Enabled' : '✅ Maintenance Mode Disabled')
                .setDescription(enabled ? 
                    'AI is now in maintenance mode and will only respond to administrators.' : 
                    'AI maintenance mode has been disabled and normal operation has resumed.'
                )
                .addFields([
                    {
                        name: '🔒 Access Level',
                        value: enabled ? 'Administrators Only' : 'Normal Users (based on channel config)',
                        inline: true
                    },
                    {
                        name: '⚙️ Status',
                        value: enabled ? '🔴 Maintenance Active' : '🟢 Normal Operation',
                        inline: true
                    }
                ])
                .setFooter({ 
                    text: `${enabled ? 'Enabled' : 'Disabled'} by ${interaction.user.username}`,
                    iconURL: interaction.user.displayAvatarURL()
                })
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });

        } catch (error) {
            console.error('Error toggling maintenance mode:', error);
            await interaction.reply({
                content: '❌ **Error:** Failed to toggle maintenance mode. Please try again.',
                ephemeral: true
            });
        }
    }
};

// =============================================================================
// MESSAGE EVENT HANDLER (Add this to your main bot file)
// =============================================================================

async function handleAIMessage(message) {
    // Don't respond to bots
    if (message.author.bot) return;
    
    // Don't respond to system messages
    if (message.system) return;

    const guildId = message.guild.id;
    const userId = message.author.id;
    const channelId = message.channel.id;

    try {
        // Get config
        const config = await getConfig();
        const guildConfig = config[guildId] || {};

        // Check maintenance mode
        if (guildConfig.maintenanceMode) {
            const member = message.member;
            const isAdmin = member.permissions.has(PermissionFlagsBits.Administrator);
            
            if (!isAdmin) {
                return; // Don't respond to non-admins in maintenance mode
            }
        }

        // Check if should respond
        let shouldRespond = false;
        const botMention = `<@${message.client.user.id}>`;
        const isTagged = message.content.includes(botMention);

        if (guildConfig.aiChannel) {
            // AI channel is configured
            if (channelId === guildConfig.aiChannel) {
                shouldRespond = true; // Always respond in AI channel
            } else if (isTagged) {
                // Only respond if tagged by admin in other channels
                const member = message.member;
                const isAdmin = member.permissions.has(PermissionFlagsBits.ManageGuild);
                shouldRespond = isAdmin;
            }
        } else {
            // No AI channel configured, only respond when tagged
            if (isTagged) {
                shouldRespond = true;
            }
        }

        if (!shouldRespond) return;

        // Rate limiting
        const now = Date.now();
        const userLimits = rateLimits.get(userId) || { requests: [] };
        
        // Clean old requests
        userLimits.requests = userLimits.requests.filter(time => now - time < RATE_LIMIT_WINDOW);
        
        // Check rate limit
        if (userLimits.requests.length >= RATE_LIMIT_REQUESTS) {
            const embed = new EmbedBuilder()
                .setColor(0xFF9900)
                .setDescription('⏰ **Rate limit exceeded!** Please wait a moment before asking again.');
            
            return message.reply({ embeds: [embed] });
        }

        // Add current request to rate limit tracking
        userLimits.requests.push(now);
        rateLimits.set(userId, userLimits);

        // Show typing indicator
        message.channel.sendTyping();

        // Clean the prompt (remove bot mention if present)
        let prompt = message.content.replace(botMention, '').trim();
        
        if (!prompt) {
            const embed = new EmbedBuilder()
                .setColor(0xFF9900)
                .setDescription('👋 **Hi there!** Ask me anything or upload an image for me to analyze!');
            
            return message.reply({ embeds: [embed] });
        }

        // Handle attachments (images)
        let result;
        const imageAttachment = message.attachments.find(att => att.contentType?.startsWith('image/'));

        if (imageAttachment) {
            // Handle image + text input
            const response = await fetch(imageAttachment.url);
            const imageBuffer = await response.arrayBuffer();
            const imageData = {
                inlineData: {
                    data: Buffer.from(imageBuffer).toString('base64'),
                    mimeType: imageAttachment.contentType
                }
            };

            result = await model.generateContent([prompt, imageData]);
        } else {
            // Handle text-only input
            result = await model.generateContent(prompt);
        }

        const responseText = result.response.text();
        
        // Handle long responses
        if (responseText.length > 1900) {
            const embed = new EmbedBuilder()
                .setColor(0x4285F4)
                .setDescription(responseText.substring(0, 1900) + '...')
                .setFooter({ text: 'Response truncated due to Discord limits' });

            await message.reply({ embeds: [embed] });
            
            // Send remaining text
            const remaining = responseText.substring(1900);
            if (remaining.length > 0) {
                await message.channel.send(remaining.substring(0, 1900));
            }
        } else {
            // Normal response
            await message.reply(responseText);
        }

    } catch (error) {
        console.error('AI Message Error:', error);

        let errorMessage = '❌ **An error occurred while processing your request.**';

        if (error.message?.includes('quota')) {
            errorMessage = '⚠️ **Quota exceeded!** Please try again later.';
        } else if (error.message?.includes('rate limit')) {
            errorMessage = '⏰ **Rate limit hit!** Please wait a moment.';
        } else if (error.message?.includes('blocked')) {
            errorMessage = '🚫 **Content blocked!** Your request was flagged by safety filters.';
        }

        const embed = new EmbedBuilder()
            .setColor(0xFF0000)
            .setDescription(errorMessage);

        await message.reply({ embeds: [embed] });
    }
}

module.exports = {
    aichannelset,
    aichannelremove, 
    maintenance,
    handleAIMessage // Export this to use in your main bot file
};
