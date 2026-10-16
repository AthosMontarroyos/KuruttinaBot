import { appendFileSync, lstatSync, readFileSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

/** Nome de emoji da aplicação: 2–32 caracteres, letras, dígitos ou _. */
export const EMOJI_NAME_PATTERN = /^[A-Za-z0-9_]{2,32}$/u;

/** Limite do Discord para o arquivo do emoji. */
export const MAX_EMOJI_IMAGE_BYTES = 256 * 1024;

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

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
 * Lê o arquivo baixado e exige que o Content-Type e a assinatura sejam o mesmo
 * PNG, JPEG, GIF ou WEBP, com no máximo 256 KiB.
 */
export function readEmojiImage(filePath: string, contentType: string): ResolvedEmojiImage {
  const trimmed = filePath.trim();
  if (trimmed === '' || trimmed.includes('\0') || !path.isAbsolute(trimmed)) {
    throw new EmojiProdError('Não encontrei a imagem baixada.');
  }

  let size: number;
  try {
    const stat = lstatSync(trimmed);
    if (stat.isSymbolicLink() || !stat.isFile()) {
      throw new EmojiProdError('O caminho precisa ser um arquivo.');
    }
    size = stat.size;
  } catch (error: unknown) {
    if (error instanceof EmojiProdError) throw error;
    throw new EmojiProdError('Não encontrei a imagem baixada.');
  }
  if (size <= 0 || size > MAX_EMOJI_IMAGE_BYTES) {
    throw new EmojiProdError('A imagem precisa ter entre 1 byte e 256 KiB.');
  }

  const bytes = readFileSync(trimmed);
  if (bytes.length <= 0 || bytes.length > MAX_EMOJI_IMAGE_BYTES) {
    throw new EmojiProdError('A imagem precisa ter entre 1 byte e 256 KiB.');
  }

  const announced = mediaTypeFromContentType(contentType);
  const signature = mediaTypeFromBytes(bytes);
  if (announced === undefined || signature === undefined || announced !== signature) {
    throw new EmojiProdError('A imagem precisa ser PNG, JPEG, GIF ou WEBP, e o tipo anunciado precisa conferir com o conteúdo.');
  }
  return { absolutePath: trimmed, mediaType: signature, bytes };
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

/** Valida as entradas, mascara o token, cria o emoji e apaga o arquivo baixado. */
export async function runEmojiProd(io: EmojiProdIO): Promise<number> {
  let token = '';
  let code = 1;
  try {
    token = normalizeBotToken(io.env.DISCORD_BOT_TOKEN);
    maskSecret(token, io.writeStdout);
    const name = validateEmojiName(io.env.EMOJI_NAME ?? '');
    const image = readEmojiImage(io.env.EMOJI_IMAGE_FILE ?? '', io.env.EMOJI_CONTENT_TYPE ?? '');
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
    code = 0;
  } catch (error: unknown) {
    io.writeStderr(`${publicError(error, token)}\n`);
    code = 1;
  } finally {
    removeDownloadedImage(io.env.EMOJI_IMAGE_FILE ?? '', io.writeStderr);
  }
  return code;
}

function mediaTypeFromContentType(contentType: string): string | undefined {
  const media = contentType.split(';', 1)[0]?.trim().toLowerCase() ?? '';
  if (media === 'image/png') return 'image/png';
  if (media === 'image/jpeg' || media === 'image/jpg') return 'image/jpeg';
  if (media === 'image/gif') return 'image/gif';
  if (media === 'image/webp') return 'image/webp';
  return undefined;
}

function mediaTypeFromBytes(bytes: Buffer): string | undefined {
  if (bytes.length >= PNG_SIGNATURE.length && bytes.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) {
    return 'image/png';
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }
  if (bytes.length >= 6) {
    const gif = bytes.subarray(0, 6).toString('ascii');
    if (gif === 'GIF87a' || gif === 'GIF89a') return 'image/gif';
  }
  if (
    bytes.length >= 12
    && bytes.subarray(0, 4).toString('ascii') === 'RIFF'
    && bytes.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'image/webp';
  }
  return undefined;
}

function removeDownloadedImage(filePath: string, writeStderr: (chunk: string) => void): void {
  const trimmed = filePath.trim();
  if (trimmed === '' || trimmed.includes('\0') || !path.isAbsolute(trimmed)) return;
  try {
    const stat = lstatSync(trimmed);
    if (!stat.isFile() && !stat.isSymbolicLink()) return;
    unlinkSync(trimmed);
  } catch (error: unknown) {
    if (isNotFound(error)) return;
    writeStderr('Não consegui apagar o arquivo temporário da imagem.\n');
  }
}

function isNotFound(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT';
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
