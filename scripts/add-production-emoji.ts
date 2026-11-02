import { appendFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { Routes } from 'discord.js';
import { downloadDiscordEmojiById, emojiSourceRef } from '#bot/application/emojis/importEmoji.js';
import { prepareEmojiImage } from '#bot/application/emojis/prepareEmojiImage.js';
import {
  deriveProductionEmojiName,
  firstFreeApplicationEmojiName,
  PRODUCTION_EMOJI_NAME_INVALID,
  PRODUCTION_EMOJI_NAME_MISSING,
  type ProductionEmojiNameSource,
} from '#bot/application/emojis/productionEmojiName.js';
import {
  DEFAULT_EMOJI_IMAGE_LIMITS,
  EmojiImportError,
  type EmojiDownloadPort,
  type EmojiImageProcessor,
} from '#bot/application/emojis/types.js';
import {
  createDiscordImageDownloader,
  normalizeDiscordCdnImageUrl,
} from '#bot/infrastructure/images/downloadDiscordImage.js';
import { createSharpEmojiProcessor } from '#bot/infrastructure/images/sharpEmojiProcessor.js';

/** Nome de emoji da aplicação: 2–32 caracteres, letras, dígitos ou _. */
export const EMOJI_NAME_PATTERN = /^[A-Za-z0-9_]{2,32}$/u;

const SNOWFLAKE = /^[1-9]\d{16,19}$/u;
const DISCORD_API = 'https://discord.com/api/v10';

/**
 * O workflow e o bot chamam as mesmas fábricas. O alias existe para o teste
 * conferir a identidade da função, sem uma segunda implementação.
 */
export const createProductionImageDownloader = createDiscordImageDownloader;
export const createProductionEmojiProcessor = createSharpEmojiProcessor;

export class EmojiProdError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EmojiProdError';
  }
}

export interface DiscordClient {
  request(method: 'GET' | 'POST', apiPath: string, body?: unknown): Promise<unknown>;
}

export interface ProductionEmojiImage {
  readonly bytes: Uint8Array;
  readonly contentType: 'image/png' | 'image/gif';
}

export interface CreatedApplicationEmoji {
  readonly id: string;
  readonly name: string;
}

export type ProductionSource =
  | { readonly kind: 'id'; readonly id: string; readonly hintedName?: string }
  | { readonly kind: 'url'; readonly url: string };

export interface EmojiProdIO {
  readonly env: NodeJS.ProcessEnv;
  writeStdout(chunk: string): void;
  writeStderr(chunk: string): void;
  readonly discord?: DiscordClient | undefined;
  readonly download?: EmojiDownloadPort | undefined;
  readonly processor?: EmojiImageProcessor | undefined;
}

/** Remove espaços nas pontas e recusa nome fora da regra do Discord. */
export function validateEmojiName(name: string): string {
  const trimmed = name.trim();
  if (!EMOJI_NAME_PATTERN.test(trimmed)) {
    throw new EmojiProdError('O nome precisa ter de 2 a 32 caracteres, entre A–Z, a–z, 0–9 ou _.');
  }
  return trimmed;
}

/**
 * Classifica a origem. Marcação e `nome:id` viram ID e guardam o nome.
 * ID puro não tem nome. Qualquer outra origem precisa ser HTTPS, sem usuário
 * ou senha. A allowlist do CDN entra em `acceptProductionSource`.
 */
export function resolveProductionSource(raw: string): ProductionSource {
  const trimmed = raw.trim();
  const ref = emojiSourceRef(trimmed);
  if (ref !== undefined) {
    return ref.name === undefined
      ? { kind: 'id', id: ref.id }
      : { kind: 'id', id: ref.id, hintedName: ref.name };
  }
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new EmojiProdError('Informe o ID de um emoji, uma marcação <:nome:id> ou uma URL HTTPS.');
  }
  if (url.protocol !== 'https:' || url.username !== '' || url.password !== '') {
    throw new EmojiProdError('A URL da imagem precisa usar HTTPS, sem usuário ou senha.');
  }
  return { kind: 'url', url: url.toString() };
}

/**
 * A URL ainda passa pela mesma allowlist do comando, antes de derivar o nome
 * ou baixar. ID e marcação não têm URL para normalizar.
 */
export function acceptProductionSource(raw: string): ProductionSource {
  const source = resolveProductionSource(raw);
  if (source.kind !== 'url') return source;
  try {
    return { kind: 'url', url: normalizeDiscordCdnImageUrl(source.url) };
  } catch (error: unknown) {
    if (error instanceof EmojiImportError) throw new EmojiProdError(error.message);
    throw error;
  }
}

/** Nome informado, ou o derivado da origem quando o input veio vazio. */
export function requestedProductionName(rawName: string, source: ProductionSource): string {
  const trimmed = rawName.trim();
  if (trimmed !== '') return validateEmojiName(trimmed);
  const derived = deriveProductionEmojiName(nameSource(source));
  if (derived.status === 'ready') return derived.name;
  throw new EmojiProdError(derived.status === 'missing' ? PRODUCTION_EMOJI_NAME_MISSING : PRODUCTION_EMOJI_NAME_INVALID);
}

function nameSource(source: ProductionSource): ProductionEmojiNameSource {
  if (source.kind === 'url') return { kind: 'url', url: source.url };
  if (source.hintedName !== undefined) return { kind: 'mention', name: source.hintedName };
  return { kind: 'id' };
}

/** Registra o valor no mascaramento do GitHub Actions sem devolvê-lo em outro texto. */
export function maskSecret(secret: string, write: (chunk: string) => void): void {
  if (secret.length === 0) return;
  write(`::add-mask::${secret}\n`);
}

/** Aceita o token só quando ele não tem espaço interno nem quebra de linha. */
export function normalizeBotToken(raw: string | undefined): string {
  const token = raw?.trim() ?? '';
  if (token.length === 0 || /[\s\0]/u.test(token)) {
    throw new EmojiProdError('O segredo DISCORD_BOT_TOKEN não está disponível via Doppler.');
  }
  return token;
}

export function createDiscordClient(token: string, fetchImpl: typeof fetch = globalThis.fetch): DiscordClient {
  return {
    async request(method, apiPath, body) {
      const response = await fetchImpl(`${DISCORD_API}${apiPath}`, {
        method,
        headers: {
          Authorization: `Bot ${token}`,
          Accept: 'application/json',
          'User-Agent': 'KuruttinaBot (emoji-prod)',
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        },
        body: body === undefined ? null : JSON.stringify(body),
        signal: AbortSignal.timeout(20_000),
      });
      if (!response.ok) {
        throw new EmojiProdError(`O Discord recusou ${method} ${apiPath} com HTTP ${response.status}.`);
      }
      const text = await response.text();
      if (text.trim() === '') return undefined;
      try {
        return JSON.parse(text) as unknown;
      } catch {
        throw new EmojiProdError(`O Discord devolveu uma resposta inválida em ${method} ${apiPath}.`);
      }
    },
  };
}

/**
 * Cria um Application Emoji. Só usa GET e POST: não apaga nem substitui.
 * Se o nome já existe, sem diferenciar maiúsculas, usa nome2, nome3, …
 * o primeiro livre ainda dentro de 32 caracteres. A imagem já saiu do
 * processador compartilhado. O nome devolvido é o que foi criado.
 */
export async function addProductionEmoji(
  discord: DiscordClient,
  name: string,
  image: ProductionEmojiImage,
): Promise<CreatedApplicationEmoji> {
  const applicationId = readSnowflake(await discord.request('GET', Routes.currentApplication()), 'id');
  const listed = await discord.request('GET', Routes.applicationEmojis(applicationId));
  const available = firstFreeApplicationEmojiName(name, readApplicationEmojiNames(listed));
  if (available === undefined) {
    throw new EmojiProdError('Não há um nome livre de até 32 caracteres para este emoji.');
  }
  const created = await discord.request('POST', Routes.applicationEmojis(applicationId), {
    name: available,
    image: toDataUri(image),
  });
  return { id: readSnowflake(created, 'id'), name: readCreatedName(created, available) };
}

export function writeJobSummary(markdown: string, env: NodeJS.ProcessEnv = process.env): void {
  const file = env.GITHUB_STEP_SUMMARY?.trim();
  if (file === undefined || file === '') return;
  appendFileSync(file, `${markdown}\n`, { encoding: 'utf8' });
}

/** Valida as entradas, mascara o token e cria o emoji em memória. */
export async function runEmojiProd(io: EmojiProdIO): Promise<number> {
  let token = '';
  try {
    token = normalizeBotToken(io.env.DISCORD_BOT_TOKEN);
    maskSecret(token, io.writeStdout);
    const source = acceptProductionSource(io.env.EMOJI_SOURCE ?? '');
    const name = requestedProductionName(io.env.EMOJI_NAME ?? '', source);
    const download = io.download ?? createProductionImageDownloader();
    const processor = io.processor ?? createProductionEmojiProcessor();
    const bytes = await loadSource(source, download);
    const image = await prepareEmojiImage({ bytes }, processor, DEFAULT_EMOJI_IMAGE_LIMITS);
    const discord = io.discord ?? createDiscordClient(token);
    const created = await addProductionEmoji(discord, name, image);
    writeJobSummary(summaryMarkdown(created, name), io.env);
    io.writeStdout(createdLog(created, name));
    return 0;
  } catch (error: unknown) {
    io.writeStderr(`${publicError(error, token)}\n`);
    return 1;
  }
}

async function loadSource(source: ProductionSource, download: EmojiDownloadPort): Promise<Uint8Array> {
  if (source.kind === 'id') return downloadDiscordEmojiById(source.id, download, DEFAULT_EMOJI_IMAGE_LIMITS);
  return download(source.url, {
    maxBytes: DEFAULT_EMOJI_IMAGE_LIMITS.maxInputBytes,
    timeoutMs: DEFAULT_EMOJI_IMAGE_LIMITS.downloadTimeoutMs,
  });
}

function toDataUri(image: ProductionEmojiImage): string {
  return `data:${image.contentType};base64,${Buffer.from(image.bytes).toString('base64')}`;
}

function publicError(error: unknown, token: string): string {
  const message = error instanceof Error && error.message.trim() !== ''
    ? error.message
    : 'Falha ao criar o emoji.';
  if (token.length > 0 && message.includes(token)) return 'Falha ao criar o emoji.';
  return message;
}

function readSnowflake(body: unknown, key: string): string {
  if (typeof body !== 'object' || body === null || !(key in body)) {
    throw new EmojiProdError('O Discord devolveu uma resposta sem o identificador esperado.');
  }
  const value = (body as Record<string, unknown>)[key];
  if (typeof value !== 'string' || !SNOWFLAKE.test(value)) {
    throw new EmojiProdError('O Discord devolveu uma resposta sem o identificador esperado.');
  }
  return value;
}

function readCreatedName(body: unknown, fallback: string): string {
  if (typeof body === 'object' && body !== null && 'name' in body && typeof body.name === 'string' && EMOJI_NAME_PATTERN.test(body.name)) {
    return body.name;
  }
  return fallback;
}

function readApplicationEmojiNames(body: unknown): string[] {
  if (typeof body !== 'object' || body === null || !('items' in body) || !Array.isArray(body.items)) {
    throw new EmojiProdError('Não consegui ler os Application Emojis da aplicação.');
  }
  const names: string[] = [];
  for (const item of body.items) {
    if (typeof item === 'object' && item !== null && 'name' in item && typeof item.name === 'string') {
      names.push(item.name);
    }
  }
  return names;
}

function summaryMarkdown(created: CreatedApplicationEmoji, requested: string): string {
  const lines = ['### Emoji de produção', '', `- Nome: \`${created.name}\``];
  if (created.name !== requested) lines.push(`- Nome pedido: \`${requested}\``);
  lines.push(`- ID: \`${created.id}\``, '');
  return lines.join('\n');
}

function createdLog(created: CreatedApplicationEmoji, requested: string): string {
  const finalName = `Emoji criado: ${created.name} (${created.id})`;
  if (created.name === requested) return `${finalName}\n`;
  return `${finalName}; nome pedido: ${requested}\n`;
}

const entry = process.argv[1];
if (entry !== undefined && import.meta.url === pathToFileURL(path.resolve(entry)).href) {
  process.exitCode = await runEmojiProd({
    env: process.env,
    writeStdout: (chunk) => { process.stdout.write(chunk); },
    writeStderr: (chunk) => { process.stderr.write(chunk); },
  });
}
