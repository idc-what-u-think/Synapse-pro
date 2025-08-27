const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('pain')
    .setDescription('Feel the pain of the world')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
  async execute(interaction) {
    try {
      const channel = interaction.channel;
      
      await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, {
        SendMessages: false
      });
      
      await interaction.reply({ content: 'Itami o kanjiro', ephemeral: false });
      setTimeout(async () => {
        await interaction.followUp('Itami o kangaero');
      }, 3000);
      
      setTimeout(async () => {
        await interaction.followUp('Itami o uketore');
      }, 6000);
      
      setTimeout(async () => {
        await interaction.followUp('Itami o shire');
      }, 9000);
      
      setTimeout(async () => {
        await interaction.followUp('Koko yori... sekai ni itami o...');
      }, 14000);
      
      setTimeout(async () => {
        await interaction.followUp('**Shinra tensei!**');
      }, 18000);
      
      setTimeout(async () => {
        await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, {
          SendMessages: null
        });
      }, 21000);
      
    } catch (error) {
      console.error('Error executing pain command:', error);
      await interaction.reply({
        content: 'An error occurred while executing the pain command.',
        ephemeral: true
      });
    }
  }
};
