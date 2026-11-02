export const command = {
  data: {
    name: 'rota',
    description: 'Rota inválida',
    toJSON: () => ({ name: 'rota', description: 'Rota inválida', default_member_permissions: null }),
  },
  access: {
    kind: 'guild',
    userPermissions: [],
    botPermissions: [],
  },
  help: { topic: 'mod' },
  scope: 'global',
  routes: [{
    path: ['info'],
    aliases: ['rota-info'],
    examples: [{ slash: '/rota info', prefix: 'k!rota-info' }],
    access: { kind: 'public' },
    execute: async () => {},
  }],
};
