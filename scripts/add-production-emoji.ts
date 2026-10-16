import { appendFileSync, readFileSync, realpathSync, statSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

/** Nome de emoji da aplicação: 2–32 caracteres, letras, dígitos ou _. */
export const EMOJI_NAME_PATTERN = /^[A-Za-z0-9_]{2,32}$/u;

/** Pasta versionada das imagens enviadas ao bot de produção. */
export const EMOJI_ASSET_DIR = 'assets/emojis';

/** Limite do Discord para o arquivo do emoji. */
export const MAX_EMOJI_IMAGE_BYTES = 256 * 1024;

const MEDIA_TYPES = new Map<string, string>([
  ['.png', 'image/png'],
  ['.gif', 'image/gif'],
  ['.webp', 'image/webp'],
]);

const SNOWFLAKE = /^[1-9]\d{16,19}$/u;
const DISCORD_API = 'https://discord.com/api/v10';

export class EmojiProdError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EmojiProdError';
  }
}

export interface DiscordClient {
  request(method: 'GET' | 'POST', apiPath: string, body?: unknown): Promise<unknown>;
}

export interface ResolvedEmojiImage {
  readonly absolutePath: string;
  readonly mediaType: string;
  readonly bytes: Buffer;
}

export interface CreatedApplicationEmoji {
  readonly id: string;
  readonly name: string;
}

export interface EmojiProdIO {
  readonly env: NodeJS.ProcessEnv;
  readonly repoRoot: string;
  writeStdout(chunk: string): void;
  writeStderr(chunk: string): void;
  readonly discord?: DiscordClient | undefined;
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
 * Confere que o caminho fica dentro de `assets/emojis`, com extensão permitida
 * e no máximo 256 KiB. Recusa caminho absoluto, `..` e link que saia da pasta.
 */
export function resolveEmojiImage(repoRoot: string, imagePath: string): ResolvedEmojiImage {
  const normalized = imagePath.trim().replaceAll('\\', '/');
  if (normalized === '' || normalized.includes('\0')) {
    throw new EmojiProdError('Informe o caminho da imagem dentro de assets/emojis/.');
  }
  if (path.posix.isAbsolute(normalized) || path.win32.isAbsolute(normalized)) {
    throw new EmojiProdError('O caminho da imagem precisa ficar dentro de assets/emojis/.');
  }

  const allowedDir = path.resolve(repoRoot, EMOJI_ASSET_DIR);
  const candidate = path.resolve(repoRoot, normalized);
  if (!isInside(allowedDir, candidate)) {
    throw new EmojiProdError('O caminho da imagem precisa ficar dentro de assets/emojis/.');
  }

  const extension = path.extname(candidate).toLowerCase();
  const mediaType = MEDIA_TYPES.get(extension);
  if (mediaType === undefined) {
    throw new EmojiProdError('A imagem precisa ser PNG, GIF ou WEBP.');
  }

  let allowedReal: string;
  let fileReal: string;
  try {
    allowedReal = realpathSync(allowedDir);
    fileReal = realpathSync(candidate);
  } catch {
    throw new EmojiProdError('Não encontrei a imagem em assets/emojis/.');
  }
  if (!isInside(allowedReal, fileReal)) {
    throw new EmojiProdError('O caminho da imagem precisa ficar dentro de assets/emojis/.');
  }

  let size: number;
  try {
    const stat = statSync(fileReal);
    if (!stat.isFile()) throw new EmojiProdError('O caminho precisa ser um arquivo.');
    size = stat.size;
  } catch (error: unknown) {
    if (error instanceof EmojiProdError) throw error;
    throw new EmojiProdError('Não encontrei a imagem em assets/emojis/.');
  }
  if (size <= 0 || size > MAX_EMOJI_IMAGE_BYTES) {
    throw new EmojiProdError('A imagem precisa ter entre 1 byte e 256 KiB.');
  }

  const bytes = readFileSync(fileReal);
  if (bytes.length <= 0 || bytes.length > MAX_EMOJI_IMAGE_BYTES) {
    throw new EmojiProdError('A imagem precisa ter entre 1 byte e 256 KiB.');
  }
  return { absolutePath: fileReal, mediaType, bytes };
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
    throw new EmojiProdError('O segredo DISCORD_PROD_BOT_TOKEN não está configurado no ambiente production.');
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
 * que já exista.
 */
export async function addProductionEmoji(
  discord: DiscordClient,
  name: string,
  image: ResolvedEmojiImage,
): Promise<CreatedApplicationEmoji> {
  const applicationId = readSnowflake(await discord.request('GET', '/applications/@me'), 'id');
  const listed = await discord.request('GET', `/applications/${applicationId}/emojis`);
  if (emojiNameExists(listed, name)) {
    throw new EmojiProdError(`O emoji ${name} já existe na aplicação de produção. Este workflow só cria; não substitui nem apaga.`);
  }
  const created = await discord.request('POST', `/applications/${applicationId}/emojis`, {
    name,
    image: `data:${image.mediaType};base64,${image.bytes.toString('base64')}`,
  });
  return { id: readSnowflake(created, 'id'), name: readCreatedName(created, name) };
}

export function writeJobSummary(markdown: string, env: NodeJS.ProcessEnv = process.env): void {
  const file = env.GITHUB_STEP_SUMMARY?.trim();
  if (file === undefined || file === '') return;
  appendFileSync(file, `${markdown}\n`, { encoding: 'utf8' });
}

/** Valida as entradas, mascara o token e cria o emoji. Devolve o código de saída. */
export async function runEmojiProd(io: EmojiProdIO): Promise<number> {
  let token = '';
  try {
    token = normalizeBotToken(io.env.DISCORD_PROD_BOT_TOKEN);
    maskSecret(token, io.writeStdout);
    const name = validateEmojiName(io.env.EMOJI_NAME ?? '');
    const imagePath = io.env.EMOJI_IMAGE_PATH ?? '';
    const image = resolveEmojiImage(io.repoRoot, imagePath);
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

function publicError(error: unknown, token: string): string {
  const message = error instanceof Error && error.message.trim() !== ''
    ? error.message
    : 'Falha ao criar o emoji.';
  if (token.length > 0 && message.includes(token)) return 'Falha ao criar o emoji.';
  return message;
}

function isInside(parent: string, candidate: string): boolean {
  const relative = path.relative(parent, candidate);
  return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative);
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
    repoRoot: process.cwd(),
    writeStdout: (chunk) => { process.stdout.write(chunk); },
    writeStderr: (chunk) => { process.stderr.write(chunk); },
  });
}
