import {
  DEFAULT_EMOJI_IMAGE_LIMITS,
  DEFAULT_EMOJI_QUEUE_LIMITS,
  DISCORD_APPLICATION_EMOJI_LIMIT,
  EMOJI_NAME_PATTERN,
  EmojiImportError,
  emojiError,
  inputTooLargeError,
  type CreatedEmoji,
  type EmojiCreationPort,
  type EmojiDestination,
  type EmojiDownloadPort,
  type EmojiImageLimits,
  type EmojiImageProcessor,
  type EmojiQueueLimits,
  type EmojiSource,
  type PreparedEmojiImage,
} from './types.js';
import { prepareEmojiImage } from './prepareEmojiImage.js';

const EMOJI_CDN = 'https://cdn.discordapp.com/emojis';
/** Ordem importa: primeiro tentamos a versão animada para nunca perder animação. */
const EMOJI_CDN_EXTENSIONS = ['gif', 'png'] as const;

const ANGLED_EMOJI_REF = /^<a?:([A-Za-z0-9_]{2,32}):(\d{17,20})>$/u;
const COMPACT_EMOJI_REF = /^([A-Za-z0-9_]{2,32}):(\d{17,20})$/u;
const BARE_EMOJI_ID = /^(\d{17,20})$/u;

interface ParsedEmojiRef {
  readonly name: string | undefined;
  readonly id: string;
}

export interface EmojiImportDeps {
  readonly download: EmojiDownloadPort;
  readonly processor: EmojiImageProcessor;
  readonly create: EmojiCreationPort;
}

export interface EmojiImportOptions {
  readonly limits?: EmojiImageLimits | undefined;
  readonly queue?: EmojiQueueLimits | undefined;
}

export interface EmojiImportRequest {
  readonly source: EmojiSource;
  readonly destination: EmojiDestination;
  /** Substitui o nome da origem; obrigatório quando a origem não tem nome aproveitável. */
  readonly name?: string | undefined;
}

export interface EmojiImportResult {
  readonly created: CreatedEmoji;
  readonly image: PreparedEmojiImage;
}

export interface EmojiImportService {
  importEmoji(request: EmojiImportRequest): Promise<EmojiImportResult>;
}

/**
 * Cria o caso de uso compartilhado de importação de emojis.
 *
 * O mesmo serviço atende os dois fluxos: cadastro nos Application Emojis do
 * bot de produção (`destination: 'application'`) e cadastro em um servidor
 * (`destination: 'guild'`). A escolha da aplicação de produção fica no
 * adapter; este módulo não recebe credenciais.
 */
export function createEmojiImportService(
  deps: EmojiImportDeps,
  options: EmojiImportOptions = {},
): EmojiImportService {
  const limits = options.limits ?? DEFAULT_EMOJI_IMAGE_LIMITS;
  const queue = options.queue ?? DEFAULT_EMOJI_QUEUE_LIMITS;
  const run = createRunSlot(queue);

  return {
    importEmoji: (request) => run(() => execute(request, deps, limits)),
  };
}

async function execute(
  request: EmojiImportRequest,
  deps: EmojiImportDeps,
  limits: EmojiImageLimits,
): Promise<EmojiImportResult> {
  const ref = request.source.kind === 'guild-emoji' ? parseEmojiRef(request.source.ref) : undefined;
  if (request.source.kind === 'guild-emoji' && !ref) {
    throw emojiError('invalid_source', 'A referência do emoji personalizado não é válida.');
  }
  const name = resolveName(request, ref);

  // Falha barata primeiro: tamanho declarado, depois cota do destino, antes de baixar e comprimir.
  if (request.source.kind === 'attachment' &&
      request.source.size !== undefined &&
      request.source.size > limits.maxInputBytes) {
    throw inputTooLargeError(limits.maxInputBytes);
  }
  if (request.source.kind === 'attachment' && rejectsDeclaredContentType(request.source.contentType)) {
    throw emojiError('unsupported_format', 'O formato não é suportado. Use PNG, JPEG, GIF, WebP ou AVIF.');
  }
  if (request.destination.kind === 'application') {
    const count = await deps.create.countApplicationEmojis();
    if (count >= DISCORD_APPLICATION_EMOJI_LIMIT) {
      throw emojiError('capacity_reached', 'O bot principal atingiu o limite de Application Emojis.');
    }
  }

  const sourceBytes = await resolveSource(request.source, ref, deps.download, limits);
  const image = await prepareEmojiImage({ bytes: sourceBytes }, deps.processor, limits);
  const created = await deps.create.create(request.destination, name, image);
  return { created, image };
}

function parseEmojiRef(ref: string): ParsedEmojiRef | undefined {
  // Os padrões têm grupos obrigatórios; a checagem explícita satisfaz o narrow.
  const angled = ANGLED_EMOJI_REF.exec(ref);
  const angledName = angled?.[1];
  const angledId = angled?.[2];
  if (angledName !== undefined && angledId !== undefined) return { name: angledName, id: angledId };
  const compact = COMPACT_EMOJI_REF.exec(ref);
  const compactName = compact?.[1];
  const compactId = compact?.[2];
  if (compactName !== undefined && compactId !== undefined) return { name: compactName, id: compactId };
  if (BARE_EMOJI_ID.test(ref)) return { name: undefined, id: ref };
  return undefined;
}

/** Distingue uma referência de emoji das demais entradas livres, sem duplicar os padrões. */
export function isEmojiSourceRef(ref: string): boolean {
  return parseEmojiRef(ref) !== undefined;
}

/** ID de um emoji informado como ID puro, marcação `<:nome:id>` / `<a:nome:id>` ou `nome:id`. */
export function emojiSourceId(ref: string): string | undefined {
  return parseEmojiRef(ref.trim())?.id;
}

function resolveName(request: EmojiImportRequest, ref: ParsedEmojiRef | undefined): string {
  const explicit = request.name;
  if (explicit !== undefined) {
    if (!EMOJI_NAME_PATTERN.test(explicit)) {
      throw emojiError('invalid_name', 'O nome precisa ter de 2 a 32 caracteres, entre A–Z, a–z, 0–9 ou _.');
    }
    return explicit;
  }
  if (request.source.kind === 'guild-emoji') {
    if (ref?.name) return ref.name;
    throw emojiError('invalid_name', 'Esta origem não tem um nome aproveitável. Informe um nome para o emoji.');
  }
  const derived = deriveName(request.source.filename) ?? deriveName(urlFilename(request.source.url));
  if (derived) return derived;
  throw emojiError('invalid_name', 'O nome do arquivo não serve como nome de emoji. Informe um nome.');
}

/** Remove a extensão final e só aceita o resultado dentro do padrão de nome de emoji. */
function deriveName(filename: string | undefined): string | undefined {
  if (filename === undefined || filename === '') return undefined;
  const stem = filename.replace(/\.[A-Za-z0-9]{1,8}$/u, '');
  return EMOJI_NAME_PATTERN.test(stem) ? stem : undefined;
}

/** O tipo declarado só recusa. Ausência, `null` e `image/*` seguem para a assinatura dos bytes. */
function rejectsDeclaredContentType(contentType: string | null | undefined): boolean {
  if (contentType == null) return false;
  return !contentType.trim().toLowerCase().startsWith('image/');
}

function urlFilename(rawUrl: string): string | undefined {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return undefined;
  }
  const segment = url.pathname.split('/').pop() ?? '';
  try {
    return decodeURIComponent(segment);
  } catch {
    return undefined;
  }
}

/**
 * Baixa um emoji do CDN pelo ID. Tenta `.gif` e, só se essa variante não
 * existir, `.png`, para não perder animação. A mesma função serve o importador
 * de emojis de servidor e o workflow de Application Emoji de produção.
 */
export async function downloadDiscordEmojiById(
  id: string,
  download: EmojiDownloadPort,
  limits: Pick<EmojiImageLimits, 'maxInputBytes' | 'downloadTimeoutMs'>,
): Promise<Uint8Array> {
  if (!BARE_EMOJI_ID.test(id)) {
    throw emojiError('invalid_source', 'A referência do emoji personalizado não é válida.');
  }
  const options = { maxBytes: limits.maxInputBytes, timeoutMs: limits.downloadTimeoutMs };
  for (const extension of EMOJI_CDN_EXTENSIONS) {
    const url = `${EMOJI_CDN}/${id}.${extension}?size=128&quality=lossless`;
    try {
      return await download(url, options);
    } catch (error: unknown) {
      if (error instanceof EmojiImportError && error.code === 'source_missing') continue;
      throw error;
    }
  }
  throw emojiError('source_missing', 'Não encontrei esse emoji no Discord.');
}

async function resolveSource(
  source: EmojiSource,
  ref: ParsedEmojiRef | undefined,
  download: EmojiDownloadPort,
  limits: EmojiImageLimits,
): Promise<Uint8Array> {
  if (source.kind === 'attachment') {
    return await download(source.url, { maxBytes: limits.maxInputBytes, timeoutMs: limits.downloadTimeoutMs });
  }
  if (!ref) throw emojiError('invalid_source', 'A referência do emoji personalizado não é válida.');
  return downloadDiscordEmojiById(ref.id, download, limits);
}

function createRunSlot(queue: EmojiQueueLimits): <T>(task: () => Promise<T>) => Promise<T> {
  if (!Number.isInteger(queue.concurrency) || queue.concurrency < 1) {
    throw new RangeError('queue.concurrency deve ser um inteiro ≥ 1.');
  }
  if (!Number.isInteger(queue.maxQueued) || queue.maxQueued < 0) {
    throw new RangeError('queue.maxQueued deve ser um inteiro ≥ 0.');
  }
  let active = 0;
  const waiting: Array<() => void> = [];
  return async function run<T>(task: () => Promise<T>): Promise<T> {
    if (active >= queue.concurrency) {
      if (waiting.length >= queue.maxQueued) {
        throw emojiError('queue_full', 'A fila de importação está cheia. Tente de novo em instantes.');
      }
      await new Promise<void>((release) => {
        waiting.push(release);
      });
    }
    active += 1;
    try {
      return await task();
    } finally {
      active -= 1;
      waiting.shift()?.();
    }
  };
}
