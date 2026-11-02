import { SlashCommandBuilder } from 'discord.js';

// Inválido: em dev/ o tópico precisa ser dev, não fun.
export const command = {
  data: new SlashCommandBuilder().setName('devfun').setDescription('Fixture dev com tópico fun'),
  access: { kind: 'staff', minimumRole: 'dev', userPermissions: [], botPermissions: [] },
  scope: 'dev-guild',
  help: { topic: 'fun', examples: [{ slash: '/devfun', prefix: 'k!devfun' }] },
  execute: async () => {},
};
