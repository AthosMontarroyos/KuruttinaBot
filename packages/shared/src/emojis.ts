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
  OK: '👌',

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
  SHRUG: '🤷',
  FACEPALM: '🤦',
  COFFEE: '☕',

  // 3. Command Categories
  MODERATION: '🛡️',
  UTILITY: '🧰',
  DEVELOPER: '⚙️',
  ADMIN: '👑',
  FUN: '🎉',
  AFFILIATE: '💎',
  STAFF: '👮',

  // 4. Actions & Moderation
  BAN: '🔨',
  KICK: '🥾',
  MUTE: '🔇',
  UNMUTE: '🔊',
  CLEAR: '🧹',
  SEARCH: '🔍',
  ADD: '➕',
  TRASH: '🗑️',
  SHARE: '📢',
  SHARE_SCREEN: '🖥️',

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
  LEFT_ARROW: '⬅️',
  RIGHT_ARROW: '➡️',
  PIN: '📌',
  IDEA: '💡',
  LINE: '➖',
  DIVIDER: '🌸',

  // 7. Navigation & Branding
  LINK: '🔗',
  DOCUMENTATION: '📚',
  BOOK: '📖',
  STACK_OF_BOOKS: '📚',
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
    keys: ['SUCCESS', 'ERROR', 'WARNING', 'INFO', 'LOADING', 'VERIFIED', 'DISMISS', 'OK'],
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
      'SHRUG',
      'FACEPALM',
      'COFFEE',
    ],
  },
  {
    name: 'Command Categories',
    keys: ['MODERATION', 'UTILITY', 'DEVELOPER', 'ADMIN', 'FUN', 'AFFILIATE', 'STAFF'],
  },
  {
    name: 'Actions & Moderation',
    keys: ['BAN', 'KICK', 'MUTE', 'UNMUTE', 'CLEAR', 'SEARCH', 'ADD', 'TRASH', 'SHARE', 'SHARE_SCREEN'],
  },
  {
    name: 'System & Security',
    keys: ['SHIELD', 'LOCK', 'UNLOCK', 'SETTINGS', 'LOGS', 'USER', 'GUILD', 'CROWN'],
  },
  {
    name: 'UI & Layout Decorations',
    keys: [
      'FOLDER',
      'DIAMOND_BLUE',
      'DIAMOND_LARGE',
      'BULLET',
      'HOME',
      'PREV',
      'NEXT',
      'LEFT_ARROW',
      'RIGHT_ARROW',
      'PIN',
      'IDEA',
      'LINE',
      'DIVIDER',
    ],
  },
  {
    name: 'Navigation & Branding',
    keys: ['LINK', 'DOCUMENTATION', 'BOOK', 'STACK_OF_BOOKS', 'STAR'],
  },
];
