const { SlashCommandBuilder, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { saveData, getData } = require('../utils/github');
const evalLib = require('eval-lib');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('createcommand')
    .setDescription('Create a new bot command easily')
    .addStringOption(option =>
      option.setName('category')
        .setDescription('Type of command')
        .setRequired(true)
        .addChoices(
          { name: 'Basic', value: 'basic' },
          { name: 'Moderation', value: 'moderation' },
          { name: 'Utility', value: 'utility' },
          { name: 'Fun', value: 'fun' },
          { name: 'Custom', value: 'custom' }
        )
    ),

  async execute(interaction) {
    try {
      const category = interaction.options.getString('category');
      const modal = new ModalBuilder()
        .setCustomId(`create_${category}`)
        .setTitle('Create New Command');

      const nameInput = new TextInputBuilder()
        .setCustomId('commandName')
        .setLabel('Command Name')
        .setStyle(TextInputStyle.Short)
        .setMaxLength(32)
        .setRequired(true);

      const descriptionInput = new TextInputBuilder()
        .setCustomId('commandDescription')
        .setLabel('Command Description')
        .setStyle(TextInputStyle.Short)
        .setMaxLength(100)
        .setRequired(true);

      const responseInput = new TextInputBuilder()
        .setCustomId('commandResponse')
        .setLabel('Command Response')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true);

      modal.addComponents(
        new ActionRowBuilder().addComponents(nameInput),
        new ActionRowBuilder().addComponents(descriptionInput),
        new ActionRowBuilder().addComponents(responseInput)
      );

      await interaction.showModal(modal);

      const submitted = await interaction.awaitModalSubmit({
        time: 300000,
        filter: i => i.customId.startsWith('create_')
      }).catch(() => null);

      if (submitted) {
        const name = submitted.fields.getTextInputValue('commandName');
        const description = submitted.fields.getTextInputValue('commandDescription');
        const response = submitted.fields.getTextInputValue('commandResponse');

        const command = evalLib.generateCommand({
          name,
          description,
          template: category,
          content: response,
          type: 'slash'
        });

        await saveData(`commands/${name}.js`, command.code);

        const index = await getData('commands/index.json') || {};
        index[name] = {
          category,
          description,
          createdAt: new Date().toISOString()
        };
        await saveData('commands/index.json', index);

        await submitted.reply({
          content: `✅ Command /${name} created! Use /reload to activate.`,
          ephemeral: true
        });
      }
    } catch (error) {
      await interaction.followUp({
        content: '❌ Failed to create command. Please try again.',
        ephemeral: true
      });
    }
  }
};
