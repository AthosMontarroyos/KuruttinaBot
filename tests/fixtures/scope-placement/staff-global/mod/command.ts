import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommand } from '#bot/command-system/types.js';

// Inválido: política staff com escopo global, fora da pasta dev/.
export const command = {
  data: new SlashCommandBuilder().setName('staffglobal').setDescription('Staff fora da pasta dev'),
  access: { kind: 'staff', minimumRole: 'dev', userPermissions: [], botPermissions: [] },
  scope: 'global',
  execute: async () => {},
} satisfies ChatInputCommand;
