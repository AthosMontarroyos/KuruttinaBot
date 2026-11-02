import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommand } from '#bot/command-system/types.js';

// Inválido: dentro de `dev/` mas sem a política staff obrigatória da pasta.
export const command = {
  data: new SlashCommandBuilder().setName('devaberto').setDescription('Fixtures aberto dentro da pasta dev'),
  access: { kind: 'public' },
  help: { topic: 'dev', examples: [{ slash: '/devaberto', prefix: 'k!devaberto' }] },
  scope: 'dev-guild',
  execute: async () => {},
} satisfies ChatInputCommand;
