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
 */
const DISCORD_CDN_HOSTS: ReadonlySet<string> = new Set(['cdn.discordapp.com', 'media.discordapp.net']);
const ALLOWED_PATH_PATTERN = /^\/(?:emojis|attachments)\//u;

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
      throw emojiError('download_failed', 'Não foi possível baixar a imagem do Discord dentro do tempo limite.');
    }
    if (response.status === 404) {
      throw emojiError('source_missing', 'Imagem de origem não encontrada no Discord.');
    }
    if (!response.ok) {
      throw emojiError('download_failed', `O Discord recusou a imagem de origem (HTTP ${response.status}).`);
    }

    const declared = Number(response.headers.get('content-length') ?? 0);
    if (Number.isFinite(declared) && declared > options.maxBytes) {
      throw emojiError('input_too_large', 'A imagem de origem excede o limite interno de entrada.');
    }
    return await readBounded(response, options.maxBytes);
  };
}

function parseAllowedUrl(rawUrl: string): string {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw emojiError('download_blocked', 'URL de imagem de origem inválida.');
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
  if (!body) throw emojiError('download_failed', 'O Discord não enviou o conteúdo da imagem.');
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
        throw emojiError('input_too_large', 'A imagem de origem excede o limite interno de entrada.');
      }
      chunks.push(value);
    }
  } catch (error: unknown) {
    if (error instanceof EmojiImportError) throw error;
    throw emojiError('download_failed', 'A leitura da imagem baixada falhou.');
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}
