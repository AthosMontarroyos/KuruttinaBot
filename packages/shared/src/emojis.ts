/**
 * Mapeamento Centralizado de Emojis da Kuruttina.
 * Suporta a substituição por Emojis Personalizados da aplicação no Discord Developer Portal (<:nome:id>).
 */
export const EMOJIS = {
  // Status & Respostas
  SUCCESS: '✅',
  ERROR: '❌',
  WARNING: '⚠️',
  INFO: 'ℹ️',
  PING: '🏓',

  // Redes & Telemetria
  GATEWAY: '🌐',
  API: '⚡',
  STATUS: '🤖',

  // Moderação & Sistema
  SHIELD: '🛡️',
  LOCK: '🔒',
  UNLOCK: '🔓',
  BAN: '🔨',
  KICK: '🥾',
  MUTE: '🔇',
  SETTINGS: '⚙️',
  LOGS: '📜',
  USER: '👤',
  GUILD: '🏰',

  // Navegação & Links
  LINK: '🔗',
  DOCUMENTATION: '📚',
  STAR: '⭐',
} as const;

export type EmojiKey = keyof typeof EMOJIS;
