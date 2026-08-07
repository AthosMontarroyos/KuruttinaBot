export interface PlaceholderDefinition {
  key: string;
  description: string;
  example: string;
}

export const PLACEHOLDERS: Record<string, PlaceholderDefinition> = {
  USER_MENTION: {
    key: '{user}',
    description: 'Menciona o usuário que acionou o evento',
    example: '@KuruttinaUser',
  },
  USER_NAME: {
    key: '{user.name}',
    description: 'Nome de exibição do usuário',
    example: 'KuruttinaUser',
  },
  USER_ID: {
    key: '{user.id}',
    description: 'ID numérico do usuário no Discord',
    example: '1509331533348212808',
  },
  SERVER_NAME: {
    key: '{server}',
    description: 'Nome do servidor (Guild)',
    example: 'Servidor Oficial da Kuruttina',
  },
  SERVER_MEMBER_COUNT: {
    key: '{server.members}',
    description: 'Quantidade total de membros no servidor',
    example: '1,250',
  },
  CHANNEL_MENTION: {
    key: '{channel}',
    description: 'Menciona o canal onde a ação ocorreu',
    example: '#geral',
  },
};
