import { SlashCommandBuilder } from 'discord.js';

// Inválido: o exemplo prefix não tem o prefixo k!.
export const command = {
  data: new SlashCommandBuilder().setName('alvo').setDescription('Fixture com prefix sem k!'),
  access: { kind: 'public' },
  scope: 'global',
  help: { topic: 'fun', examples: [{ slash: '/alvo', prefix: 'alvo' }] },
  execute: async () => {},
};
