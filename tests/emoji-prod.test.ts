import { mkdtempSync, mkdirSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  EmojiProdError,
  MAX_EMOJI_IMAGE_BYTES,
  addProductionEmoji,
  createDiscordClient,
  maskSecret,
  normalizeBotToken,
  resolveEmojiImage,
  runEmojiProd,
  validateEmojiName,
  writeJobSummary,
  type DiscordClient,
} from '../scripts/add-production-emoji.js';

const APPLICATION_ID = '123456789012345678';
const EMOJI_ID = '223456789012345678';
const TOKEN = 'prod-token-should-stay-hidden';

function repoWith(name: string, bytes: Buffer): { root: string; imagePath: string } {
  const root = mkdtempSync(path.join(tmpdir(), 'emoji-prod-'));
  const dir = path.join(root, 'assets', 'emojis');
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, name), bytes);
  return { root, imagePath: `assets/emojis/${name}` };
}

function client(handler: DiscordClient['request']): DiscordClient {
  return { request: vi.fn(handler) };
}

describe('validateEmojiName', () => {
  it('aceita nome dentro da regra do Discord', () => {
    expect(validateEmojiName('  festa_01 ')).toBe('festa_01');
    expect(validateEmojiName('ab')).toBe('ab');
    expect(validateEmojiName('a'.repeat(32))).toBe('a'.repeat(32));
  });

  it.each(['', ' ', 'a', 'a'.repeat(33), 'oi-oi', 'com espaço', 'ação', 'nome.com', '😀ok'])(
    'recusa %j',
    (name) => {
      expect(() => validateEmojiName(name)).toThrow(EmojiProdError);
    },
  );
});

describe('resolveEmojiImage', () => {
  it('lê PNG, GIF e WEBP de até 256 KiB dentro da pasta', () => {
    for (const [file, mediaType] of [
      ['ok.png', 'image/png'],
      ['ok.gif', 'image/gif'],
      ['ok.webp', 'image/webp'],
    ] as const) {
      const { root, imagePath } = repoWith(file, Buffer.from([1, 2, 3]));
      const image = resolveEmojiImage(root, imagePath);
      expect(image.mediaType).toBe(mediaType);
      expect(image.bytes).toEqual(Buffer.from([1, 2, 3]));
    }
  });

  it('aceita exatamente 256 KiB', () => {
    const { root, imagePath } = repoWith('limite.png', Buffer.alloc(MAX_EMOJI_IMAGE_BYTES, 7));
    expect(resolveEmojiImage(root, imagePath).bytes.length).toBe(MAX_EMOJI_IMAGE_BYTES);
  });

  it('recusa arquivo maior que 256 KiB', () => {
    const { root, imagePath } = repoWith('grande.png', Buffer.alloc(MAX_EMOJI_IMAGE_BYTES + 1, 7));
    expect(() => resolveEmojiImage(root, imagePath)).toThrow(/256 KiB/u);
  });

  it.each([
    'assets/emojis/../segredo.png',
    'assets/outro/ok.png',
    '/etc/passwd',
    'assets/emojis/ok.jpg',
    'assets/emojis/ok.svg',
    'assets/emojis',
  ])('recusa o caminho %s', (imagePath) => {
    const { root } = repoWith('ok.png', Buffer.from([1]));
    writeFileSync(path.join(root, 'segredo.png'), Buffer.from([1]));
    mkdirSync(path.join(root, 'assets', 'outro'), { recursive: true });
    writeFileSync(path.join(root, 'assets', 'outro', 'ok.png'), Buffer.from([1]));
    expect(() => resolveEmojiImage(root, imagePath)).toThrow(EmojiProdError);
  });

  it('recusa link que aponta para fora da pasta', () => {
    const { root } = repoWith('ok.png', Buffer.from([1]));
    const outside = path.join(root, 'fora.png');
    writeFileSync(outside, Buffer.from([1]));
    symlinkSync(outside, path.join(root, 'assets', 'emojis', 'atalho.png'));
    expect(() => resolveEmojiImage(root, 'assets/emojis/atalho.png')).toThrow(/assets\/emojis/u);
  });

  it('recusa arquivo ausente', () => {
    const { root } = repoWith('ok.png', Buffer.from([1]));
    expect(() => resolveEmojiImage(root, 'assets/emojis/ausente.png')).toThrow(/Não encontrei/u);
  });
});

describe('addProductionEmoji', () => {
  it('consulta a aplicação, recusa nome existente e não envia POST', async () => {
    const calls: string[] = [];
    const discord = client(async (method, apiPath) => {
      calls.push(`${method} ${apiPath}`);
      if (apiPath === '/applications/@me') return { id: APPLICATION_ID };
      return { items: [{ name: 'Festa_01', id: EMOJI_ID }] };
    });
    const image = resolveEmojiImage(...Object.values(repoWith('a.png', Buffer.from([9]))) as [string, string]);

    await expect(addProductionEmoji(discord, 'festa_01', image)).rejects.toThrow(/só cria/u);
    expect(calls).toEqual([
      'GET /applications/@me',
      `GET /applications/${APPLICATION_ID}/emojis`,
    ]);
  });

  it('envia data URI e devolve o emoji criado', async () => {
    let posted: unknown;
    const discord = client(async (method, apiPath, body) => {
      if (apiPath === '/applications/@me') return { id: APPLICATION_ID };
      if (method === 'GET') return { items: [{ name: 'outro', id: EMOJI_ID }] };
      posted = body;
      return { id: EMOJI_ID, name: 'festa_01' };
    });
    const image = resolveEmojiImage(...Object.values(repoWith('a.png', Buffer.from([9, 8]))) as [string, string]);

    await expect(addProductionEmoji(discord, 'festa_01', image)).resolves.toEqual({
      id: EMOJI_ID,
      name: 'festa_01',
    });
    expect(posted).toEqual({
      name: 'festa_01',
      image: 'data:image/png;base64,CQg=',
    });
  });
});

describe('createDiscordClient', () => {
  it('não devolve o token nem o corpo quando o Discord recusa', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => new Response(`{"message":"${TOKEN}"}`, { status: 401 }));
    const discord = createDiscordClient(TOKEN, fetchImpl);

    await expect(discord.request('GET', '/applications/@me')).rejects.toThrow(EmojiProdError);
    await expect(discord.request('GET', '/applications/@me')).rejects.not.toThrow(TOKEN);
    const init = fetchImpl.mock.calls[0]?.[1];
    expect(new Headers(init?.headers).get('Authorization')).toBe(`Bot ${TOKEN}`);
  });
});

describe('runEmojiProd', () => {
  it('mascara o token antes da chamada e grava o resumo', async () => {
    const { root, imagePath } = repoWith('festa.png', Buffer.from([1, 2]));
    const summary = path.join(root, 'summary.md');
    const stdout: string[] = [];
    let requested = false;
    const discord = client(async (method, apiPath, body) => {
      expect(stdout.some((chunk) => chunk.startsWith('::add-mask::'))).toBe(true);
      requested = true;
      if (apiPath === '/applications/@me') return { id: APPLICATION_ID };
      if (method === 'GET') return { items: [] };
      expect(body).toMatchObject({ name: 'festa' });
      return { id: EMOJI_ID, name: 'festa' };
    });

    const code = await runEmojiProd({
      env: {
        DISCORD_BOT_TOKEN: `  ${TOKEN}\n`,
        EMOJI_NAME: 'festa',
        EMOJI_IMAGE_PATH: imagePath,
        GITHUB_STEP_SUMMARY: summary,
      },
      repoRoot: root,
      writeStdout: (chunk) => { stdout.push(chunk); },
      writeStderr: () => undefined,
      discord,
    });

    expect(code).toBe(0);
    expect(requested).toBe(true);
    expect(stdout[0]).toBe(`::add-mask::${TOKEN}\n`);
    expect(stdout.join('')).toContain(`Emoji criado: festa (${EMOJI_ID})`);
    expect(stdout.join('')).not.toContain('Authorization');
    const { readFileSync } = await import('node:fs');
    expect(readFileSync(summary, 'utf8')).toContain(`- ID: \`${EMOJI_ID}\``);
  });

  it('falha sem chamar o Discord quando o segredo está vazio', async () => {
    const stderr: string[] = [];
    const discord = client(async () => {
      throw new Error('não deveria chamar');
    });
    const code = await runEmojiProd({
      env: { DISCORD_BOT_TOKEN: '   ', EMOJI_NAME: 'festa', EMOJI_IMAGE_PATH: 'assets/emojis/a.png' },
      repoRoot: process.cwd(),
      writeStdout: () => undefined,
      writeStderr: (chunk) => { stderr.push(chunk); },
      discord,
    });
    expect(code).toBe(1);
    expect(stderr.join('')).toMatch(/DISCORD_BOT_TOKEN/u);
    expect(discord.request).not.toHaveBeenCalled();
  });

  it('omite o token se uma falha o repetir', async () => {
    const { root, imagePath } = repoWith('festa.png', Buffer.from([1]));
    const stderr: string[] = [];
    const discord = client(async () => {
      throw new Error(`vazou ${TOKEN}`);
    });
    const code = await runEmojiProd({
      env: { DISCORD_BOT_TOKEN: TOKEN, EMOJI_NAME: 'festa', EMOJI_IMAGE_PATH: imagePath },
      repoRoot: root,
      writeStdout: () => undefined,
      writeStderr: (chunk) => { stderr.push(chunk); },
      discord,
    });
    expect(code).toBe(1);
    expect(stderr.join('')).toBe('Falha ao criar o emoji.\n');
    expect(stderr.join('')).not.toContain(TOKEN);
  });
});

describe('segredo e resumo', () => {
  it('recusa token com espaço interno', () => {
    expect(() => normalizeBotToken('um token')).toThrow(EmojiProdError);
  });

  it('não grava resumo sem o arquivo do Actions', () => {
    expect(() => writeJobSummary('### Emoji', {})).not.toThrow();
  });

  it('mascara só valor não vazio', () => {
    const chunks: string[] = [];
    maskSecret('', (chunk) => { chunks.push(chunk); });
    maskSecret('abc', (chunk) => { chunks.push(chunk); });
    expect(chunks).toEqual(['::add-mask::abc\n']);
  });
});
