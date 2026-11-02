import { SlashCommandBuilder } from 'discord.js';

// Inválido: em mod/ o tópico precisa ser mod, não fun.
export const command = {
  data: new SlashCommandBuilder().setName('modfun').setDescription('Fixture mod com tópico fun'),
  access: { kind: 'guild', userPermissions: [], botPermissions: [] },
  scope: 'global',
  help: { topic: 'fun', examples: [{ slash: '/modfun', prefix: 'k!modfun' }] },
  execute: async () => {},
};
