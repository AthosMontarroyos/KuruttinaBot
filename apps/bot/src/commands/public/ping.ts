import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommand, CommandContext } from '#bot/commands/types.js';

export const command = {
  data: new SlashCommandBuilder().setName('ping').setDescription('Replies with Pong!'),
  async execute(context: CommandContext): Promise<void> {
    await context.reply('Pong!');
  },
} satisfies ChatInputCommand;
