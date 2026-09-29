import { SlashCommandSubcommandBuilder } from 'discord.js';
import { isEmojiSourceRef, type EmojiImportRequest } from '#bot/application/emojis/importEmoji.js';
import {
  EmojiImportError,
  emojiError,
  type EmojiAttachment,
  type EmojiDestination,
  type EmojiImportErrorCode,
  type EmojiSource,
} from '#bot/application/emojis/types.js';
import { log } from '#bot/infrastructure/logger.js';
import { withEmojis } from './access.js';
import type { CommandContext } from './types.js';

/** Destination of one import operation; the executor resolves it from trusted context. */
export type EmojiAddTarget = 'application' | 'guild';

/** Declaração idêntica das três entradas nas duas operações de importação. */
export function addEmojiAddOptions(
  subcommand: SlashCommandSubcommandBuilder,
): SlashCommandSubcommandBuilder {
  return subcommand
    .addStringOption((option) =>
      option.setName('nome').setDescription('Nome do emoji, de 2 a 32 caracteres').setRequired(false),
    )
    .addAttachmentOption((option) =>
      option.setName('arquivo').setDescription('Imagem do emoji anexada à interação').setRequired(false),
    )
    .addStringOption((option) =>
      option.setName('emoji').setDescription('Emoji personalizado copiado de outro servidor').setRequired(false),
    );
}

interface EmojiAddInputs {
  readonly source: EmojiSource;
  readonly name?: string | undefined;
}

const noSourceMessage = 'Envie uma imagem anexada ou informe um emoji personalizado de outro servidor.';
const invalidInputMessage =
  'Entrada inválida: envie uma imagem anexada ou um emoji personalizado, com no máximo um nome opcional.';
const tooManyFilesMessage = 'Envie apenas uma imagem por comando.';
const notAvailableMessage = 'A importação de emojis não está disponível no momento.';
const noGuildMessage = 'Este comando só pode ser usado em um servidor.';

/** Seleção pelo código, sem comparar o texto. Cobre todos os valores de EmojiImportErrorCode. */
const importErrorEmoji = {
  missing_source: 'photo',
  empty_input: 'photo',
  unsupported_format: 'photo',
  invalid_name: 'label',
  invalid_source: 'warning',
  invalid_input: 'warning',
  input_too_large: 'warning',
  too_many_pixels: 'warning',
  too_many_frames: 'warning',
  duration_exceeded: 'warning',
  capacity_reached: 'warning',
  download_blocked: 'shield',
  source_missing: 'search',
  queue_full: 'coffee',
  destination_unavailable: 'ops',
  download_failed: 'error',
  corrupt_image: 'error',
  processing_timeout: 'error',
  size_unreachable: 'error',
  animation_lost: 'error',
  create_failed: 'error',
} as const satisfies Record<EmojiImportErrorCode, string>;

/**
 * Executor compartilhado das operações `dev emoji add` e `emoji add`.
 *
 * Slash e prefixo só diferem na leitura das entradas; autorização, fila,
 * limites e erros são resolvidos fora, pelo dispatcher e pelo núcleo.
 */
export function createEmojiAddExecutor(target: EmojiAddTarget): (context: CommandContext) => Promise<void> {
  return async (context: CommandContext): Promise<void> => {
    // Reconhece a interação antes de qualquer download ou processamento.
    await context.acknowledge();
    const service = context.emojiImport;
    if (service === undefined) {
      await replyWithEmoji(context, 'ops', notAvailableMessage);
      return;
    }

    let request: EmojiImportRequest;
    try {
      const inputs = parseEmojiAddInputs(context);
      const destination = destinationOf(target, context);
      if (destination === undefined) {
        await replyWithEmoji(context, 'guild', noGuildMessage);
        return;
      }
      request = { ...inputs, destination };
    } catch (error: unknown) {
      // Entrada inválida não é incidente operacional: só o autor vê a razão.
      if (!(error instanceof EmojiImportError)) throw error;
      await replyWithEmoji(context, importErrorEmoji[error.code], error.message);
      return;
    }

    try {
      const { created } = await service.importEmoji(request);
      await context.reply(await successMessage(context, target, created.name));
    } catch (error: unknown) {
      if (!(error instanceof EmojiImportError)) throw error;
      log('warn', 'emoji_import_failed', { destination: target, code: error.code });
      await replyWithEmoji(context, importErrorEmoji[error.code], error.message);
    }
  };
}

/** Lê as entradas do subcomando selecionado (slash) ou do texto após o prefixo. */
export function parseEmojiAddInputs(context: CommandContext): EmojiAddInputs {
  return context.options !== undefined ? parseSlashInputs(context) : parsePrefixInputs(context);
}

function parseSlashInputs(context: CommandContext): EmojiAddInputs {
  const name = optionValue(context, 'nome');
  const emojiRef = optionValue(context, 'emoji');
  const attachment = singleAttachment(context);
  // Arquivo tem prioridade sobre um emoji também informado.
  if (attachment !== undefined) return { source: attachmentSource(attachment), name };
  if (emojiRef !== undefined) return { source: { kind: 'guild-emoji', ref: emojiRef }, name };
  throw emojiError('missing_source', noSourceMessage);
}

function parsePrefixInputs(context: CommandContext): EmojiAddInputs {
  const tokens = (context.rawArgs ?? '').trim().split(/\s+/u).filter((token) => token !== '');
  if (tokens.length > 2) throw emojiError('invalid_input', invalidInputMessage);
  const attachment = singleAttachment(context);
  if (attachment !== undefined) {
    const names = tokens.filter((token) => !isEmojiSourceRef(token));
    if (names.length > 1) throw emojiError('invalid_input', invalidInputMessage);
    // Arquivo tem prioridade sobre um emoji também informado.
    return { source: attachmentSource(attachment), name: names[0] };
  }
  if (tokens.length === 0) throw emojiError('missing_source', noSourceMessage);

  const [ref, ...extraRefs] = tokens.filter(isEmojiSourceRef);
  const [name, ...extraNames] = tokens.filter((token) => !isEmojiSourceRef(token));
  if (ref === undefined) throw emojiError('missing_source', noSourceMessage);
  if (extraRefs.length > 0 || extraNames.length > 0) throw emojiError('invalid_input', invalidInputMessage);
  return { source: { kind: 'guild-emoji', ref }, name };
}

function singleAttachment(context: CommandContext): EmojiAttachment | undefined {
  const attachments = context.attachments ?? [];
  if (attachments.length > 1) throw emojiError('invalid_input', tooManyFilesMessage);
  return attachments[0];
}

function optionValue(context: CommandContext, optionName: string): string | undefined {
  const option = context.options?.find((candidate) => candidate.name === optionName);
  if (option === undefined || option.value === undefined) return undefined;
  if (typeof option.value !== 'string') throw emojiError('invalid_input', invalidInputMessage);
  return option.value;
}

function attachmentSource(attachment: EmojiAttachment): EmojiSource {
  return {
    kind: 'attachment',
    url: attachment.url,
    filename: attachment.name,
    size: attachment.size,
  };
}

/** O destino vem do contexto confiável da execução, nunca de argumentos do autor. */
function destinationOf(target: EmojiAddTarget, context: CommandContext): EmojiDestination | undefined {
  if (target === 'application') {
    return { kind: 'application', actorUserId: context.userId, guildId: context.guildId };
  }
  if (context.guildId === undefined) return undefined;
  return { kind: 'guild', guildId: context.guildId };
}

async function replyWithEmoji(context: CommandContext, emojiName: string, text: string): Promise<void> {
  await context.reply(withEmojis(await context.emoji(emojiName), text));
}

async function successMessage(context: CommandContext, target: EmojiAddTarget, name: string): Promise<string> {
  const [opening, closing] = await Promise.all([
    context.emoji(target === 'application' ? 'developer' : 'add'),
    context.emoji('sucess'),
  ]);
  const text = target === 'application'
    ? `Emoji **${name}** adicionado aos Application Emojis do bot de produção.`
    : `Emoji **${name}** adicionado a este servidor.`;
  return withEmojis(opening, text, closing);
}
