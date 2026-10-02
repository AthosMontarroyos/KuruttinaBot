import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommand } from '#bot/command-system/types.js';

// Inválido: escopo dev-guild fora da pasta dev/.
export const command = {
  data: new SlashCommandBuilder().setName('fora').setDescription('Escopo dev-guild fora da pasta dev'),
  access: { kind: 'staff', minimumRole: 'dev', userPermissions: [], botPermissions: [] },
  scope: 'dev-guild',
  execute: async () => {},
} satisfies ChatInputCommand;
