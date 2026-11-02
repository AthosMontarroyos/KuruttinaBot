import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommand } from '#bot/command-system/types.js';

export const command = {
  data: new SlashCommandBuilder().setName('devglobal').setDescription('Staff com escopo global em dev'),
  access: { kind: 'staff', minimumRole: 'dev', userPermissions: [], botPermissions: [] },
  help: { topic: 'dev', examples: [{ slash: '/devglobal', prefix: 'k!devglobal' }] },
  scope: 'global',
  execute: async () => {},
} satisfies ChatInputCommand;
