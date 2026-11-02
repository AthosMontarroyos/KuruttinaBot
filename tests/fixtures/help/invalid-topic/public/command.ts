import { SlashCommandBuilder } from 'discord.js';

// Inválido: tópico fora de public, mod, dev, fun e utility.
export const command = {
  data: new SlashCommandBuilder().setName('topico').setDescription('Fixture com tópico inválido'),
  access: { kind: 'public' },
  scope: 'global',
  help: { topic: 'nope', examples: [{ slash: '/topico', prefix: 'k!topico' }] },
  execute: async () => {},
};
