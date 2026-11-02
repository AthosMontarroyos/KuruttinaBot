import { SlashCommandBuilder } from 'discord.js';

// Inválido: quatro exemplos (máximo de três).
export const command = {
  data: new SlashCommandBuilder().setName('muitos').setDescription('Fixture com exemplos demais'),
  access: { kind: 'public' },
  scope: 'global',
  help: {
    topic: 'fun',
    examples: [
      { slash: '/muitos', prefix: 'k!muitos' },
      { slash: '/muitos a', prefix: 'k!muitos a' },
      { slash: '/muitos b', prefix: 'k!muitos b' },
      { slash: '/muitos c', prefix: 'k!muitos c' },
    ],
  },
  execute: async () => {},
};
