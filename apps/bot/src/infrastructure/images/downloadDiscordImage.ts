import {
  EmojiImportError,
  emojiError,
  type EmojiDownloadOptions,
  type EmojiDownloadPort,
} from '#bot/application/emojis/types.js';

/**
 * Allowlist de hosts: apenas o CDN do Discord. O host nunca vem do usuário
 * (emoji usa ID validado; anexo usa a URL do próprio Discord), protocolo é
 * sempre HTTPS, porta padrão, sem credenciais e sem redirecionamento — não há
 * resolução DNS controlável pelo atacante. O pinning de IP não é aplicado por
 * ausência de alvo resolvível fora do controle do Discord (limitação registrada
 * em docs/project/emoji-import.md).
 *
 * Paths: `/emojis` (emoji de outro servidor), `/attachments` (arquivo de
 * mensagem) e `/ephemeral-attachments` (arquivo da opção de slash command).
 */
const DISCORD_CDN_HOSTS: ReadonlySet<string> = new Set(['cdn.discordapp.com', 'media.discordapp.net']);
const ALLOWED_PATH_PATTERN = /^\/(?:emojis|attachments|ephemeral-attachments)\//u;

export type DiscordImageFetch = (url: string, init?: RequestInit) => Promise<Response>;

export function createDiscordImageDownloader(
  fetchImpl: DiscordImageFetch = (url, init) => fetch(url, init),
): EmojiDownloadPort {
  return async (rawUrl: string, options: EmojiDownloadOptions): Promise<Uint8Array> => {
    const url = parseAllowedUrl(rawUrl);

    let response: Response;
    try {
      response = await fetchImpl(url, {
        redirect: 'error',
        signal: AbortSignal.timeout(options.timeoutMs),
      });
    } catch {
      throw emojiError('download_failed', 'Não consegui baixar a imagem do Discord dentro do tempo limite.');
    }
    if (!response.ok) {
      // O CDN responde 415 Invalid resource quando o .gif do emoji estático não existe.
      const bodyPrefix = response.status === 415 ? await responsePreview(response) : '';
      if (response.status === 404 || missingEmojiVariant(response.status, bodyPrefix)) {
        throw emojiError('source_missing', 'Não encontrei a imagem no Discord.');
      }
      throw emojiError('download_failed', 'O Discord recusou a imagem.');
    }
    const declared = Number(response.headers.get('content-length') ?? 0);
    if (Number.isFinite(declared) && declared > options.maxBytes) {
      throw emojiError('input_too_large', 'A imagem excede o limite de entrada.');
    }
    return await readBounded(response, options.maxBytes);
  };
}

function missingEmojiVariant(status: number, bodyPrefix: string): boolean {
  return status === 415 && bodyPrefix.includes('Invalid resource');
}

async function responsePreview(response: Response): Promise<string> {
  try {
    const reader = response.body?.getReader();
    if (!reader) return '';
    const { value } = await reader.read();
    await reader.cancel();
    if (!value) return '';
    return new TextDecoder('utf-8', { fatal: false })
      .decode(value.subarray(0, 180))
      .replace(/[^\x20-\x7E]+/gu, ' ')
      .slice(0, 180);
  } catch {
    return '';
  }
}

function parseAllowedUrl(rawUrl: string): string {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw emojiError('download_blocked', 'A URL da imagem não é válida.');
  }
  const allowed =
    url.protocol === 'https:' &&
    DISCORD_CDN_HOSTS.has(url.hostname) &&
    url.username === '' &&
    url.password === '' &&
    (url.port === '' || url.port === '443') &&
    ALLOWED_PATH_PATTERN.test(url.pathname);
  if (!allowed) throw emojiError('download_blocked', 'A URL de origem não pertence ao CDN do Discord.');
  return url.toString();
}

async function readBounded(response: Response, maxBytes: number): Promise<Uint8Array> {
  const body = response.body;
  if (!body) throw emojiError('download_failed', 'Não recebi a imagem do Discord.');
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw emojiError('input_too_large', 'A imagem excede o limite de entrada.');
      }
      chunks.push(value);
    }
  } catch (error: unknown) {
    if (error instanceof EmojiImportError) throw error;
    throw emojiError('download_failed', 'Não consegui ler a imagem baixada.');
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}
