import { describe, expect, it, vi } from 'vitest';
import { createDiscordImageDownloader } from '../apps/bot/src/infrastructure/images/downloadDiscordImage.js';
import { EmojiImportError } from '../apps/bot/src/application/emojis/types.js';

const OPTIONS = { maxBytes: 1024, timeoutMs: 500 };

interface ResponseStubInit {
  readonly ok?: boolean;
  readonly status?: number;
  readonly headers?: Record<string, string>;
  readonly chunks?: readonly Uint8Array[];
  readonly body?: unknown;
}

/** Stub estrutural mínimo de Response: apenas ok/status/headers/body. */
function responseStub(init: ResponseStubInit = {}): Response {
  const chunks = init.chunks ?? [Uint8Array.from([1, 2, 3])];
  const body =
    init.body !== undefined
      ? init.body
      : new ReadableStream<Uint8Array>({
          start(controller) {
            for (const chunk of chunks) controller.enqueue(chunk);
            controller.close();
          },
        });
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    headers: new Headers(init.headers ?? {}),
    body,
  } as unknown as Response;
}

async function expectErrorCode(promise: Promise<unknown>, code: string): Promise<void> {
  await expect(promise).rejects.toBeInstanceOf(EmojiImportError);
  await expect(promise).rejects.toMatchObject({ code });
}

describe('download restrito ao CDN do Discord', () => {
  it('baixa emoji do CDN concatenando os chunks', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      responseStub({ chunks: [Uint8Array.from([1, 2]), Uint8Array.from([3])] }),
    );
    const download = createDiscordImageDownloader(fetchMock);

    const bytes = await download('https://cdn.discordapp.com/emojis/123456789012345678.gif?size=128', OPTIONS);

    expect(bytes).toEqual(Uint8Array.from([1, 2, 3]));
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe('https://cdn.discordapp.com/emojis/123456789012345678.gif?size=128');
    expect(init).toMatchObject({ redirect: 'error' });
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  it('aceita anexos em media.discordapp.net', async () => {
    const fetchMock = vi.fn(async () => responseStub());
    const download = createDiscordImageDownloader(fetchMock);

    await download('https://media.discordapp.net/attachments/1/2/party_cat.png', OPTIONS);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('aceita anexos efêmeros de opção de slash command', async () => {
    const fetchMock = vi.fn(async () => responseStub());
    const download = createDiscordImageDownloader(fetchMock);

    await download(
      'https://cdn.discordapp.com/ephemeral-attachments/1/2/party_cat.png?ex=65d903de&is=65c68ede&hm=abc',
      OPTIONS,
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['protocolo não-HTTPS', 'http://cdn.discordapp.com/emojis/123456789012345678.png'],
    ['host fora da allowlist', 'https://evil.example/emojis/123456789012345678.png'],
    ['caminho fora da allowlist', 'https://cdn.discordapp.com/icons/123456789012345678.png'],
    ['porta não-padrão', 'https://cdn.discordapp.com:8443/emojis/123456789012345678.png'],
    ['credencial embutida', 'https://user@cdn.discordapp.com/emojis/123456789012345678.png'],
    ['URL não parseável', 'não é uma url'],
  ])('bloqueia %s', async (_label, url) => {
    const fetchMock = vi.fn(async () => responseStub());
    const download = createDiscordImageDownloader(fetchMock);

    await expectErrorCode(download(url, OPTIONS), 'download_blocked');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('mapeia 404 para origem inexistente', async () => {
    const download = createDiscordImageDownloader(async () => responseStub({ ok: false, status: 404, chunks: [] }));
    await expectErrorCode(
      download('https://cdn.discordapp.com/emojis/123456789012345678.gif', OPTIONS),
      'source_missing',
    );
  });

  it('trata GIF inexistente respondido como HTTP 415 como origem ausente', async () => {
    const body = JSON.stringify({
      message: 'Invalid resource "https://cdn.discordapp.com/emojis/799041451290918942.gif?size=128&quality=lossless"',
    });
    const download = createDiscordImageDownloader(async () => responseStub({
      ok: false,
      status: 415,
      chunks: [new TextEncoder().encode(body)],
    }));

    await expectErrorCode(
      download('https://cdn.discordapp.com/emojis/799041451290918942.gif?size=128&quality=lossless', OPTIONS),
      'source_missing',
    );
  });

  it('mantém outro HTTP 415 como falha de download', async () => {
    const download = createDiscordImageDownloader(async () => responseStub({
      ok: false,
      status: 415,
      chunks: [new TextEncoder().encode('unsupported media type')],
    }));

    await expectErrorCode(
      download('https://cdn.discordapp.com/emojis/123456789012345678.gif', OPTIONS),
      'download_failed',
    );
  });

  it('mapeia erro HTTP do Discord para falha de download', async () => {
    const download = createDiscordImageDownloader(async () => responseStub({ ok: false, status: 500, chunks: [] }));
    await expectErrorCode(
      download('https://cdn.discordapp.com/emojis/123456789012345678.gif', OPTIONS),
      'download_failed',
    );
  });

  it('rejeita conteúdo declarado acima do limite sem ler o corpo', async () => {
    let pulled = false;
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(Uint8Array.from([1]));
        controller.close();
      },
      pull() {
        pulled = true;
      },
    });
    const download = createDiscordImageDownloader(
      async () => responseStub({ headers: { 'content-length': '2048' }, body }),
    );

    await expectErrorCode(
      download('https://cdn.discordapp.com/emojis/123456789012345678.png', OPTIONS),
      'input_too_large',
    );
    expect(pulled).toBe(false);
  });

  it('aborta leitura quando o corpo sem content-length excede o limite', async () => {
    const big = new Uint8Array(2048);
    const download = createDiscordImageDownloader(async () => responseStub({ chunks: [big] }));

    await expectErrorCode(
      download('https://cdn.discordapp.com/emojis/123456789012345678.png', OPTIONS),
      'input_too_large',
    );
  });

  it('traduz timeout/erro de rede em falha de download', async () => {
    const download = createDiscordImageDownloader(async () => {
      throw Object.assign(new Error('The operation was aborted due to timeout'), { name: 'TimeoutError' });
    });
    await expectErrorCode(
      download('https://cdn.discordapp.com/emojis/123456789012345678.png', OPTIONS),
      'download_failed',
    );
  });

  it('falha fechado quando a resposta não tem corpo', async () => {
    const download = createDiscordImageDownloader(async () => responseStub({ body: null }));
    await expectErrorCode(
      download('https://cdn.discordapp.com/emojis/123456789012345678.png', OPTIONS),
      'download_failed',
    );
  });
});
