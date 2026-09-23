import { SlashCommandSubcommandBuilder } from 'discord.js';
import { isEmojiSourceRef, type EmojiImportRequest } from '#bot/application/emojis/importEmoji.js';
import {
  EmojiImportError,
  emojiError,
  type EmojiAttachment,
  type EmojiDestination,
  type EmojiSource,
} from '#bot/application/emojis/types.js';
import { log } from '#bot/infrastructure/logger.js';
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
      await context.reply(notAvailableMessage);
      return;
    }

    let request: EmojiImportRequest;
    try {
      request = { ...parseEmojiAddInputs(context), destination: destinationOf(target, context) };
    } catch (error: unknown) {
      // Entrada inválida não é incidente operacional: só o autor vê a razão.
      if (!(error instanceof EmojiImportError)) throw error;
      await context.reply(error.message);
      return;
    }

    try {
      const { created } = await service.importEmoji(request);
      await context.reply(successMessage(target, created.name));
    } catch (error: unknown) {
      if (!(error instanceof EmojiImportError)) throw error;
      log('warn', 'emoji_import_failed', { destination: target, code: error.code });
      await context.reply(error.message);
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
function destinationOf(target: EmojiAddTarget, context: CommandContext): EmojiDestination {
  if (target === 'application') return { kind: 'application' };
  const guildId = context.guildId;
  if (guildId === undefined) throw emojiError('invalid_input', noGuildMessage);
  return { kind: 'guild', guildId };
}

function successMessage(target: EmojiAddTarget, name: string): string {
  return target === 'application'
    ? `Emoji **${name}** adicionado aos Application Emojis do bot.`
    : `Emoji **${name}** adicionado a este servidor.`;
}
