import { Client } from 'discord.js';
import { EMOJIS, EmojiKey } from '@kuruttina/shared';

/**
 * Common alias mappings for Application Emojis uploaded to Discord Developer Portal.
 */
const EMOJI_ALIASES: Record<string, string[]> = {
  SUCCESS: ['success', 'sucess', 'verified', 'ok'],
  CLEAR: ['clear', 'cleaning'],
  ERROR: ['error', 'dismiss', 'anger'],
  THUMBUP: ['thumbup', 'thumbsup', 'like', 'thumb'],
  LOCK: ['lock'],
  UNLOCK: ['unlock'],
  FOLDER: ['folder'],
  DIAMOND_BLUE: ['diamond_blue', 'diamond', 'blue_diamond'],
  IDEA: ['idea', 'inspired'],
  INSPIRED: ['inspired', 'idea'],
  PREV: ['prev', 'left_arrow'],
  NEXT: ['next', 'right_arrow'],
  LEFT_ARROW: ['left_arrow', 'prev'],
  RIGHT_ARROW: ['right_arrow', 'next'],
  DOCUMENTATION: ['documentation', 'stackofbooks', 'book'],
  STACK_OF_BOOKS: ['stackofbooks', 'documentation', 'book'],
  BOOK: ['book', 'documentation'],
  SHRUG: ['shrug'],
  FACEPALM: ['facepalm'],
  ANGER: ['anger'],
  AFFILIATE: ['affiliate'],
  DIVIDER: ['pink_butterfly_divider', 'line'],
  LINE: ['line', 'pink_butterfly_divider'],
  SHOOTING: ['shooting', 'star'],
  STAR: ['star', 'shooting'],
};

/**
 * Resolves an emoji by key from central EMOJIS map OR dynamically fetches
 * custom Application Emojis uploaded to Discord Developer Portal.
 */
export async function getEmoji(client: Client, key: EmojiKey): Promise<string> {
  const defaultEmoji = EMOJIS[key];

  try {
    if (client.application) {
      const candidateNames = EMOJI_ALIASES[key]
        ? EMOJI_ALIASES[key]
        : [key.toLowerCase()];

      const appEmojis =
        client.application.emojis.cache.size > 0
          ? client.application.emojis.cache
          : await client.application.emojis.fetch();

      for (const candidateName of candidateNames) {
        const matched = appEmojis.find(
          (e) => e.name?.toLowerCase() === candidateName
        );
        if (matched) {
          return matched.toString();
        }
      }
    }
  } catch {
    // Fallback gracefully to default Unicode emoji if app emojis fetch fails
  }

  return defaultEmoji;
}
