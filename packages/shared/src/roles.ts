export interface RoleGroupDefinition {
  id: string;
  name: string;
  description: string;
  color: string;
  isDefault: boolean;
}

export const DEFAULT_ROLE_GROUPS: Record<string, RoleGroupDefinition> = {
  ADMIN: {
    id: 'admin',
    name: 'Grupo de Administradores',
    description: 'Acesso total a configurações e gerenciamento do bot',
    color: '#FF4757',
    isDefault: true,
  },
  MODERATOR: {
    id: 'moderator',
    name: 'Grupo de Moderadores',
    description: 'Permissões para punições, expurgar mensagens e logs',
    color: '#FFA502',
    isDefault: true,
  },
  MEMBER: {
    id: 'member',
    name: 'Grupo de Membros Padrão',
    description: 'Cargos atribuídos automaticamente ao entrar no servidor',
    color: '#2ED573',
    isDefault: true,
  },
  MUTED: {
    id: 'muted',
    name: 'Grupo Silenciado (Muted)',
    description: 'Cargo para restrição temporária de escrita e voz',
    color: '#747D8C',
    isDefault: true,
  },
};
