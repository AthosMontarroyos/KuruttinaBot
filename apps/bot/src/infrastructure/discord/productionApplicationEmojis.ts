import { REST, Routes } from 'discord.js';
import {
  EMOJI_NAME_PATTERN,
  EmojiImportError,
  emojiError,
  type CreatedEmoji,
  type PreparedEmojiImage,
} from '#bot/application/emojis/types.js';
import type { BotCredential } from '#bot/config.js';
import { log } from '#bot/infrastructure/logger.js';
import { verifyBotIdentity } from './identity.js';

const SNOWFLAKE = /^[1-9]\d{16,19}$/u;
const CAPACITY_ERROR_CODES: ReadonlySet<number> = new Set([30008, 30018, 30056]);

/** Consulta e criação de Application Emojis restritas à aplicação de produção. */
export interface ProductionApplicationEmojiPort {
  count(): Promise<number>;
  create(name: string, image: PreparedEmojiImage, audit?: ProductionEmojiAudit): Promise<CreatedEmoji>;
}

/** Identidade de quem executou o comando. Campos inválidos são omitidos do log. */
export interface ProductionEmojiAudit {
  readonly userId?: string | undefined;
  readonly guildId?: string | undefined;
}

export interface DiscordApplicationEmojiRest {
  get(route: `/${string}`): Promise<unknown>;
  post(route: `/${string}`, options: { readonly body: unknown }): Promise<unknown>;
}

export interface ProductionApplicationEmojiDeps {
  readonly rest?: DiscordApplicationEmojiRest | undefined;
  readonly verifyIdentity?: ((token: string, expectedBotId: string) => Promise<string>) | undefined;
}

/**
 * Capability estreita: usa somente a credencial de produção, por REST, e nunca
 * abre Gateway. A identidade é confirmada na primeira operação e reaproveitada
 * só depois de sucesso; falha não fica em cache.
 */
export function createProductionApplicationEmojiWriter(
  credential: BotCredential,
  deps: ProductionApplicationEmojiDeps = {},
): ProductionApplicationEmojiPort {
  const rest = deps.rest ?? createRest(credential.token);
  const verifyIdentity = deps.verifyIdentity ?? verifyBotIdentity;
  let verified: Promise<string> | undefined;

  function applicationId(): Promise<string> {
    if (verified === undefined) {
      const pending = confirmIdentity(credential, verifyIdentity);
      verified = pending;
      void pending.catch(() => {
        if (verified === pending) verified = undefined;
      });
    }
    return verified;
  }

  return {
    async count(): Promise<number> {
      try {
        const id = await applicationId();
        const body = await rest.get(Routes.applicationEmojis(id));
        if (!isEmojiList(body)) {
          throw emojiError('destination_unavailable', 'Não foi possível consultar os Application Emojis do bot de produção.');
        }
        return body.items.length;
      } catch (error: unknown) {
        if (error instanceof EmojiImportError) throw error;
        throw emojiError('destination_unavailable', 'Não foi possível consultar os Application Emojis do bot de produção.');
      }
    },

    async create(name, image, audit): Promise<CreatedEmoji> {
      try {
        const id = await applicationId();
        const body = await rest.post(Routes.applicationEmojis(id), {
          body: { name, image: toDataUri(image) },
        });
        const created = readCreated(body, name);
        log('info', 'production_application_emoji_created', auditFields(id, created, audit));
        return created;
      } catch (error: unknown) {
        throw mapWriteFailure(error);
      }
    },
  };
}

function createRest(token: string): DiscordApplicationEmojiRest {
  return new REST({ version: '10' }).setToken(token);
}

async function confirmIdentity(
  credential: BotCredential,
  verifyIdentity: (token: string, expectedBotId: string) => Promise<string>,
): Promise<string> {
  let resolved: string;
  try {
    resolved = await verifyIdentity(credential.token, credential.expectedBotId);
  } catch {
    log('warn', 'production_application_identity_rejected', { applicationId: credential.expectedBotId });
    throw emojiError('destination_unavailable', 'Não foi possível confirmar a identidade do bot de produção.');
  }
  if (resolved !== credential.expectedBotId) {
    log('warn', 'production_application_identity_rejected', { applicationId: credential.expectedBotId });
    throw emojiError('destination_unavailable', 'Não foi possível confirmar a identidade do bot de produção.');
  }
  return resolved;
}

function toDataUri(image: PreparedEmojiImage): string {
  return `data:${image.contentType};base64,${Buffer.from(image.bytes).toString('base64')}`;
}

function isEmojiList(body: unknown): body is { readonly items: readonly unknown[] } {
  return typeof body === 'object' && body !== null && 'items' in body && Array.isArray(body.items);
}

function readCreated(body: unknown, fallbackName: string): CreatedEmoji {
  if (
    typeof body !== 'object' ||
    body === null ||
    !('id' in body) ||
    typeof body.id !== 'string' ||
    !SNOWFLAKE.test(body.id)
  ) {
    throw emojiError('create_failed', 'O Discord recusou a criação do emoji.');
  }
  const name = 'name' in body && typeof body.name === 'string' && EMOJI_NAME_PATTERN.test(body.name)
    ? body.name
    : fallbackName;
  return { id: body.id, name };
}

function auditFields(
  applicationId: string,
  created: CreatedEmoji,
  audit: ProductionEmojiAudit | undefined,
): Record<string, string> {
  const fields: Record<string, string> = {
    applicationId,
    emojiId: created.id,
    emojiName: created.name,
  };
  const userId = snowflake(audit?.userId);
  const guildId = snowflake(audit?.guildId);
  if (userId !== undefined) fields.userId = userId;
  if (guildId !== undefined) fields.guildId = guildId;
  return fields;
}

function snowflake(value: string | undefined): string | undefined {
  return value !== undefined && SNOWFLAKE.test(value) ? value : undefined;
}

function mapWriteFailure(error: unknown): EmojiImportError {
  if (error instanceof EmojiImportError) return error;
  const code = numericCode(error);
  if (code !== undefined && CAPACITY_ERROR_CODES.has(code)) {
    return emojiError('capacity_reached', 'O bot principal atingiu o limite de Application Emojis.');
  }
  const status = httpStatus(error);
  if (status === 401 || status === 403) {
    return emojiError('destination_unavailable', 'O bot de produção não autorizou a criação do emoji.');
  }
  return emojiError('create_failed', 'O Discord recusou a criação do emoji.');
}

function numericCode(error: unknown): number | undefined {
  if (typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'number') return error.code;
  return undefined;
}

function httpStatus(error: unknown): number | undefined {
  if (typeof error === 'object' && error !== null && 'status' in error && typeof error.status === 'number') return error.status;
  return undefined;
}
