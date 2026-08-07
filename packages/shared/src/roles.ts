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

/**
 * Interface para a definição de Cargos de Cores de Nome no Discord.
 */
export interface ColorRoleDefinition {
  id: string;
  name: string;
  category: string;
  hex: string;
  discordNote?: string;
}

export interface ColorCategoryDefinition {
  id: string;
  name: string;
  description: string;
}

/**
 * Categorias de Cargos de Cores organizadas para fácil renderização no Bot e no Dashboard Web.
 */
export const COLOR_ROLE_CATEGORIES: ColorCategoryDefinition[] = [
  { id: 'vermelho', name: 'Vermelho', description: 'Tons vermelhos vibrantes, pasteis e vinhos' },
  { id: 'laranja', name: 'Laranja', description: 'Tons de laranja, pêssego e caramelo suave' },
  { id: 'amarelo', name: 'Amarelo', description: 'Tons amarelados, dourados e mostarda' },
  { id: 'verde', name: 'Verde', description: 'Tons verdes, floresta e pasteis' },
  { id: 'azul', name: 'Azul', description: 'Tons azuis, ciano e azul escuro' },
  { id: 'roxo', name: 'Roxo / Violeta', description: 'Tons de lavanda, lilás, roxo e violeta' },
  { id: 'rosa', name: 'Rosa', description: 'Tons de rosa pastel, choque e magenta' },
  { id: 'neon', name: 'Neon', description: 'Cores de alto contraste e iluminação vibrante' },
  { id: 'neutras_frias', name: 'Neutras Frias', description: 'Escala de cinzas, prata, carvão e off-white' },
  { id: 'neutras_quentes', name: 'Neutras Quentes', description: 'Tons amadeirados, marrom, bege e areia' },
];

/**
 * LISTA DE CARGOS DE CORES EXCLUSIVAS PARA EXIBIÇÃO NOS NOMES/NICKNAMES DOS USUÁRIOS NO DISCORD.
 * 
 * ⚠️ NOTA IMPORTANTE SOBRE A RENDERIZAÇÃO DO DISCORD:
 * O cliente do Discord interpreta o hexadecimal `#000000` (Preto puro) como "SEM COR" (cor padrão da função/membro).
 * Portanto, a cor "Preto" foi ajustada para `#050505` (Preto profundo) para garantir que a cor seja efetivamente aplicada
 * e visível no nome do usuário no Discord sem resetar para a cor padrão do tema.
 */
export const COLOR_ROLES: ColorRoleDefinition[] = [
  // 1. Vermelho
  { id: 'color_vermelho_claro', name: 'Vermelho Claro', category: 'vermelho', hex: '#FF6B6B' },
  { id: 'color_vermelho', name: 'Vermelho', category: 'vermelho', hex: '#FF0000' },
  { id: 'color_carmim', name: 'Carmim', category: 'vermelho', hex: '#DC143C' },
  { id: 'color_vinho', name: 'Vinho', category: 'vermelho', hex: '#722F37' },
  { id: 'color_vermelho_pastel', name: 'Vermelho Pastel', category: 'vermelho', hex: '#FFB3B3' },

  // 2. Laranja
  { id: 'color_pessego', name: 'Pêssego', category: 'laranja', hex: '#FFCBA4' },
  { id: 'color_laranja_pastel', name: 'Laranja Pastel', category: 'laranja', hex: '#FFCC99' },
  { id: 'color_laranja_claro', name: 'Laranja Claro', category: 'laranja', hex: '#FFB347' },
  { id: 'color_laranja', name: 'Laranja', category: 'laranja', hex: '#FF8C00' },
  { id: 'color_laranja_escuro', name: 'Laranja Escuro', category: 'laranja', hex: '#CC5500' },

  // 3. Amarelo
  { id: 'color_amarelo_pastel', name: 'Amarelo Pastel', category: 'amarelo', hex: '#FFFACD' },
  { id: 'color_amarelo_claro', name: 'Amarelo Claro', category: 'amarelo', hex: '#FFFF99' },
  { id: 'color_amarelo', name: 'Amarelo', category: 'amarelo', hex: '#FFD700' },
  { id: 'color_dourado', name: 'Dourado', category: 'amarelo', hex: '#FFC200' },
  { id: 'color_mostarda', name: 'Mostarda', category: 'amarelo', hex: '#E3A857' },

  // 4. Verde
  { id: 'color_verde_pastel', name: 'Verde Pastel', category: 'verde', hex: '#B7E4C7' },
  { id: 'color_verde_claro', name: 'Verde Claro', category: 'verde', hex: '#90EE90' },
  { id: 'color_verde', name: 'Verde', category: 'verde', hex: '#008000' },
  { id: 'color_floresta', name: 'Floresta', category: 'verde', hex: '#228B22' },
  { id: 'color_verde_escuro', name: 'Verde Escuro', category: 'verde', hex: '#004B23' },

  // 5. Azul
  { id: 'color_azul_pastel', name: 'Azul Pastel', category: 'azul', hex: '#AEC6CF' },
  { id: 'color_ciano', name: 'Ciano', category: 'azul', hex: '#00FFFF' },
  { id: 'color_azul_claro', name: 'Azul Claro', category: 'azul', hex: '#ADD8E6' },
  { id: 'color_azul', name: 'Azul', category: 'azul', hex: '#0000FF' },
  { id: 'color_azul_escuro', name: 'Azul Escuro', category: 'azul', hex: '#00008B' },

  // 6. Roxo / Violeta
  { id: 'color_lavanda', name: 'Lavanda', category: 'roxo', hex: '#E6E6FA' },
  { id: 'color_lilas', name: 'Lilás', category: 'roxo', hex: '#C8A2C8' },
  { id: 'color_roxo_claro', name: 'Roxo Claro', category: 'roxo', hex: '#9B59B6' },
  { id: 'color_roxo', name: 'Roxo', category: 'roxo', hex: '#800080' },
  { id: 'color_violeta_escuro', name: 'Violeta Escuro', category: 'roxo', hex: '#4B0082' },

  // 7. Rosa
  { id: 'color_rosa_pastel', name: 'Rosa Pastel', category: 'rosa', hex: '#FFD1DC' },
  { id: 'color_rosa_claro', name: 'Rosa Claro', category: 'rosa', hex: '#FFB6C1' },
  { id: 'color_rosa', name: 'Rosa', category: 'rosa', hex: '#FF69B4' },
  { id: 'color_rosa_choque', name: 'Rosa Choque', category: 'rosa', hex: '#FF1493' },
  { id: 'color_rosa_escuro', name: 'Rosa Escuro', category: 'rosa', hex: '#C71585' },
  { id: 'color_magenta', name: 'Magenta', category: 'rosa', hex: '#FF00FF' },

  // 8. Neon
  { id: 'color_vermelho_neon', name: 'Vermelho Neon', category: 'neon', hex: '#FF0033' },
  { id: 'color_laranja_neon', name: 'Laranja Neon', category: 'neon', hex: '#FF6600' },
  { id: 'color_amarelo_neon', name: 'Amarelo Neon', category: 'neon', hex: '#CCFF00' },
  { id: 'color_verde_neon', name: 'Verde Neon', category: 'neon', hex: '#39FF14' },
  { id: 'color_ciano_neon', name: 'Ciano Neon', category: 'neon', hex: '#00FFFF' },
  { id: 'color_azul_neon', name: 'Azul Neon', category: 'neon', hex: '#1F51FF' },
  { id: 'color_roxo_neon', name: 'Roxo Neon', category: 'neon', hex: '#BC13FE' },
  { id: 'color_rosa_neon', name: 'Rosa Neon', category: 'neon', hex: '#FF10F0' },

  // 9. Neutras Frias
  { 
    id: 'color_preto', 
    name: 'Preto', 
    category: 'neutras_frias', 
    hex: '#050505', 
    discordNote: 'Ajustado de #000000 puro para #050505 para evitar que o cliente do Discord resete a cor do nome para transparente/padrão.' 
  },
  { id: 'color_carvao', name: 'Carvão', category: 'neutras_frias', hex: '#1C1C1C' },
  { id: 'color_grafite', name: 'Grafite', category: 'neutras_frias', hex: '#2D2D2D' },
  { id: 'color_cinza_escuro', name: 'Cinza Escuro', category: 'neutras_frias', hex: '#4A4A4A' },
  { id: 'color_cinza', name: 'Cinza', category: 'neutras_frias', hex: '#808080' },
  { id: 'color_cinza_claro', name: 'Cinza Claro', category: 'neutras_frias', hex: '#B0B0B0' },
  { id: 'color_prata', name: 'Prata', category: 'neutras_frias', hex: '#C0C0C0' },
  { id: 'color_fumaca', name: 'Fumaça', category: 'neutras_frias', hex: '#D3D3D3' },
  { id: 'color_off_white', name: 'Off-White', category: 'neutras_frias', hex: '#F5F5F5' },
  { id: 'color_branco', name: 'Branco', category: 'neutras_frias', hex: '#FFFFFF' },

  // 10. Neutras Quentes
  { id: 'color_marrom_escuro', name: 'Marrom Escuro', category: 'neutras_quentes', hex: '#3E1C00' },
  { id: 'color_marrom', name: 'Marrom', category: 'neutras_quentes', hex: '#7B3F00' },
  { id: 'color_marrom_claro', name: 'Marrom Claro', category: 'neutras_quentes', hex: '#A0522D' },
  { id: 'color_caramelo', name: 'Caramelo', category: 'neutras_quentes', hex: '#C68642' },
  { id: 'color_bege', name: 'Bege', category: 'neutras_quentes', hex: '#F5DEB3' },
  { id: 'color_areia', name: 'Areia', category: 'neutras_quentes', hex: '#E8D5A3' },
];
