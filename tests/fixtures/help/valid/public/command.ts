import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommand } from '#bot/command-system/types.js';

// Válido: pasta public, tópico fun e exemplos corretos do executor raiz.
export const command = {
  data: new SlashCommandBuilder().setName('valido').setDescription('Fixture válida de ajuda'),
  access: { kind: 'public' },
  scope: 'global',
  help: {
    topic: 'fun',
    examples: [
      { slash: '/valido', prefix: 'k!valido' },
      { slash: '/valido texto', prefix: 'k!valido texto' },
    ],
  },
  execute: async () => {},
} satisfies ChatInputCommand;
