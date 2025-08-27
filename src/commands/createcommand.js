const { SlashCommandBuilder, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, EmbedBuilder } = require('discord.js');
const { getData, saveData } = require('../utils/github');
const axios = require('axios');

const EVAL_LIB_URL = process.env.EVAL_LIB_URL || 'http://localhost:3000';
const MODAL_TIMEOUT = 300000; // 5 minutes
const REQUEST_TIMEOUT = 10000; // 10 seconds

// Template cache to reduce API calls
const templateCache = new Map();
const CACHE_DURATION = 300000; // 5 minutes

module.exports = {
    data: new SlashCommandBuilder()
        .setName('createcommand')
        .setDescription('Create a new bot command')
        .addStringOption(option =>
            option.setName('type')
                .setDescription('Type of command to create')
                .setRequired(true)
                .addChoices(
                    { name: 'Basic', value: 'basic' },
                    { name: 'Moderation', value: 'moderation' },
                    { name: 'Utility', value: 'utility' },
                    { name: 'Fun', value: 'fun' },
                    { name: 'Custom', value: 'custom' }
                )),

    async execute(interaction) {
        try {
            const commandType = interaction.options.getString('type');
            
            // Check user permissions for command creation
            if (!hasCommandCreationPermissions(interaction.member)) {
                return await interaction.reply({
                    content: '❌ You need Administrator permissions to create commands.',
                    ephemeral: true
                });
            }

            // Fetch templates with caching
            let templates;
            try {
                templates = await getTemplatesWithCache(commandType);
            } catch (error) {
                console.error('Template fetch error:', error);
                return await interaction.reply({
                    content: '❌ Failed to fetch command templates. Please try again later.',
                    ephemeral: true
                });
            }

            // Create modal for command creation
            const modal = new ModalBuilder()
                .setCustomId(`create_command_${commandType}_${Date.now()}`)
                .setTitle(`Create ${capitalizeFirst(commandType)} Command`);

            // Add validated inputs
            const nameInput = new TextInputBuilder()
                .setCustomId('commandName')
                .setLabel('Command Name')
                .setStyle(TextInputStyle.Short)
                .setMinLength(1)
                .setMaxLength(32)
                .setPlaceholder('alphanumeric, hyphens, underscores only')
                .setRequired(true);

            const descriptionInput = new TextInputBuilder()
                .setCustomId('commandDescription')
                .setLabel('Command Description')
                .setStyle(TextInputStyle.Short)
                .setMinLength(1)
                .setMaxLength(100)
                .setPlaceholder('Brief description of what this command does')
                .setRequired(true);

            const contentInput = new TextInputBuilder()
                .setCustomId('commandContent')
                .setLabel('Command Content')
                .setStyle(TextInputStyle.Paragraph)
                .setMinLength(1)
                .setMaxLength(4000)
                .setPlaceholder(getPlaceholderForType(commandType))
                .setRequired(true);

            // Add optional parameters input for advanced users
            const parametersInput = new TextInputBuilder()
                .setCustomId('commandParameters')
                .setLabel('Additional Parameters (Optional)')
                .setStyle(TextInputStyle.Paragraph)
                .setMaxLength(1000)
                .setPlaceholder('JSON format: {"option1": "value1", "option2": "value2"}')
                .setRequired(false);

            const rows = [
                new ActionRowBuilder().addComponents(nameInput),
                new ActionRowBuilder().addComponents(descriptionInput),
                new ActionRowBuilder().addComponents(contentInput),
                new ActionRowBuilder().addComponents(parametersInput)
            ];

            modal.addComponents(rows);

            // Show modal and wait for submission
            await interaction.showModal(modal);

            try {
                const submission = await interaction.awaitModalSubmit({
                    filter: i => i.customId.startsWith(`create_command_${commandType}_`),
                    time: MODAL_TIMEOUT
                });

                // Validate and sanitize input data
                const formData = await validateAndSanitizeInput(submission, commandType);
                if (!formData.valid) {
                    return await submission.reply({
                        content: `❌ Validation Error: ${formData.error}`,
                        ephemeral: true
                    });
                }

                // Check for command name conflicts
                const existingCommands = await getData('data/commands/index.json') || {};
                if (existingCommands[formData.name]) {
                    return await submission.reply({
                        content: `❌ Command \`${formData.name}\` already exists. Please choose a different name.`,
                        ephemeral: true
                    });
                }

                // Show loading message
                await submission.deferReply({ ephemeral: true });

                // Generate command using eval-lib with timeout
                const { data: result } = await axios.post(
                    `${EVAL_LIB_URL}/api/commands/create`, 
                    formData,
                    {
                        headers: { 'x-github-token': process.env.GITHUB_TOKEN },
                        timeout: REQUEST_TIMEOUT
                    }
                );

                if (!result.success) {
                    throw new Error(result.error || 'Failed to generate command');
                }

                // Validate generated code before saving
                if (!isValidCommandCode(result.command.code)) {
                    throw new Error('Generated command code failed security validation');
                }

                // Save command to GitHub with error handling
                try {
                    await saveData(
                        `data/commands/${formData.name}.js`,
                        result.command.code,
                        `Add ${commandType} command: ${formData.name}`,
                        interaction.user.id
                    );

                    // Update commands index atomically
                    existingCommands[formData.name] = {
                        type: commandType,
                        description: formData.description,
                        createdAt: new Date().toISOString(),
                        createdBy: interaction.user.id,
                        version: '1.0.0',
                        parameters: formData.parameters || {}
                    };
                    
                    await saveData(
                        'data/commands/index.json', 
                        existingCommands, 
                        `Update commands index: add ${formData.name}`,
                        interaction.user.id
                    );

                } catch (saveError) {
                    console.error('Save error:', saveError);
                    throw new Error('Failed to save command to storage');
                }

                // Success response with detailed information
                const successEmbed = new EmbedBuilder()
                    .setColor('#00FF00')
                    .setTitle('✅ Command Created Successfully')
                    .addFields([
                        { name: 'Command Name', value: `\`${formData.name}\``, inline: true },
                        { name: 'Type', value: capitalizeFirst(commandType), inline: true },
                        { name: 'Description', value: formData.description, inline: false },
                        { name: 'Next Steps', value: 'Restart the bot to load the new command, or use `/reloadcommands` if available.', inline: false }
                    ])
                    .setTimestamp()
                    .setFooter({ text: `Created by ${interaction.user.tag}` });

                await submission.editReply({
                    embeds: [successEmbed]
                });

            } catch (modalError) {
                if (modalError.code === 'INTERACTION_COLLECTOR_ERROR') {
                    await interaction.followUp({
                        content: '❌ Command creation timed out. Please try again.',
                        ephemeral: true
                    });
                } else {
                    throw modalError;
                }
            }

        } catch (error) {
            console.error('Command creation error:', {
                error: error.message,
                stack: error.stack,
                user: interaction.user.id,
                guild: interaction.guild?.id
            });

            const errorMessage = getErrorMessage(error);
            const responseMethod = interaction.deferred ? 'editReply' : 'followUp';
            
            try {
                await interaction[responseMethod]({
                    content: `❌ Failed to create command: ${errorMessage}`,
                    ephemeral: true
                });
            } catch (replyError) {
                console.error('Failed to send error message:', replyError);
            }
        }
    }
};

// Helper Functions

function hasCommandCreationPermissions(member) {
    if (!member) return false;
    return member.permissions.has('Administrator') || 
           member.roles.cache.some(role => role.name.toLowerCase().includes('developer'));
}

async function getTemplatesWithCache(commandType) {
    const cacheKey = `templates_${commandType}`;
    const cached = templateCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        return cached.data;
    }

    const { data: templates } = await axios.get(
        `${EVAL_LIB_URL}/api/templates/${commandType}`,
        {
            headers: { 'x-github-token': process.env.GITHUB_TOKEN },
            timeout: REQUEST_TIMEOUT
        }
    );

    templateCache.set(cacheKey, {
        data: templates,
        timestamp: Date.now()
    });

    return templates;
}

async function validateAndSanitizeInput(submission, commandType) {
    const name = submission.fields.getTextInputValue('commandName').toLowerCase().trim();
    const description = submission.fields.getTextInputValue('commandDescription').trim();
    const content = submission.fields.getTextInputValue('commandContent').trim();
    const parametersRaw = submission.fields.getTextInputValue('commandParameters') || '{}';

    // Validate command name
    if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
        return { valid: false, error: 'Command name can only contain letters, numbers, hyphens, and underscores.' };
    }

    // Check reserved command names
    const reservedNames = ['help', 'ping', 'eval', 'exec', 'reload', 'shutdown'];
    if (reservedNames.includes(name)) {
        return { valid: false, error: 'This command name is reserved.' };
    }

    // Validate description
    if (description.length < 1 || description.length > 100) {
        return { valid: false, error: 'Description must be between 1-100 characters.' };
    }

    // Validate content
    if (content.length < 1 || content.length > 4000) {
        return { valid: false, error: 'Content must be between 1-4000 characters.' };
    }

    // Validate parameters JSON
    let parameters = {};
    if (parametersRaw.trim() !== '{}') {
        try {
            parameters = JSON.parse(parametersRaw);
            if (typeof parameters !== 'object' || Array.isArray(parameters)) {
                throw new Error('Parameters must be a JSON object');
            }
        } catch (jsonError) {
            return { valid: false, error: 'Invalid JSON format in parameters field.' };
        }
    }

    // Check for potentially dangerous content
    const dangerousPatterns = [
        /require\s*\(\s*['"]fs['"]/, // File system access
        /require\s*\(\s*['"]child_process['"]/, // Process execution
        /eval\s*\(/, // Code evaluation
        /Function\s*\(/, // Dynamic function creation
        /process\.exit/, // Process termination
        /__dirname/, // Directory access
        /__filename/ // File access
    ];

    for (const pattern of dangerousPatterns) {
        if (pattern.test(content)) {
            return { valid: false, error: 'Content contains potentially unsafe code patterns.' };
        }
    }

    return {
        valid: true,
        name,
        description,
        content,
        type: 'slash',
        template: commandType,
        parameters
    };
}

function isValidCommandCode(code) {
    if (!code || typeof code !== 'string') return false;
    
    // Basic validation - check for required structure
    const requiredPatterns = [
        /module\.exports\s*=/, // Module export
        /data\s*:/, // Command data
        /execute\s*\(/ // Execute function
    ];

    return requiredPatterns.every(pattern => pattern.test(code));
}

function getErrorMessage(error) {
    if (error.code === 'ECONNREFUSED') {
        return 'Service temporarily unavailable. Please try again later.';
    }
    if (error.code === 'TIMEOUT') {
        return 'Request timed out. Please try again.';
    }
    if (error.response?.status === 401) {
        return 'Authentication failed. Please contact an administrator.';
    }
    if (error.response?.status >= 500) {
        return 'Server error. Please try again later.';
    }
    return error.response?.data?.error || error.message || 'Unknown error occurred.';
}

function getPlaceholderForType(type) {
    switch (type) {
        case 'basic':
            return 'Enter the command response text or embed content';
        case 'moderation':
            return 'Enter moderation action (ban, kick, mute, warn) and default settings';
        case 'utility':
            return 'Enter utility function details (userinfo, serverinfo, etc.)';
        case 'fun':
            return 'Enter fun command parameters (jokes, games, random responses)';
        case 'custom':
            return 'Enter custom command logic and response handling';
        default:
            return 'Enter command content and behavior';
    }
}

function capitalizeFirst(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}
