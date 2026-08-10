/**
 * Clean Black & White Color Palette for Kuruttina Discord Embeds and Web Dashboard.
 * Enforces strictly Black (#000000 / 0x000001) or White (#FFFFFF / 0xFFFFFF) minimalist themes.
 */
export interface StatusColorDefinition {
  hex: string;
  number: number;
  description: string;
}

export const EMBED_COLORS = {
  BLACK: {
    hex: '#000000',
    number: 0x000001, // 0x000001 displays solid black border in Discord
    description: 'Minimalist Black Theme',
  },
  WHITE: {
    hex: '#FFFFFF',
    number: 0xFFFFFF,
    description: 'Minimalist White Theme',
  },
} as const;

export const STATUS_COLORS = {
  SUCCESS: EMBED_COLORS.BLACK,
  WARNING: EMBED_COLORS.BLACK,
  ERROR: EMBED_COLORS.BLACK,
  INFO: EMBED_COLORS.BLACK,
  NEUTRAL: EMBED_COLORS.BLACK,
  BLACK: EMBED_COLORS.BLACK,
  WHITE: EMBED_COLORS.WHITE,
} as const;
