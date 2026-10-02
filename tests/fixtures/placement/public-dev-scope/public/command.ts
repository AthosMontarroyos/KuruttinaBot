import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommand } from '#bot/command-system/types.js';

export const command = {
  data: new SlashCommandBuilder().setName('publicdev').setDescription('Escopo dev-guild em public'),
  access: { kind: 'public' },
  scope: 'dev-guild',
  execute: async () => {},
} satisfies ChatInputCommand;
