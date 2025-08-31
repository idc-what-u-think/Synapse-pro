const { 
  StringSelectMenuBuilder,
  StringSelectMenuInteraction,
  ActionRowBuilder,
  ComponentType
} = require('discord.js');
const { deviceDatabase } = require('../data/deviceDatabase');
const { websiteAPI } = require('../utils/websiteAPI');
const { ResultFormatter } = require('../utils/formatters');
const { Game, PlayStyle, ExperienceLevel, FingerCount } = require('../types/gameEnums');

class SensitivityHandler {
  constructor(interaction, game) {
    this.interaction = interaction;
    this.game = game;
    this.deviceName = null;
    this.playStyle = null;
    this.experienceLevel = null;
    this.fingerCount = null;
    this.api = new WebsiteAPI(); // Add API initialization
  }

  async handle() {
    try {
      await this.selectDevice();
      
      if (this.game === 'FF') {
        await this.selectPlayStyle();
        await this.selectExperience();
      } else {
        await this.selectFingerCount();
      }

      await this.generateResults();
    } catch (error) {
      console.error('Error in sensitivity handler:', error);
      
      // Check if interaction is still valid
      try {
        await this.interaction.editReply({
          content: 'There was an error processing your request. Please try again.',
          components: []
        });
      } catch (editError) {
        console.error('Failed to edit reply:', editError);
      }
    }
  }

  async selectDevice() {
    const deviceNames = Object.keys(deviceDatabase);
    
    if (deviceNames.length === 0) {
      throw new Error('No devices available in database');
    }

    const deviceOptions = deviceNames.map(device => ({
      label: device,
      value: device
    }));

    // Split options if too many (Discord has a 25 option limit)
    const deviceMenu = new StringSelectMenuBuilder()
      .setCustomId('device_select')
      .setPlaceholder('Select your device')
      .addOptions(deviceOptions.slice(0, 25)); // Limit to 25 options

    const row = new ActionRowBuilder()
      .addComponents(deviceMenu);

    const response = await this.interaction.editReply({
      content: `Let's configure your ${Game[this.game]} sensitivity settings. First, select your device:`,
      components: [row]
    });

    try {
      const selected = await response.awaitMessageComponent({
        componentType: ComponentType.StringSelect,
        time: 30000,
        filter: (i) => i.user.id === this.interaction.user.id
      });

      this.deviceName = selected.values[0];
      await selected.update({ 
        content: `✅ Selected device: **${this.deviceName}**`, 
        components: [] 
      });
    } catch (error) {
      if (error.code === 'INTERACTION_COLLECTOR_ERROR') {
        await this.interaction.editReply({
          content: '⏱️ Selection timed out. Please run the command again.',
          components: []
        });
        throw new Error('Selection timed out');
      }
      throw error;
    }
  }

  async selectPlayStyle() {
    const styleOptions = Object.values(PlayStyle).map(style => ({
      label: style,
      value: style
    }));

    const styleMenu = new StringSelectMenuBuilder()
      .setCustomId('style_select')
      .setPlaceholder('Choose your play style')
      .addOptions(styleOptions);

    const row = new ActionRowBuilder()
      .addComponents(styleMenu);

    const response = await this.interaction.editReply({
      content: '🎮 Select your play style:',
      components: [row]
    });

    try {
      const selected = await response.awaitMessageComponent({
        componentType: ComponentType.StringSelect,
        time: 30000,
        filter: (i) => i.user.id === this.interaction.user.id
      });

      this.playStyle = selected.values[0];
      await selected.update({ 
        content: `✅ Play style: **${this.playStyle}**`, 
        components: [] 
      });
    } catch (error) {
      if (error.code === 'INTERACTION_COLLECTOR_ERROR') {
        await this.interaction.editReply({
          content: '⏱️ Selection timed out. Please run the command again.',
          components: []
        });
        throw new Error('Selection timed out');
      }
      throw error;
    }
  }

  async selectExperience() {
    const expOptions = Object.values(ExperienceLevel).map(level => ({
      label: level,
      value: level
    }));

    const expMenu = new StringSelectMenuBuilder()
      .setCustomId('exp_select')
      .setPlaceholder('Choose your experience level')
      .addOptions(expOptions);

    const row = new ActionRowBuilder()
      .addComponents(expMenu);

    const response = await this.interaction.editReply({
      content: '📈 Select your experience level:',
      components: [row]
    });

    try {
      const selected = await response.awaitMessageComponent({
        componentType: ComponentType.StringSelect,
        time: 30000,
        filter: (i) => i.user.id === this.interaction.user.id
      });

      this.experienceLevel = selected.values[0];
      await selected.update({ 
        content: `✅ Experience level: **${this.experienceLevel}**`, 
        components: [] 
      });
    } catch (error) {
      if (error.code === 'INTERACTION_COLLECTOR_ERROR') {
        await this.interaction.editReply({
          content: '⏱️ Selection timed out. Please run the command again.',
          components: []
        });
        throw new Error('Selection timed out');
      }
      throw error;
    }
  }

  async selectFingerCount() {
    const fingerOptions = Object.values(FingerCount).map(count => ({
      label: count,
      value: count
    }));

    const fingerMenu = new StringSelectMenuBuilder()
      .setCustomId('finger_select')
      .setPlaceholder('Choose your finger count')
      .addOptions(fingerOptions);

    const row = new ActionRowBuilder()
      .addComponents(fingerMenu);

    const response = await this.interaction.editReply({
      content: '✋ How many fingers do you use to play?',
      components: [row]
    });

    try {
      const selected = await response.awaitMessageComponent({
        componentType: ComponentType.StringSelect,
        time: 30000,
        filter: (i) => i.user.id === this.interaction.user.id
      });

      this.fingerCount = selected.values[0];
      await selected.update({ 
        content: `✅ Selected control: **${this.fingerCount}**`, 
        components: [] 
      });
    } catch (error) {
      if (error.code === 'INTERACTION_COLLECTOR_ERROR') {
        await this.interaction.editReply({
          content: '⏱️ Selection timed out. Please run the command again.',
          components: []
        });
        throw new Error('Selection timed out');
      }
      throw error;
    }
  }

  async generateResults() {
    if (!this.deviceName) throw new Error('Device not selected');
    
    try {
      // Get device details from API
      const deviceResponse = await this.api.getDeviceDetails([this.deviceName]);
      if (!deviceResponse.success) {
        throw new Error('Failed to fetch device details');
      }
      const device = deviceResponse.data[0];

      // Calculate settings via API
      const params = {
        game: this.game,
        device: this.deviceName,
        playstyle: this.playStyle,
        fingers: this.fingerCount
      };

      const result = await this.api.calculateSensitivity(params);
      if (!result.success) {
        throw new Error('Failed to calculate sensitivity');
      }

      // Create embed with results
      let embed;
      if (this.game === 'FF') {
        embed = ResultFormatter.createFFEmbed(device, result.data, this.playStyle, this.experienceLevel);
      } else {
        embed = ResultFormatter.createCODMEmbed(device, result.data, this.fingerCount);
      }

      const buttons = ResultFormatter.createButtons();

      await this.interaction.editReply({
        content: null,
        embeds: [embed],
        components: [buttons]
      });

    } catch (error) {
      console.error('Error generating results:', error);
      throw error;
    }
  }

  // Getter methods for accessing private properties (for button handlers)
  getDeviceName() {
    return this.deviceName;
  }

  getGame() {
    return this.game;
  }

  getPlayStyle() {
    return this.playStyle;
  }

  getExperienceLevel() {
    return this.experienceLevel;
  }

  getFingerCount() {
    return this.fingerCount;
  }

  getSettingsText() {
    if (!this.deviceName) return 'No device selected';
    
    const device = deviceDatabase[this.deviceName];
    if (!device) return 'Device not found';

    let settings;
    let additionalInfo = {};

    if (this.game === 'FF') {
      settings = WebsiteAPI.calculateFFSensitivity(device, this.playStyle, this.experienceLevel);
      additionalInfo = { playStyle: this.playStyle, experienceLevel: this.experienceLevel };
    } else {
      settings = WebsiteAPI.calculateCODMSensitivity(device, this.fingerCount);
      additionalInfo = { fingerCount: this.fingerCount, mode: 'mp' };
    }

    return ResultFormatter.createSettingsText(device, settings, this.game, additionalInfo);
  }
}

module.exports = { SensitivityHandler };
