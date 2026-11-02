import { SlashCommandBuilder } from 'discord.js';

// Inválido: help.examples existe mas está vazio (mínimo de 1 item).
export const command = {
  data: new SlashCommandBuilder().setName('vazio').setDescription('Fixture com exemplos vazios'),
  access: { kind: 'public' },
  scope: 'global',
  help: { topic: 'fun', examples: [] },
  execute: async () => {},
};
