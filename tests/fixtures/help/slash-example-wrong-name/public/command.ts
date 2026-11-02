import { SlashCommandBuilder } from 'discord.js';

// Inválido: o exemplo slash mostra outro comando (/outro em vez de /alvo).
export const command = {
  data: new SlashCommandBuilder().setName('alvo').setDescription('Fixture com slash de outro nome'),
  access: { kind: 'public' },
  scope: 'global',
  help: { topic: 'fun', examples: [{ slash: '/outro', prefix: 'k!alvo' }] },
  execute: async () => {},
};
