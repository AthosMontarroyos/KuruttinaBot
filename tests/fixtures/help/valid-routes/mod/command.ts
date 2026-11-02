import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommand } from '#bot/command-system/types.js';

// Válido: pasta mod com rotas; o help raiz traz só o tópico e cada rota tem seus exemplos.
export const command = {
  data: new SlashCommandBuilder()
    .setName('grupo')
    .setDescription('Fixture válida com rotas')
    .addSubcommand((sub) => sub.setName('add').setDescription('Adiciona um item'))
    .addSubcommand((sub) => sub.setName('info').setDescription('Mostra um item')),
  access: { kind: 'guild', userPermissions: [], botPermissions: [] },
  scope: 'global',
  help: { topic: 'mod' },
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
} satisfies ChatInputCommand;
