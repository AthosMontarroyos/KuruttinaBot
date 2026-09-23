import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommand } from '#bot/commands/types.js';

// Inválido: dentro de `dev/` mas sem a política staff obrigatória da pasta.
export const command = {
  data: new SlashCommandBuilder().setName('devaberto').setDescription('Fixtures aberto dentro da pasta dev'),
  access: { kind: 'public' },
  scope: 'dev-guild',
  execute: async () => {},
} satisfies ChatInputCommand;
