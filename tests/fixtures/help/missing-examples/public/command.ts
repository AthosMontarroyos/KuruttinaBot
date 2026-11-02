import { SlashCommandBuilder } from 'discord.js';

// Inválido: executor raiz sem help.examples.
export const command = {
  data: new SlashCommandBuilder().setName('semexemplo').setDescription('Fixture sem exemplos'),
  access: { kind: 'public' },
  scope: 'global',
  help: { topic: 'fun' },
  execute: async () => {},
};
