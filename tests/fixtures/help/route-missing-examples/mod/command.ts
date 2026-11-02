import { SlashCommandBuilder } from 'discord.js';

// Inválido: a rota `add` não traz examples próprios.
export const command = {
  data: new SlashCommandBuilder()
    .setName('grupo')
    .setDescription('Fixture com rota sem exemplos')
    .addSubcommand((sub) => sub.setName('add').setDescription('Adiciona um item'))
    .addSubcommand((sub) => sub.setName('info').setDescription('Mostra um item')),
  access: { kind: 'guild', userPermissions: [], botPermissions: [] },
  scope: 'global',
  help: { topic: 'mod' },
  routes: [
    {
      path: ['add'],
      aliases: ['grupo-add'],
      execute: async () => {},
    },
    {
      path: ['info'],
      aliases: ['grupo-info'],
      examples: [{ slash: '/grupo info', prefix: 'k!grupo-info' }],
      execute: async () => {},
    },
  ],
};
