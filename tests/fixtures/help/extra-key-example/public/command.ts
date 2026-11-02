import { SlashCommandBuilder } from 'discord.js';

// Inválido: o exemplo traz uma chave extra além de slash e prefix.
export const command = {
  data: new SlashCommandBuilder().setName('extra').setDescription('Fixture com chave extra no exemplo'),
  access: { kind: 'public' },
  scope: 'global',
  help: { topic: 'fun', examples: [{ slash: '/extra', prefix: 'k!extra', note: 'sobra' }] },
  execute: async () => {},
};
