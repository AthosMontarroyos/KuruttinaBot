import { SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import type { ChatInputCommand } from '../../handlers/CommandsHandler.js';

export const command = {
  data: new SlashCommandBuilder().setName('ping').setDescription('Replies with Pong!'),
  prefixCommand: false,
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.reply('Pong!');
  },
} satisfies ChatInputCommand;
