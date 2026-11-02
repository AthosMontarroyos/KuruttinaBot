import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommand } from '#bot/command-system/types.js';

export const command = {
  data: new SlashCommandBuilder().setName('visivel').setDescription('Fixture visivel'),
  access: { kind: 'public' },
  help: { topic: 'public', examples: [{ slash: '/visivel', prefix: 'k!visivel' }] },
  scope: 'global',
  execute: async () => {},
} satisfies ChatInputCommand;
