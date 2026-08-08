import { Client } from 'discord.js';
import { EMOJIS, EmojiKey } from '@kuruttina/shared';

/**
 * Resolves an emoji by key from central EMOJIS map OR dynamically fetches
 * custom Application Emojis uploaded to Discord Developer Portal.
 */
export async function getEmoji(client: Client, key: EmojiKey): Promise<string> {
  const defaultEmoji = EMOJIS[key];

  try {
    if (client.application) {
      // Fetch or use cached Application Emojis from Discord Developer Portal
      const cached = client.application.emojis.cache.find(
        (e) => e.name?.toLowerCase() === key.toLowerCase()
      );

      if (cached) {
        return cached.toString(); // Returns <a:name:id> or <:name:id>
      }

      // If not in cache, fetch from API
      const appEmojis = await client.application.emojis.fetch();
      const matched = appEmojis.find(
        (e) => e.name?.toLowerCase() === key.toLowerCase()
      );

      if (matched) {
        return matched.toString();
      }
    }
  } catch {
    // Fallback gracefully to default Unicode emoji if app emojis fetch fails
  }

  return defaultEmoji;
}
