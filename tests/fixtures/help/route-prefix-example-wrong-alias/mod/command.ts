import { SlashCommandBuilder } from 'discord.js';

// Inválido: o exemplo prefix da rota `add` usa o alias de `info`.
export const command = {
  data: new SlashCommandBuilder()
    .setName('grupo')
    .setDescription('Fixture com prefix de rota errada')
    .addSubcommand((sub) => sub.setName('add').setDescription('Adiciona um item'))
    .addSubcommand((sub) => sub.setName('info').setDescription('Mostra um item')),
  access: { kind: 'guild', userPermissions: [], botPermissions: [] },
  scope: 'global',
  help: { topic: 'mod' },
  routes: [
    {
      path: ['add'],
      aliases: ['grupo-add'],
      examples: [{ slash: '/grupo add', prefix: 'k!grupo-info' }],
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
