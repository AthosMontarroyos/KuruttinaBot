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
  VERIFIED: '☑️',
  DISMISS: '🚫',

  // Expressions & INFJ Persona
  OPS: '😳',
  DANCING: '💃',
  KISS: '😘',
  CRY: '😭',
  THINKING: '🤔',
  APPEAR: '✨',
  HEHE: '😏',
  ANGER: '💢',
  CLEANING: '🧹',
  THUMBUP: '👍',

  // 2. Command Categories
  MODERATION: '🛡️',
  UTILITY: '🧰',
  DEVELOPER: '⚙️',
  ADMIN: '👑',
  FUN: '🎉',
  AFFILIATE: '💎',

  // 3. Actions & Moderation
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
    name: 'Status & Responses',
    keys: ['SUCCESS', 'ERROR', 'WARNING', 'INFO', 'LOADING', 'VERIFIED', 'DISMISS'],
  },
  {
    name: 'Expressions & INFJ Persona',
    keys: ['OPS', 'DANCING', 'KISS', 'CRY', 'THINKING', 'APPEAR', 'HEHE', 'ANGER', 'CLEANING', 'THUMBUP'],
  },
  {
    name: 'Command Categories',
    keys: ['MODERATION', 'UTILITY', 'DEVELOPER', 'ADMIN', 'FUN', 'AFFILIATE'],
  },
  {
    name: 'Actions & Moderation',
    keys: ['BAN', 'KICK', 'MUTE', 'UNMUTE', 'CLEAR', 'SEARCH', 'ADD', 'TRASH'],
  },
  {
    name: 'Telemetry & Infrastructure',
    keys: ['PING', 'GATEWAY', 'API', 'BOT_STATUS', 'UPTIME'],
  },
  {
    name: 'System & Security',
    keys: ['SHIELD', 'LOCK', 'UNLOCK', 'SETTINGS', 'LOGS', 'USER', 'GUILD', 'CROWN'],
  },
  {
    name: 'Navigation & Branding',
    keys: ['LINK', 'DOCUMENTATION', 'STAR'],
  },
];
