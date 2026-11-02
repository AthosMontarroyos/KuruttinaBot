import { SlashCommandBuilder } from 'discord.js';

// Inválido: o exemplo prefix mostra outro comando (k!outro em vez de k!alvo).
export const command = {
  data: new SlashCommandBuilder().setName('alvo').setDescription('Fixture com prefix de outro nome'),
  access: { kind: 'public' },
  scope: 'global',
  help: { topic: 'fun', examples: [{ slash: '/alvo', prefix: 'k!outro' }] },
  execute: async () => {},
};
