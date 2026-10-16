import { appendFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { Routes } from 'discord.js';
import { downloadDiscordEmojiById } from '#bot/application/emojis/importEmoji.js';
import { prepareEmojiImage } from '#bot/application/emojis/prepareEmojiImage.js';
import {
  DEFAULT_EMOJI_IMAGE_LIMITS,
  type EmojiDownloadPort,
  type EmojiImageProcessor,
} from '#bot/application/emojis/types.js';
import { createDiscordImageDownloader } from '#bot/infrastructure/images/downloadDiscordImage.js';
import { createSharpEmojiProcessor } from '#bot/infrastructure/images/sharpEmojiProcessor.js';

/** Nome de emoji da aplicação: 2–32 caracteres, letras, dígitos ou _. */
export const EMOJI_NAME_PATTERN = /^[A-Za-z0-9_]{2,32}$/u;

/** Mesma regra de ID do importador de emojis de servidor. */
const DISCORD_EMOJI_ID = /^\d{17,20}$/u;

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
  | { readonly kind: 'id'; readonly id: string }
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
 * Classifica a origem. ID de emoji segue o CDN compartilhado; qualquer outra
 * origem precisa ser HTTPS, sem usuário ou senha. A allowlist do CDN fica no
 * downloader.
 */
export function resolveProductionSource(raw: string): ProductionSource {
  const trimmed = raw.trim();
  if (DISCORD_EMOJI_ID.test(trimmed)) return { kind: 'id', id: trimmed };
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new EmojiProdError('Informe o ID de um emoji do Discord ou uma URL HTTPS.');
  }
  if (url.protocol !== 'https:' || url.username !== '' || url.password !== '') {
    throw new EmojiProdError('A URL da imagem precisa usar HTTPS, sem usuário ou senha.');
  }
  return { kind: 'url', url: url.toString() };
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
 * Cria um Application Emoji. Só usa GET e POST: não apaga nem substitui um nome
 * que já exista. A imagem já saiu do processador compartilhado.
 */
export async function addProductionEmoji(
  discord: DiscordClient,
  name: string,
  image: ProductionEmojiImage,
): Promise<CreatedApplicationEmoji> {
  const applicationId = readSnowflake(await discord.request('GET', Routes.currentApplication()), 'id');
  const listed = await discord.request('GET', Routes.applicationEmojis(applicationId));
  if (emojiNameExists(listed, name)) {
    throw new EmojiProdError(`O emoji ${name} já existe na aplicação de produção. Este workflow só cria; não substitui nem apaga.`);
  }
  const created = await discord.request('POST', Routes.applicationEmojis(applicationId), {
    name,
    image: toDataUri(image),
  });
  return { id: readSnowflake(created, 'id'), name: readCreatedName(created, name) };
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
    const name = validateEmojiName(io.env.EMOJI_NAME ?? '');
    const source = resolveProductionSource(io.env.EMOJI_SOURCE ?? '');
    const download = io.download ?? createProductionImageDownloader();
    const processor = io.processor ?? createProductionEmojiProcessor();
    const bytes = await loadSource(source, download);
    const image = await prepareEmojiImage({ bytes }, processor, DEFAULT_EMOJI_IMAGE_LIMITS);
    const discord = io.discord ?? createDiscordClient(token);
    const created = await addProductionEmoji(discord, name, image);
    const summary = [
      '### Emoji de produção',
      '',
      `- Nome: \`${created.name}\``,
      `- ID: \`${created.id}\``,
      '',
    ].join('\n');
    writeJobSummary(summary, io.env);
    io.writeStdout(`Emoji criado: ${created.name} (${created.id})\n`);
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

function emojiNameExists(body: unknown, name: string): boolean {
  if (typeof body !== 'object' || body === null || !('items' in body) || !Array.isArray(body.items)) {
    throw new EmojiProdError('Não consegui ler os Application Emojis da aplicação.');
  }
  const expected = name.toLowerCase();
  return body.items.some((item: unknown) => {
    if (typeof item !== 'object' || item === null || !('name' in item) || typeof item.name !== 'string') return false;
    return item.name.toLowerCase() === expected;
  });
}

const entry = process.argv[1];
if (entry !== undefined && import.meta.url === pathToFileURL(path.resolve(entry)).href) {
  process.exitCode = await runEmojiProd({
    env: process.env,
    writeStdout: (chunk) => { process.stdout.write(chunk); },
    writeStderr: (chunk) => { process.stderr.write(chunk); },
  });
}
