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

  // 2. Expressions & INFJ Persona
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
  PHOTO: '🖼️',
  SHOOTING: '💫',
  POINTUP: '☝️',
  INSPIRED: '💡',
  WAIT: '⏳',
  READING: '📖',

  // 3. Command Categories
  MODERATION: '🛡️',
  UTILITY: '🧰',
  DEVELOPER: '⚙️',
  ADMIN: '👑',
  FUN: '🎉',
  AFFILIATE: '💎',

  // 4. Actions & Moderation
  BAN: '🔨',
  KICK: '🥾',
  MUTE: '🔇',
  UNMUTE: '🔊',
  CLEAR: '🧹',
  SEARCH: '🔍',
  ADD: '➕',
  TRASH: '🗑️',

  // 5. System & Security
  SHIELD: '🛡️',
  LOCK: '🔒',
  UNLOCK: '🔓',
  SETTINGS: '⚙️',
  LOGS: '📜',
  USER: '👤',
  GUILD: '🏰',
  CROWN: '👑',

  // 6. UI & Layout Decorations
  FOLDER: '📂',
  DIAMOND_BLUE: '🔹',
  DIAMOND_LARGE: '🔷',
  BULLET: '•',
  HOME: '🏠',
  PREV: '◀',
  NEXT: '▶',
  PIN: '📌',
  IDEA: '💡',

  // 7. Navigation & Branding
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
    keys: [
      'OPS',
      'DANCING',
      'KISS',
      'CRY',
      'THINKING',
      'APPEAR',
      'HEHE',
      'ANGER',
      'CLEANING',
      'THUMBUP',
      'PHOTO',
      'SHOOTING',
      'POINTUP',
      'INSPIRED',
      'WAIT',
      'READING',
    ],
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
    name: 'System & Security',
    keys: ['SHIELD', 'LOCK', 'UNLOCK', 'SETTINGS', 'LOGS', 'USER', 'GUILD', 'CROWN'],
  },
  {
    name: 'UI & Layout Decorations',
    keys: ['FOLDER', 'DIAMOND_BLUE', 'DIAMOND_LARGE', 'BULLET', 'HOME', 'PREV', 'NEXT', 'PIN', 'IDEA'],
  },
  {
    name: 'Navigation & Branding',
    keys: ['LINK', 'DOCUMENTATION', 'STAR'],
  },
];
