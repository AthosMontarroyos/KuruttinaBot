import type { Client, Guild } from 'discord.js';
import {
  EmojiImportError,
  emojiError,
  type CreatedEmoji,
  type EmojiCreationPort,
  type EmojiDestination,
  type PreparedEmojiImage,
} from '#bot/application/emojis/types.js';

/**
 * Códigos REST do Discord para destino sem capacidade
 * (`RESTJSONErrorCodes`): emojis normais, animados e premium.
 */
const CAPACITY_ERROR_CODES: ReadonlySet<number> = new Set([30008, 30018, 30056]);

/**
 * Converte a imagem preparada em data URI com o MIME correto, para o Discord
 * reconhecer GIF animado (o `resolveImage` do discord.js usaria `image/jpg`
 * para Buffer).
 */
function toDataUri(image: PreparedEmojiImage): string {
  return `data:${image.contentType};base64,${Buffer.from(image.bytes).toString('base64')}`;
}

function mapCreateFailure(error: unknown): EmojiImportError {
  if (error instanceof EmojiImportError) return error;
  if (typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'number') {
    if (CAPACITY_ERROR_CODES.has(error.code)) {
      return emojiError('capacity_reached', 'O destino atingiu o limite de emojis do Discord.');
    }
  }
  return emojiError('create_failed', 'O Discord recusou a criação do emoji.');
}

export function createDiscordEmojiAdapter(client: Client): EmojiCreationPort {
  return {
    async countApplicationEmojis(): Promise<number> {
      const application = client.application;
      if (!application) {
        throw emojiError('destination_unavailable', 'A aplicação do bot ainda não está disponível.');
      }
      try {
        const emojis = await application.emojis.fetch();
        return emojis.size;
      } catch {
        throw emojiError('destination_unavailable', 'Não foi possível consultar os Application Emojis.');
      }
    },

    async create(
      destination: EmojiDestination,
      name: string,
      image: PreparedEmojiImage,
    ): Promise<CreatedEmoji> {
      const attachment = toDataUri(image);
      if (destination.kind === 'application') {
        const application = client.application;
        if (!application) {
          throw emojiError('destination_unavailable', 'A aplicação do bot ainda não está disponível.');
        }
        try {
          const created = await application.emojis.create({ attachment, name });
          return { id: created.id, name: created.name ?? name };
        } catch (error: unknown) {
          throw mapCreateFailure(error);
        }
      }

      let guild: Guild;
      try {
        // Cache miss não prova inexistência: sempre busca no Discord.
        guild = await client.guilds.fetch(destination.guildId);
      } catch {
        throw emojiError('destination_unavailable', 'O bot não encontrou o servidor de destino.');
      }
      try {
        const created = await guild.emojis.create({ attachment, name });
        return { id: created.id, name: created.name };
      } catch (error: unknown) {
        throw mapCreateFailure(error);
      }
    },
  };
}
