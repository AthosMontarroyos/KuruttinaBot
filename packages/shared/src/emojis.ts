/**
 * Centralized Emoji Mapping & Category Architecture for Kuruttina.
 * Supports dynamic resolution to Discord Developer Portal Application Emojis (<:name:id> / <a:name:id>).
 */
export const EMOJIS = {
  // 1. Status & Responses
  SUCCESS: '✅',
  ERROR: '❌',
  WARNING: '⚠️',
  INFO: 'ℹ️',
  LOADING: '⏳',
  OPS: '🙈',

  // 2. Command Categories
  MODERATION: '🛡️',
  UTILITY: '🧰',
  DEVELOPER: '⚙️',
  ADMIN: '👑',
  FUN: '🎉',
  AFFILIATE: '💎',
  DANCING: '💃',

  // 3. Moderation & Actions
  BAN: '🔨',
  KICK: '🥾',
  MUTE: '🔇',
  UNMUTE: '🔊',
  CLEAR: '🧹',
  SEARCH: '🔍',
  ADD: '➕',
  TRASH: '🗑️',

  // 4. Telemetry & Infrastructure
  PING: '🏓',
  GATEWAY: '🌐',
  API: '⚡',
  BOT_STATUS: '🤖',
  UPTIME: '🕒',

  // 5. System & Security
  SHIELD: '🛡️',
  LOCK: '🔒',
  UNLOCK: '🔓',
  SETTINGS: '⚙️',
  LOGS: '📜',
  USER: '👤',
  GUILD: '🏰',
  CROWN: '👑',

  // 6. Navigation & Branding
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
    keys: ['SUCCESS', 'ERROR', 'WARNING', 'INFO', 'LOADING', 'OPS'],
  },
  {
    name: 'Categorias & Animações Interativas',
    keys: ['MODERATION', 'UTILITY', 'DEVELOPER', 'ADMIN', 'FUN', 'AFFILIATE', 'DANCING'],
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
