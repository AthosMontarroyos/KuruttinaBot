import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommand } from '#bot/command-system/types.js';

export const command = {
  data: new SlashCommandBuilder().setName('aberto').setDescription('Fixture válida da pasta public'),
  access: { kind: 'public' },
  help: { topic: 'public', examples: [{ slash: '/aberto', prefix: 'k!aberto' }] },
  scope: 'global',
  execute: async () => {},
} satisfies ChatInputCommand;
