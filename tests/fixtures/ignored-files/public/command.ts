import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommand } from '#bot/command-system/types.js';

export const command = {
  data: new SlashCommandBuilder().setName('visivel').setDescription('Fixture visivel'),
  access: { kind: 'public' },
  scope: 'global',
  execute: async () => {},
} satisfies ChatInputCommand;
