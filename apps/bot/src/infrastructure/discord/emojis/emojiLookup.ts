import type { Client } from 'discord.js';
import type { EmojiInfoLookup, EmojiInfoPort } from '#bot/command-system/types.js';
import { log } from '#bot/infrastructure/logging/logger.js';

/** RESTJSONErrorCodes.UnknownEmoji. Ausência neste código não prova exclusão. */
const UNKNOWN_EMOJI = 10014;

function errorCode(error: unknown): number | undefined {
  if (typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'number') {
    return error.code;
  }
  return undefined;
}

function logLookupFailure(error: unknown): void {
  const code = errorCode(error);
  log('warn', 'emoji_lookup_failed', {
    errorName: error instanceof Error ? error.name : 'UnknownError',
    ...(code === undefined ? {} : { errorCode: code }),
  });
}

async function readGuildEmoji(client: Client, guildId: string, emojiId: string): Promise<EmojiInfoLookup> {
  try {
    const guild = await client.guilds.fetch(guildId);
    const emoji = await guild.emojis.fetch(emojiId, { force: true });
    return {
      status: 'confirmed',
      name: typeof emoji.name === 'string' && emoji.name !== '' ? emoji.name : null,
      animated: typeof emoji.animated === 'boolean' ? emoji.animated : null,
      guildName: guild.name,
    };
  } catch (error: unknown) {
    if (errorCode(error) === UNKNOWN_EMOJI) return { status: 'unconfirmed' };
    logLookupFailure(error);
    return { status: 'unavailable' };
  }
}

/**
 * Confirma o emoji por REST na guilda atual. Se o Discord não o encontrar,
 * o cache existente só sugere outra guilda, confirmada por um único REST.
 * Não percorre os servidores do bot.
 */
export function createEmojiLookup(client: Client): EmojiInfoPort {
  return {
    async lookup(currentGuildId, emojiId) {
      const current = await readGuildEmoji(client, currentGuildId, emojiId);
      if (current.status !== 'unconfirmed') return current;

      const originGuildId = client.emojis.cache.get(emojiId)?.guild.id;
      if (originGuildId === undefined || originGuildId === currentGuildId) return { status: 'unconfirmed' };

      const origin = await readGuildEmoji(client, originGuildId, emojiId);
      return origin.status === 'confirmed' ? origin : origin.status === 'unavailable' ? origin : { status: 'unconfirmed' };
    },
  };
}
