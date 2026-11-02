import { SlashCommandBuilder } from 'discord.js';

// Inválido: em public/ o tópico mod é proibido.
export const command = {
  data: new SlashCommandBuilder().setName('publicomod').setDescription('Fixture public com tópico mod'),
  access: { kind: 'public' },
  scope: 'global',
  help: { topic: 'mod', examples: [{ slash: '/publicomod', prefix: 'k!publicomod' }] },
  execute: async () => {},
};
