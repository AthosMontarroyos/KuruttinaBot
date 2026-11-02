import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommand } from '#bot/command-system/types.js';

export const command = {
  data: new SlashCommandBuilder().setName('modpublic').setDescription('Politica public em mod'),
  access: { kind: 'public' },
  help: { topic: 'mod', examples: [{ slash: '/modpublic', prefix: 'k!modpublic' }] },
  scope: 'global',
  execute: async () => {},
} satisfies ChatInputCommand;
