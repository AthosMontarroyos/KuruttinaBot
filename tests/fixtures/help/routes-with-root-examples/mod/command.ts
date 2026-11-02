import { SlashCommandBuilder } from 'discord.js';

// Inválido: com rotas, help.examples é proibido (cada rota tem os seus).
export const command = {
  data: new SlashCommandBuilder()
    .setName('grupo')
    .setDescription('Fixture com rotas e exemplos na raiz')
    .addSubcommand((sub) => sub.setName('add').setDescription('Adiciona um item'))
    .addSubcommand((sub) => sub.setName('info').setDescription('Mostra um item')),
  access: { kind: 'guild', userPermissions: [], botPermissions: [] },
  scope: 'global',
  help: { topic: 'mod', examples: [{ slash: '/grupo', prefix: 'k!grupo' }] },
  routes: [
    {
      path: ['add'],
      aliases: ['grupo-add'],
      examples: [{ slash: '/grupo add nome', prefix: 'k!grupo-add nome' }],
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
