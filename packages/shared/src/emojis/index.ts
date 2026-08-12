import { EMOJI_CATEGORY_MAP } from './categories';

type ExtractKeys<T> = {
  [K in keyof T]: keyof T[K];
}[keyof T];

/**
 * All supported Emoji keys derived dynamically from category definitions.
 */
export type EmojiKey = ExtractKeys<typeof EMOJI_CATEGORY_MAP>;

const builtEmojis: Record<string, string> = {};
const categoryList: Array<{ name: string; keys: EmojiKey[] }> = [];

for (const [catName, emojiGroup] of Object.entries(EMOJI_CATEGORY_MAP)) {
  const catKeys: EmojiKey[] = [];
  for (const [key, fallback] of Object.entries(emojiGroup)) {
    builtEmojis[key] = fallback;
    catKeys.push(key as EmojiKey);
  }
  categoryList.push({ name: catName, keys: catKeys });
}

/**
 * Centralized Unicode Emergency Fallback Map (Derived DRY).
 */
export const EMOJIS: Record<EmojiKey, string> = builtEmojis as Record<EmojiKey, string>;

/**
 * Array of all valid Emoji keys.
 */
export const EMOJI_KEYS: EmojiKey[] = Object.keys(builtEmojis) as EmojiKey[];

export interface EmojiCategory {
  name: string;
  keys: EmojiKey[];
}

/**
 * Array of Emoji Categories with keys.
 */
export const EMOJI_CATEGORIES: EmojiCategory[] = categoryList;

export * from './categories';
