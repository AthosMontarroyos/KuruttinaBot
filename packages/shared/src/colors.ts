/**
 * Cores Utilitárias de Status para Embeds do Bot no Discord e UI do Dashboard Web.
 */
export interface StatusColorDefinition {
  hex: string;
  number: number;
  description: string;
}

export const STATUS_COLORS = {
  SUCCESS: {
    hex: '#2ED573',
    number: 0x2ED573,
    description: 'Sucesso, confirmações e ações concluídas com êxito',
  },
  WARNING: {
    hex: '#FFA502',
    number: 0xFFA502,
    description: 'Alertas, avisos e confirmações pendentes',
  },
  ERROR: {
    hex: '#FF4757',
    number: 0xFF4757,
    description: 'Erros, falhas de execução, punições e bloqueios',
  },
  INFO: {
    hex: '#1E90FF',
    number: 0x1E90FF,
    description: 'Informações gerais, estatísticas de telemetria e guias',
  },
  NEUTRAL: {
    hex: '#747D8C',
    number: 0x747D8C,
    description: 'Estados neutros, dados inativos e rodapés',
  },
} as const;
