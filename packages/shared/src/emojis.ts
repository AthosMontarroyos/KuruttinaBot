/**
 * Centralized Emoji Mapping & Category Architecture for Kuruttina.
 * Supports dynamic resolution to Discord Developer Portal Application Emojis (<:name:id> / <a:name:id>).
 */
export const EMOJIS = {
  // 1. Status & Respostas
  SUCCESS: '✅',
  ERROR: '❌',
  WARNING: '⚠️',
  INFO: 'ℹ️',
  LOADING: '⏳',
  
  // Expressões & Personalidade INFJ
  OPS: '😳', // Reação tímida / sarcástica / irônica da Kuruttina
  DANCING: '🥳', // Reação de comemoração / vitória / hype animado

  // 2. Categorias de Comandos
  MODERATION: '🛡️',
  UTILITY: '🧰',
  DEVELOPER: '⚙️',
  ADMIN: '👑',
  FUN: '🎉',
  AFFILIATE: '💎',

  // 3. Moderação & Ações
  BAN: '🔨',
  KICK: '🥾',
  MUTE: '🔇',
  UNMUTE: '🔊',
  CLEAR: '🧹',
  SEARCH: '🔍',
  ADD: '➕',
  TRASH: '🗑️',

  // 4. Telemetria & Infraestrutura
  PING: '🏓',
  GATEWAY: '🌐',
  API: '⚡',
  BOT_STATUS: '🤖',
  UPTIME: '🕒',

  // 5. Sistema & Segurança
  SHIELD: '🛡️',
  LOCK: '🔒',
  UNLOCK: '🔓',
  SETTINGS: '⚙️',
  LOGS: '📜',
  USER: '👤',
  GUILD: '🏰',
  CROWN: '👑',

  // 6. Navegação & Branding
  LINK: '🔗',
  DOCUMENTATION: '📚',
  STAR: '⭐',
} as const;

export type EmojiKey = keyof typeof EMOJIS;

export interface EmojiCategory {
  name: string;
  keys: EmojiKey[];
}

export const EMOJI_CATEGORIES: EmojiCategory[] = [
  {
    name: 'Status & Respostas',
    keys: ['SUCCESS', 'ERROR', 'WARNING', 'INFO', 'LOADING'],
  },
  {
    name: 'Expressões & Personalidade INFJ',
    keys: ['OPS', 'DANCING'],
  },
  {
    name: 'Categorias de Comandos',
    keys: ['MODERATION', 'UTILITY', 'DEVELOPER', 'ADMIN', 'FUN', 'AFFILIATE'],
  },
  {
    name: 'Ações & Moderação',
    keys: ['BAN', 'KICK', 'MUTE', 'UNMUTE', 'CLEAR', 'SEARCH', 'ADD', 'TRASH'],
  },
  {
    name: 'Telemetria & Infraestrutura',
    keys: ['PING', 'GATEWAY', 'API', 'BOT_STATUS', 'UPTIME'],
  },
  {
    name: 'Sistema & Segurança',
    keys: ['SHIELD', 'LOCK', 'UNLOCK', 'SETTINGS', 'LOGS', 'USER', 'GUILD', 'CROWN'],
  },
  {
    name: 'Navegação & Branding',
    keys: ['LINK', 'DOCUMENTATION', 'STAR'],
  },
];
