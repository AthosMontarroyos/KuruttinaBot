import { existsSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';
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
  readEmojiImage,
  runEmojiProd,
  validateEmojiName,
  writeJobSummary,
  type DiscordClient,
} from '../scripts/add-production-emoji.js';

const APPLICATION_ID = '123456789012345678';
const EMOJI_ID = '223456789012345678';
const TOKEN = 'prod-token-should-stay-hidden';

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
const GIF = Buffer.from('GIF89aok', 'ascii');
const WEBP = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP')]);

function imageFile(bytes: Buffer): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'emoji-prod-'));
  const file = path.join(dir, 'imagem');
  writeFileSync(file, bytes);
  return file;
}

function sized(signature: Buffer, length: number): Buffer {
  const bytes = Buffer.alloc(length);
  signature.copy(bytes);
  return bytes;
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

describe('readEmojiImage', () => {
  it.each([
    ['image/png', PNG, 'image/png'],
    ['image/jpeg', JPEG, 'image/jpeg'],
    ['image/jpg', JPEG, 'image/jpeg'],
    ['image/gif', GIF, 'image/gif'],
    ['image/webp; charset=binary', WEBP, 'image/webp'],
  ] as const)('aceita %s quando a assinatura confere', (contentType, bytes, mediaType) => {
    const image = readEmojiImage(imageFile(bytes), contentType);
    expect(image.mediaType).toBe(mediaType);
    expect(image.bytes).toEqual(bytes);
  });

  it('aceita GIF87a e exatamente 256 KiB', () => {
    const gif = Buffer.from('GIF87aok', 'ascii');
    expect(readEmojiImage(imageFile(gif), 'image/gif').mediaType).toBe('image/gif');
    const limit = sized(PNG, MAX_EMOJI_IMAGE_BYTES);
    expect(readEmojiImage(imageFile(limit), 'image/png').bytes.length).toBe(MAX_EMOJI_IMAGE_BYTES);
  });

  it('recusa arquivo maior que 256 KiB, vazio ou com tipo divergente', () => {
    expect(() => readEmojiImage(imageFile(sized(PNG, MAX_EMOJI_IMAGE_BYTES + 1)), 'image/png')).toThrow(/256 KiB/u);
    expect(() => readEmojiImage(imageFile(Buffer.alloc(0)), 'image/png')).toThrow(EmojiProdError);
    expect(() => readEmojiImage(imageFile(PNG), 'image/gif')).toThrow(/conferir/u);
    expect(() => readEmojiImage(imageFile(Buffer.from('RIFF????WAVE')), 'image/webp')).toThrow(/PNG, JPEG, GIF ou WEBP/u);
    expect(() => readEmojiImage(imageFile(PNG), 'text/plain')).toThrow(/PNG, JPEG, GIF ou WEBP/u);
  });

  it('recusa caminho ausente, relativo ou link', () => {
    expect(() => readEmojiImage(path.join(tmpdir(), 'ausente-emoji'), 'image/png')).toThrow(/Não encontrei/u);
    expect(() => readEmojiImage('relativo.png', 'image/png')).toThrow(/Não encontrei/u);
    const target = imageFile(PNG);
    const link = path.join(path.dirname(target), 'atalho');
    symlinkSync(target, link);
    expect(() => readEmojiImage(link, 'image/png')).toThrow(/arquivo/u);
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
    const image = readEmojiImage(imageFile(PNG), 'image/png');

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
    const image = readEmojiImage(imageFile(JPEG), 'image/jpeg');

    await expect(addProductionEmoji(discord, 'festa_01', image)).resolves.toEqual({
      id: EMOJI_ID,
      name: 'festa_01',
    });
    expect(posted).toEqual({
      name: 'festa_01',
      image: `data:image/jpeg;base64,${JPEG.toString('base64')}`,
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
  it('mascara o token antes da chamada, grava o resumo e apaga o arquivo', async () => {
    const file = imageFile(PNG);
    const summary = path.join(path.dirname(file), 'summary.md');
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
        EMOJI_IMAGE_FILE: file,
        EMOJI_CONTENT_TYPE: 'image/png',
        GITHUB_STEP_SUMMARY: summary,
      },
      writeStdout: (chunk) => { stdout.push(chunk); },
      writeStderr: () => undefined,
      discord,
    });

    expect(code).toBe(0);
    expect(requested).toBe(true);
    expect(existsSync(file)).toBe(false);
    expect(stdout[0]).toBe(`::add-mask::${TOKEN}\n`);
    expect(stdout.slice(1).join('')).toContain(`Emoji criado: festa (${EMOJI_ID})`);
    expect(stdout.slice(1).join('')).not.toContain(TOKEN);
    expect(stdout.join('')).not.toContain('Authorization');
    expect(readFileSync(summary, 'utf8')).toContain(`- ID: \`${EMOJI_ID}\``);
  });

  it('falha sem chamar o Discord quando o segredo está vazio e ainda apaga a imagem', async () => {
    const file = imageFile(PNG);
    const stderr: string[] = [];
    const discord = client(async () => {
      throw new Error('não deveria chamar');
    });
    const code = await runEmojiProd({
      env: {
        DISCORD_BOT_TOKEN: '   ',
        EMOJI_NAME: 'festa',
        EMOJI_IMAGE_FILE: file,
        EMOJI_CONTENT_TYPE: 'image/png',
      },
      writeStdout: () => undefined,
      writeStderr: (chunk) => { stderr.push(chunk); },
      discord,
    });
    expect(code).toBe(1);
    expect(stderr.join('')).toMatch(/DISCORD_BOT_TOKEN/u);
    expect(existsSync(file)).toBe(false);
    expect(discord.request).not.toHaveBeenCalled();
  });

  it('omite o token se uma falha o repetir', async () => {
    const file = imageFile(PNG);
    const stderr: string[] = [];
    const discord = client(async () => {
      throw new Error(`vazou ${TOKEN}`);
    });
    const code = await runEmojiProd({
      env: {
        DISCORD_BOT_TOKEN: TOKEN,
        EMOJI_NAME: 'festa',
        EMOJI_IMAGE_FILE: file,
        EMOJI_CONTENT_TYPE: 'image/png',
      },
      writeStdout: () => undefined,
      writeStderr: (chunk) => { stderr.push(chunk); },
      discord,
    });
    expect(code).toBe(1);
    expect(stderr.join('')).toBe('Falha ao criar o emoji.\n');
    expect(stderr.join('')).not.toContain(TOKEN);
    expect(existsSync(file)).toBe(false);
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

describe('emoji-prod.yml', () => {
  const workflow = readFileSync(new URL('../.github/workflows/emoji-prod.yml', import.meta.url), 'utf8');
  const download = workflow.slice(workflow.indexOf('Baixar a imagem'), workflow.indexOf('Criar emoji'));

  it('baixa por URL HTTPS no diretório temporário e não versiona a imagem', () => {
    expect(workflow).toContain('image_url:');
    expect(workflow).not.toContain('image_path');
    expect(workflow).not.toContain('assets/emojis');
    expect(download).toContain('RUNNER_TEMP');
    expect(download).toContain("curl --fail --silent --show-error");
    expect(download).toContain("--proto '=https'");
    expect(download).toContain("--proto-redir '=https'");
    expect(download).toContain('--max-redirs 5');
    expect(download).toContain('--connect-timeout 10');
    expect(download).toContain('--max-time 20');
    expect(download).toContain(`--max-filesize ${MAX_EMOJI_IMAGE_BYTES}`);
    expect(download).not.toContain('DOPPLER_TOKEN');
    expect(download).not.toContain('DISCORD_BOT_TOKEN');
    expect(workflow).toContain('doppler run --only-secrets DISCORD_BOT_TOKEN');
    expect(workflow).toContain('rm -f "${RUNNER_TEMP}/kuruttina-emoji"');
    expect(workflow).not.toMatch(/echo [^"\n]*\$\{?DOPPLER_TOKEN/u);
    expect(workflow).not.toMatch(/echo [^"\n]*\$\{?DISCORD_BOT_TOKEN/u);
  });
});
