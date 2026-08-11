import fs from 'fs';
import path from 'path';
import { Client } from 'discord.js';
import { EMOJIS, EmojiKey } from '@kuruttina/shared';

const CATALOG_PATH = path.resolve(__dirname, '../../../../Pictures/emojis/KuruttinaBotEmojis/catalog.json');

interface CatalogEntry {
  name: string;
  id: string;
  format: string;
  animated: boolean;
}

interface CatalogFile {
  emojis: Record<string, CatalogEntry>;
}

let cachedCatalog: Record<string, CatalogEntry> | null = null;
let lastCatalogMtime = 0;

/**
 * Loads or refreshes catalog.json in memory.
 */
function getCatalogEmojis(): Record<string, CatalogEntry> | null {
  try {
    if (fs.existsSync(CATALOG_PATH)) {
      const stats = fs.statSync(CATALOG_PATH);
      if (!cachedCatalog || stats.mtimeMs > lastCatalogMtime) {
        const content = fs.readFileSync(CATALOG_PATH, 'utf8');
        const parsed: CatalogFile = JSON.parse(content);
        cachedCatalog = parsed.emojis || {};
        lastCatalogMtime = stats.mtimeMs;
      }
      return cachedCatalog;
    }
  } catch {
    // Fallback if catalog unreadable
  }
  return cachedCatalog;
}

/**
 * Common alias mappings for Application Emojis uploaded to Discord Developer Portal.
 */
const EMOJI_ALIASES: Record<string, string[]> = {
  SUCCESS: ['success', 'sucess', 'verified', 'ok', 'yes'],
  CLEAR: ['clear', 'cleaning', 'trash'],
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
  DICE: ['dice'],
  DICE_ROLL: ['diceroll', 'dice'],
  DICE_ANIMATED: ['dicerooling', 'diceroll', 'dice'],
  SERVER_BOOST: ['server_boost', 'boost', 'nitro'],
  BOOST: ['server_boost', 'boost', 'nitro'],
  TAKING_PHOTO: ['taking_photo', 'photo'],
  PHOTO: ['photo', 'taking_photo'],
};

/**
 * Resolves an emoji by key from central EMOJIS map OR dynamically fetches
 * custom Application Emojis uploaded to Discord Developer Portal across ALL linked App Vaults.
 */
export async function getEmoji(client: Client, key: EmojiKey | string): Promise<string> {
  const normalizedKey = key.toString().toUpperCase();
  const defaultEmoji = (EMOJIS as any)[normalizedKey] || '✨';

  // 1. Try resolving from multi-app catalog.json
  const catalog = getCatalogEmojis();
  if (catalog) {
    const candidateNames = EMOJI_ALIASES[normalizedKey]
      ? EMOJI_ALIASES[normalizedKey]
      : [
          key.toString().toLowerCase(),
          key.toString().toLowerCase().replace(/_/g, ''),
        ];

    for (const candidate of candidateNames) {
      if (catalog[candidate]) {
        return catalog[candidate].format;
      }
    }
  }

  // 2. Fallback to live primary client application cache
  try {
    if (client?.application) {
      const candidateNames = EMOJI_ALIASES[normalizedKey]
        ? EMOJI_ALIASES[normalizedKey]
        : [key.toString().toLowerCase()];

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
    // Fallback gracefully to default Unicode emoji
  }

  return defaultEmoji;
}

/**
 * Resolves multiple emojis concurrently by key, returning a Record mapping each key to its resolved emoji string.
 * Reduces 10+ sequential await getEmoji(...) lines into a single destructurable call.
 */
export async function getEmojis<K extends string>(
  client: Client,
  keys: readonly K[]
): Promise<Record<K, string>> {
  const entries = await Promise.all(
    keys.map(async (key) => [key, await getEmoji(client, key)] as const)
  );
  return Object.fromEntries(entries) as Record<K, string>;
}

