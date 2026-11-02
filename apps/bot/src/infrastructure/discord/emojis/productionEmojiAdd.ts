import { SlashCommandSubcommandBuilder } from 'discord.js';
import { emojiSourceId } from '#bot/application/emojis/importEmoji.js';
import { EMOJI_NAME_PATTERN, EmojiImportError, type EmojiAttachment } from '#bot/application/emojis/types.js';
import { withEmojis } from '#bot/command-system/responses.js';
import type { CommandContext } from '#bot/command-system/types.js';
import { normalizeDiscordCdnImageUrl } from '#bot/infrastructure/images/downloadDiscordImage.js';
import { log } from '#bot/infrastructure/logging/logger.js';
import { ProductionEmojiDispatchError } from '#bot/infrastructure/github/dispatchProductionEmoji.js';

const BARE_ID = /^\d{17,20}$/u;

const manualRedirect =
  'Eu não adiciono Application Emojis ao bot de produção por aqui. Use o workflow **Adicionar emoji de produção** no GitHub com o nome e a origem: um ID de emoji ou a URL HTTPS da imagem. A criação espera aprovação.';

const missingBoth =
  'Informe o nome do emoji e uma origem: um ID, uma marcação, uma URL HTTPS do CDN ou um anexo.';
const missingName = 'Informe o nome do emoji, de 2 a 32 caracteres.';
const missingSource = 'Envie um anexo ou informe um ID, uma marcação ou uma URL HTTPS do CDN.';
const invalidName = 'O nome precisa ter de 2 a 32 caracteres, entre A–Z, a–z, 0–9 ou _.';
const invalidOrigin = 'A origem precisa ser um ID, uma marcação <:nome:id> ou uma URL HTTPS do CDN.';
const invalidCombo = 'Informe um nome e uma só origem.';
const tooManyFiles = 'Envie apenas uma imagem por comando.';
const notAnImage = 'Envie uma imagem anexada.';
const dispatchFailed = 'Não consegui pedir a criação agora. Tente de novo daqui a pouco.';

/** Entrada recusada antes de qualquer chamada ao GitHub. `reaction` é o emoji da fala. */
export class ProductionEmojiInputError extends Error {
  constructor(readonly reaction: string, message: string) {
    super(message);
    this.name = 'ProductionEmojiInputError';
  }
}

export interface ProductionEmojiRequest {
  readonly name: string;
  readonly source: string;
}

/** Declara nome, origem (ID, marcação ou URL) e anexo. O nome é obrigatório no slash. */
export function addProductionEmojiOptions(
  subcommand: SlashCommandSubcommandBuilder,
): SlashCommandSubcommandBuilder {
  return subcommand
    .addStringOption((option) =>
      option.setName('nome').setDescription('Nome do emoji, de 2 a 32 caracteres').setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName('origem')
        .setDescription('ID, marcação <:nome:id> ou URL HTTPS do CDN')
        .setRequired(false),
    )
    .addAttachmentOption((option) =>
      option.setName('arquivo').setDescription('Imagem do emoji anexada à interação').setRequired(false),
    );
}

/**
 * Pede a criação no workflow e não cria o emoji aqui.
 * Sem a porta (token ausente), mantém a orientação manual.
 */
export function createProductionEmojiExecutor(): (context: CommandContext) => Promise<void> {
  return async (context) => {
    await context.acknowledge();
    const dispatch = context.productionEmojiDispatch;
    if (dispatch === undefined) {
      await context.reply(withEmojis(await context.emoji('book'), manualRedirect));
      return;
    }

    let request: ProductionEmojiRequest;
    try {
      request = parseProductionEmojiInputs(context);
    } catch (error: unknown) {
      if (!(error instanceof ProductionEmojiInputError)) throw error;
      await context.reply(withEmojis(await context.emoji(error.reaction), error.message));
      return;
    }

    try {
      const { runsUrl } = await dispatch.request(request);
      const [opening, waiting] = await Promise.all([
        context.emoji('developer'),
        context.emoji('loading'),
      ]);
      await context.reply(withEmojis(
        opening,
        `Pedi a criação do emoji **${request.name}**.`,
        waiting,
        `Ela espera aprovação: ${runsUrl}`,
      ));
    } catch (error: unknown) {
      const status = error instanceof ProductionEmojiDispatchError ? error.status : undefined;
      log('warn', 'production_emoji_dispatch_failed', { status: status ?? 'unavailable' });
      await context.reply(withEmojis(await context.emoji('ops'), dispatchFailed));
    }
  };
}

/** Lê slash ou prefixo e devolve `name` e `source` no formato do workflow. */
export function parseProductionEmojiInputs(context: CommandContext): ProductionEmojiRequest {
  return context.options !== undefined ? parseSlashInputs(context) : parsePrefixInputs(context);
}

function parseSlashInputs(context: CommandContext): ProductionEmojiRequest {
  const nameRaw = optionValue(context, 'nome');
  const originRaw = optionValue(context, 'origem');
  const attachment = singleAttachment(context);
  const hasOrigin = originRaw !== undefined && originRaw.trim() !== '';
  const hasAttachment = attachment !== undefined;
  if (hasOrigin && hasAttachment) throw new ProductionEmojiInputError('warning', invalidCombo);
  if (!hasOrigin && !hasAttachment) {
    throw new ProductionEmojiInputError('question', blank(nameRaw) ? missingBoth : missingSource);
  }
  if (blank(nameRaw)) throw new ProductionEmojiInputError('question', missingName);
  const name = workflowName(nameRaw);
  if (attachment !== undefined) return { name, source: attachmentSource(attachment) };
  return { name, source: workflowSource(originRaw ?? '') };
}

function parsePrefixInputs(context: CommandContext): ProductionEmojiRequest {
  const tokens = (context.rawArgs ?? '').trim().split(/\s+/u).filter((token) => token !== '');
  if (tokens.length > 2) throw new ProductionEmojiInputError('warning', invalidCombo);
  const attachment = singleAttachment(context);
  if (attachment !== undefined) {
    const token = tokens[0];
    if (token === undefined) throw new ProductionEmojiInputError('question', missingName);
    if (tokens.length !== 1) throw new ProductionEmojiInputError('warning', invalidCombo);
    const kind = kindOf(token);
    if (kind === 'url' || kind === 'mention') throw new ProductionEmojiInputError('warning', invalidCombo);
    return { name: workflowName(token), source: attachmentSource(attachment) };
  }
  const [left, right] = tokens;
  if (left === undefined) throw new ProductionEmojiInputError('question', missingBoth);
  if (right === undefined) {
    const kind = kindOf(left);
    if (kind === 'name') throw new ProductionEmojiInputError('question', missingSource);
    if (kind === 'id' || kind === 'url' || kind === 'mention') {
      throw new ProductionEmojiInputError('question', missingName);
    }
    throw new ProductionEmojiInputError('warning', invalidOrigin);
  }
  return resolvePair(left, right);
}

type TokenKind = 'url' | 'mention' | 'id' | 'name' | 'other';

/** Texto curto que não é URL: trata como nome rejeitado, não como origem desconhecida. */
function attemptedName(token: string, kind: TokenKind): boolean {
  return kind === 'other' && !token.includes('://') && !token.startsWith('<');
}

function kindOf(token: string): TokenKind {
  if (/^https:\/\//iu.test(token)) return 'url';
  if (BARE_ID.test(token)) return 'id';
  if (emojiSourceId(token) !== undefined) return 'mention';
  if (EMOJI_NAME_PATTERN.test(token)) return 'name';
  return 'other';
}

function resolvePair(left: string, right: string): ProductionEmojiRequest {
  const leftKind = kindOf(left);
  const rightKind = kindOf(right);
  const unambiguous = (kind: TokenKind): boolean => kind === 'url' || kind === 'mention';
  if (unambiguous(leftKind) && unambiguous(rightKind)) {
    throw new ProductionEmojiInputError('warning', invalidCombo);
  }
  if (unambiguous(leftKind) && (rightKind === 'name' || rightKind === 'id')) {
    return { name: workflowName(right), source: workflowSource(left) };
  }
  if (unambiguous(rightKind) && (leftKind === 'name' || leftKind === 'id')) {
    return { name: workflowName(left), source: workflowSource(right) };
  }
  if (leftKind === 'name' && rightKind === 'id') return { name: workflowName(left), source: right };
  if (leftKind === 'id' && rightKind === 'name') return { name: workflowName(right), source: left };
  if (leftKind === 'id' && rightKind === 'id') return { name: workflowName(left), source: right };
  if (attemptedName(left, leftKind) && (rightKind === 'id' || rightKind === 'url' || rightKind === 'mention')) {
    throw new ProductionEmojiInputError('label', invalidName);
  }
  if (attemptedName(right, rightKind) && (leftKind === 'id' || leftKind === 'url' || leftKind === 'mention')) {
    throw new ProductionEmojiInputError('label', invalidName);
  }
  if ((leftKind === 'name' || leftKind === 'id') && rightKind === 'other') {
    throw new ProductionEmojiInputError('warning', invalidOrigin);
  }
  if ((rightKind === 'name' || rightKind === 'id') && leftKind === 'other') {
    throw new ProductionEmojiInputError('warning', invalidOrigin);
  }
  throw new ProductionEmojiInputError('warning', invalidCombo);
}

function workflowName(raw: string | undefined): string {
  const trimmed = raw?.trim() ?? '';
  if (!EMOJI_NAME_PATTERN.test(trimmed)) throw new ProductionEmojiInputError('label', invalidName);
  return trimmed;
}

function workflowSource(raw: string): string {
  const trimmed = raw.trim();
  if (/^https:\/\//iu.test(trimmed)) return cdnOrThrow(trimmed);
  const id = emojiSourceId(trimmed);
  if (id !== undefined) return id;
  throw new ProductionEmojiInputError('warning', invalidOrigin);
}

function attachmentSource(attachment: EmojiAttachment): string {
  const contentType = attachment.contentType?.trim().toLowerCase();
  if (contentType !== undefined && contentType !== '' && !contentType.startsWith('image/')) {
    throw new ProductionEmojiInputError('photo', notAnImage);
  }
  return cdnOrThrow(attachment.url);
}

function cdnOrThrow(rawUrl: string): string {
  try {
    return normalizeDiscordCdnImageUrl(rawUrl);
  } catch (error: unknown) {
    if (error instanceof EmojiImportError && error.code === 'download_blocked') {
      throw new ProductionEmojiInputError('shield', error.message);
    }
    throw error;
  }
}

function singleAttachment(context: CommandContext): EmojiAttachment | undefined {
  const attachments = context.attachments ?? [];
  if (attachments.length > 1) throw new ProductionEmojiInputError('warning', tooManyFiles);
  return attachments[0];
}

function optionValue(context: CommandContext, optionName: string): string | undefined {
  const option = context.options?.find((candidate) => candidate.name === optionName);
  if (option === undefined || option.value === undefined) return undefined;
  if (typeof option.value !== 'string') throw new ProductionEmojiInputError('warning', invalidCombo);
  return option.value;
}

function blank(value: string | undefined): boolean {
  return value === undefined || value.trim() === '';
}
