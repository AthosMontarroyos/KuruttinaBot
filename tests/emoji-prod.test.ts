import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { describe, expect, it, vi } from 'vitest';
import {
  DISCORD_EMOJI_MAX_BYTES,
  emojiError,
  type EmojiDownloadPort,
  type EmojiImageProcessor,
} from '../apps/bot/src/application/emojis/types.js';
import { createDiscordImageDownloader } from '../apps/bot/src/infrastructure/images/downloadDiscordImage.js';
import { createSharpEmojiProcessor } from '../apps/bot/src/infrastructure/images/sharpEmojiProcessor.js';
import {
  deriveProductionEmojiName,
  firstFreeApplicationEmojiName,
  sanitizeApplicationEmojiName,
} from '../apps/bot/src/application/emojis/productionEmojiName.js';
import {
  EmojiProdError,
  addProductionEmoji,
  createDiscordClient,
  createProductionEmojiProcessor,
  createProductionImageDownloader,
  maskSecret,
  normalizeBotToken,
  resolveProductionSource,
  runEmojiProd,
  validateEmojiName,
  writeJobSummary,
  type DiscordClient,
  type ProductionEmojiImage,
} from '../scripts/add-production-emoji.js';

const APPLICATION_ID = '123456789012345678';
const EMOJI_ID = '223456789012345678';
const SOURCE_ID = '123456789012345678';
const TOKEN = 'prod-token-should-stay-hidden';
const GIF_URL = `https://cdn.discordapp.com/emojis/${SOURCE_ID}.gif?size=128&quality=lossless`;
const PNG_URL = `https://cdn.discordapp.com/emojis/${SOURCE_ID}.png?size=128&quality=lossless`;

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);

const prepared: ProductionEmojiImage = {
  bytes: new Uint8Array([1, 2, 3, 4]),
  contentType: 'image/png',
};

function client(handler: DiscordClient['request']): DiscordClient {
  return { request: vi.fn(handler) };
}

function fakeProcessor(bytes: Uint8Array = prepared.bytes): EmojiImageProcessor {
  return {
    inspect: vi.fn(async () => ({ format: 'png' as const, width: 16, height: 16, frames: 1, totalDurationMs: 0 })),
    compress: vi.fn(async () => ({
      bytes,
      contentType: 'image/png' as const,
      animated: false,
      width: 16,
      height: 16,
      transformations: ['normalized_128' as const],
    })),
  };
}

function io(overrides: Partial<Parameters<typeof runEmojiProd>[0]> & { env?: NodeJS.ProcessEnv } = {}) {
  const stderr: string[] = [];
  const stdout: string[] = [];
  return {
    stderr,
    stdout,
    options: {
      env: {
        DISCORD_BOT_TOKEN: TOKEN,
        EMOJI_NAME: 'festa',
        EMOJI_SOURCE: SOURCE_ID,
        ...overrides.env,
      },
      writeStdout: (chunk: string) => { stdout.push(chunk); },
      writeStderr: (chunk: string) => { stderr.push(chunk); },
      download: overrides.download,
      processor: overrides.processor,
      discord: overrides.discord,
    },
  };
}

describe('pipeline compartilhado', () => {
  const script = readFileSync(new URL('../scripts/add-production-emoji.ts', import.meta.url), 'utf8');
  const importer = readFileSync(new URL('../apps/bot/src/application/emojis/importEmoji.ts', import.meta.url), 'utf8');
  const bootstrap = readFileSync(new URL('../apps/bot/src/bootstrap.ts', import.meta.url), 'utf8');
  const processorSource = readFileSync(new URL('../apps/bot/src/infrastructure/images/sharpEmojiProcessor.ts', import.meta.url), 'utf8');

  it('reexporta as mesmas fábricas do bot', () => {
    expect(createProductionEmojiProcessor).toBe(createSharpEmojiProcessor);
    expect(createProductionImageDownloader).toBe(createDiscordImageDownloader);
    expect(bootstrap).toContain('createSharpEmojiProcessor()');
    expect(bootstrap).toContain('createDiscordImageDownloader()');
    expect(script).toContain('downloadDiscordEmojiById');
    expect(script).not.toContain('cdn.discordapp.com/emojis');
    expect(script).not.toContain('RUNNER_TEMP');
    expect(importer).toContain('export async function downloadDiscordEmojiById');
    expect(processorSource).toContain('files: 0');
  });
});

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

describe('resolveProductionSource', () => {
  it('aceita ID, marcação e URL HTTPS', () => {
    expect(resolveProductionSource(`  ${SOURCE_ID} `)).toEqual({ kind: 'id', id: SOURCE_ID });
    expect(resolveProductionSource(`<:festa:${SOURCE_ID}>`)).toEqual({
      kind: 'id',
      id: SOURCE_ID,
      hintedName: 'festa',
    });
    expect(resolveProductionSource(`<a:festinha:${SOURCE_ID}>`)).toEqual({
      kind: 'id',
      id: SOURCE_ID,
      hintedName: 'festinha',
    });
    expect(resolveProductionSource(`festa:${SOURCE_ID}`)).toEqual({
      kind: 'id',
      id: SOURCE_ID,
      hintedName: 'festa',
    });
    expect(resolveProductionSource('https://cdn.discordapp.com/emojis/1.png')).toEqual({
      kind: 'url',
      url: 'https://cdn.discordapp.com/emojis/1.png',
    });
  });

  it('recusa HTTP, usuário na URL e texto solto', () => {
    expect(() => resolveProductionSource('http://cdn.discordapp.com/emojis/1.png')).toThrow(/HTTPS/u);
    expect(() => resolveProductionSource('https://user:pass@cdn.discordapp.com/emojis/1.png')).toThrow(/HTTPS/u);
    expect(() => resolveProductionSource('não é origem')).toThrow(/ID de um emoji/u);
  });
});

describe('nome derivado e nome livre', () => {
  it('sanitiza arquivo e marcação e preserva nome que já é válido', () => {
    expect(sanitizeApplicationEmojiName('  festa_01 ')).toBe('festa_01');
    expect(sanitizeApplicationEmojiName('ab_')).toBe('ab_');
    expect(sanitizeApplicationEmojiName('party-cat')).toBe('party_cat');
    expect(sanitizeApplicationEmojiName('coração')).toBe('coracao');
    expect(sanitizeApplicationEmojiName('my   emoji')).toBe('my_emoji');
    expect(sanitizeApplicationEmojiName('a'.repeat(40))).toBe('a'.repeat(32));
    expect(sanitizeApplicationEmojiName('a')).toBeUndefined();
    expect(sanitizeApplicationEmojiName('---')).toBeUndefined();
  });

  it('deriva da marcação, do arquivo e da URL, e recusa ID puro ou nome curto', () => {
    expect(deriveProductionEmojiName({ kind: 'mention', name: 'festinha' })).toEqual({
      status: 'ready',
      name: 'festinha',
    });
    expect(deriveProductionEmojiName({ kind: 'filename', filename: 'party-cat.png' })).toEqual({
      status: 'ready',
      name: 'party_cat',
    });
    expect(deriveProductionEmojiName({
      kind: 'url',
      url: 'https://cdn.discordapp.com/attachments/1/2/cora%C3%A7%C3%A3o.png',
    })).toEqual({ status: 'ready', name: 'coracao' });
    expect(deriveProductionEmojiName({ kind: 'filename', filename: 'a.png' })).toEqual({ status: 'invalid' });
    expect(deriveProductionEmojiName({ kind: 'id' })).toEqual({ status: 'missing' });
  });

  it('escolhe a base livre ou o primeiro número que cabe em 32 caracteres', () => {
    expect(firstFreeApplicationEmojiName('festa', ['festa2'])).toBe('festa');
    expect(firstFreeApplicationEmojiName('Festa', ['festa'])).toBe('Festa2');
    expect(firstFreeApplicationEmojiName('festa', ['festa', 'festa2', 'Festa3'])).toBe('festa4');
    const full = 'a'.repeat(32);
    expect(firstFreeApplicationEmojiName(full, [full])).toBe(`${'a'.repeat(31)}2`);
    expect(firstFreeApplicationEmojiName(full, [full, `${'a'.repeat(31)}2`])).toBe(`${'a'.repeat(31)}3`);
    expect(firstFreeApplicationEmojiName('a', [])).toBeUndefined();
    const exhausted = ['ab', ...Array.from({ length: 9999 }, (_, index) => `ab${index + 2}`)];
    expect(firstFreeApplicationEmojiName('ab', exhausted)).toBeUndefined();
  });
});

describe('addProductionEmoji', () => {
  it('consulta a aplicação e cria o próximo nome livre, sem apagar', async () => {
    const calls: string[] = [];
    let posted: unknown;
    const discord = client(async (method, apiPath, body) => {
      calls.push(`${method} ${apiPath}`);
      if (apiPath === '/applications/@me') return { id: APPLICATION_ID };
      if (method === 'GET') return { items: [{ name: 'Festa', id: EMOJI_ID }, { name: 'festa2', id: EMOJI_ID }] };
      posted = body;
      return { id: EMOJI_ID, name: 'festa3' };
    });

    await expect(addProductionEmoji(discord, 'festa', prepared)).resolves.toEqual({
      id: EMOJI_ID,
      name: 'festa3',
    });
    expect(posted).toMatchObject({ name: 'festa3' });
    expect(calls).toEqual([
      'GET /applications/@me',
      `GET /applications/${APPLICATION_ID}/emojis`,
      `POST /applications/${APPLICATION_ID}/emojis`,
    ]);
  });

  it('não envia POST quando a lista de emojis é ilegível', async () => {
    const discord = client(async (method, apiPath) => {
      if (apiPath === '/applications/@me') return { id: APPLICATION_ID };
      if (method === 'GET') return { items: 'não' };
      throw new Error('post');
    });

    await expect(addProductionEmoji(discord, 'festa', prepared)).rejects.toThrow(/Application Emojis/u);
  });

  it('envia data URI e devolve o emoji criado', async () => {
    let posted: unknown;
    const discord = client(async (method, apiPath, body) => {
      if (apiPath === '/applications/@me') return { id: APPLICATION_ID };
      if (method === 'GET') return { items: [{ name: 'outro', id: EMOJI_ID }] };
      posted = body;
      return { id: EMOJI_ID, name: 'festa_01' };
    });

    await expect(addProductionEmoji(discord, 'festa_01', prepared)).resolves.toEqual({
      id: EMOJI_ID,
      name: 'festa_01',
    });
    expect(posted).toEqual({
      name: 'festa_01',
      image: `data:image/png;base64,${Buffer.from(prepared.bytes).toString('base64')}`,
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
  it('baixa o ID em gif e depois png pelo helper compartilhado', async () => {
    const urls: string[] = [];
    const download: EmojiDownloadPort = vi.fn(async (url: string) => {
      urls.push(url);
      if (url.includes('.gif?')) throw emojiError('source_missing', 'ausente');
      return PNG;
    });
    const discord = client(async (method, apiPath) => {
      if (apiPath === '/applications/@me') return { id: APPLICATION_ID };
      if (method === 'GET') return { items: [] };
      return { id: EMOJI_ID, name: 'festa' };
    });
    const current = io({ download, processor: fakeProcessor(), discord });

    const code = await runEmojiProd(current.options);

    expect(code).toBe(0);
    expect(urls).toEqual([GIF_URL, PNG_URL]);
  });

  it('não baixa URL HTTP', async () => {
    const download = vi.fn<EmojiDownloadPort>();
    const current = io({ env: { EMOJI_SOURCE: 'http://cdn.discordapp.com/emojis/1.png' }, download });

    const code = await runEmojiProd(current.options);

    expect(code).toBe(1);
    expect(download).not.toHaveBeenCalled();
    expect(current.stderr.join('')).toMatch(/HTTPS/u);
  });

  it('recusa URL HTTPS fora do CDN sem chamar a rede', async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    const current = io({
      env: { EMOJI_SOURCE: 'https://example.com/a.png' },
      download: createDiscordImageDownloader(fetchImpl),
    });

    const code = await runEmojiProd(current.options);

    expect(code).toBe(1);
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(current.stderr.join('')).toMatch(/CDN do Discord/u);
  });

  it('mascara o token antes da chamada e grava o resumo sem arquivo', async () => {
    const summary = path.join(mkdtempSync(path.join(tmpdir(), 'emoji-prod-')), 'summary.md');
    let requested = false;
    const current = io({
      env: { DISCORD_BOT_TOKEN: `  ${TOKEN}\n`, GITHUB_STEP_SUMMARY: summary },
      download: async () => PNG,
      processor: fakeProcessor(),
    });
    current.options.discord = client(async (method, apiPath, body) => {
      expect(current.stdout.some((chunk) => chunk.startsWith('::add-mask::'))).toBe(true);
      requested = true;
      if (apiPath === '/applications/@me') return { id: APPLICATION_ID };
      if (method === 'GET') return { items: [] };
      expect(body).toMatchObject({ name: 'festa' });
      return { id: EMOJI_ID, name: 'festa' };
    });

    const code = await runEmojiProd(current.options);

    expect(code).toBe(0);
    expect(requested).toBe(true);
    expect(current.stdout[0]).toBe(`::add-mask::${TOKEN}\n`);
    expect(current.stdout.slice(1).join('')).toContain(`Emoji criado: festa (${EMOJI_ID})`);
    expect(current.stdout.slice(1).join('')).not.toContain('nome pedido');
    expect(readFileSync(summary, 'utf8')).toContain('- Nome: `festa`');
    expect(readFileSync(summary, 'utf8')).not.toContain('Nome pedido');
    expect(current.stdout.slice(1).join('')).not.toContain(TOKEN);
    expect(current.stdout.join('')).not.toContain('Authorization');
    expect(readFileSync(summary, 'utf8')).toContain(`- ID: \`${EMOJI_ID}\``);
  });

  it('usa o próximo número livre e registra o nome final', async () => {
    const summary = path.join(mkdtempSync(path.join(tmpdir(), 'emoji-prod-')), 'summary.md');
    let posted: unknown;
    const discord = client(async (method, apiPath, body) => {
      if (apiPath === '/applications/@me') return { id: APPLICATION_ID };
      if (method === 'GET') return { items: [{ name: 'festa', id: EMOJI_ID }, { name: 'Festa2', id: EMOJI_ID }] };
      posted = body;
      return { id: EMOJI_ID, name: 'festa3' };
    });
    const current = io({
      env: { GITHUB_STEP_SUMMARY: summary },
      download: async () => PNG,
      processor: fakeProcessor(),
      discord,
    });

    const code = await runEmojiProd(current.options);

    expect(code).toBe(0);
    expect(posted).toMatchObject({ name: 'festa3' });
    expect(current.stdout.join('')).toContain(`Emoji criado: festa3 (${EMOJI_ID}); nome pedido: festa`);
    const text = readFileSync(summary, 'utf8');
    expect(text).toContain('- Nome: `festa3`');
    expect(text).toContain('- Nome pedido: `festa`');
    expect(text).toContain(`- ID: \`${EMOJI_ID}\``);
  });

  it('deriva o nome da marcação, da URL e recusa origem sem nome antes de baixar', async () => {
    const mention = io({
      env: { EMOJI_NAME: '   ', EMOJI_SOURCE: `<:festa:${SOURCE_ID}>` },
      download: async () => PNG,
      processor: fakeProcessor(),
      discord: client(async (method, apiPath, body) => {
        if (apiPath === '/applications/@me') return { id: APPLICATION_ID };
        if (method === 'GET') return { items: [] };
        expect(body).toMatchObject({ name: 'festa' });
        return { id: EMOJI_ID, name: 'festa' };
      }),
    });
    expect(await runEmojiProd(mention.options)).toBe(0);

    let posted: unknown;
    const fromUrl = io({
      env: { EMOJI_NAME: '', EMOJI_SOURCE: 'https://cdn.discordapp.com/attachments/1/2/party-cat.png' },
      download: async () => PNG,
      processor: fakeProcessor(),
      discord: client(async (method, apiPath, body) => {
        if (apiPath === '/applications/@me') return { id: APPLICATION_ID };
        if (method === 'GET') return { items: [] };
        posted = body;
        return { id: EMOJI_ID, name: 'party_cat' };
      }),
    });
    expect(await runEmojiProd(fromUrl.options)).toBe(0);
    expect(posted).toMatchObject({ name: 'party_cat' });

    const bareDownload = vi.fn<EmojiDownloadPort>();
    const bare = io({ env: { EMOJI_NAME: '', EMOJI_SOURCE: SOURCE_ID }, download: bareDownload });
    expect(await runEmojiProd(bare.options)).toBe(1);
    expect(bareDownload).not.toHaveBeenCalled();
    expect(bare.stderr.join('')).toMatch(/não traz um nome/u);

    const shortDownload = vi.fn<EmojiDownloadPort>();
    const short = io({
      env: { EMOJI_NAME: '', EMOJI_SOURCE: 'https://cdn.discordapp.com/attachments/1/2/a.png' },
      download: shortDownload,
    });
    expect(await runEmojiProd(short.options)).toBe(1);
    expect(shortDownload).not.toHaveBeenCalled();
    expect(short.stderr.join('')).toMatch(/não consegui formar um nome válido/iu);

    const outsideDownload = vi.fn<EmojiDownloadPort>();
    const outside = io({
      env: { EMOJI_NAME: '', EMOJI_SOURCE: 'https://example.com/a.png' },
      download: outsideDownload,
    });
    expect(await runEmojiProd(outside.options)).toBe(1);
    expect(outsideDownload).not.toHaveBeenCalled();
    expect(outside.stderr.join('')).toMatch(/CDN do Discord/u);
  });

  it('falha sem chamar o Discord quando o segredo está vazio', async () => {
    const download = vi.fn<EmojiDownloadPort>();
    const discord = client(async () => {
      throw new Error('não deveria chamar');
    });
    const current = io({ env: { DISCORD_BOT_TOKEN: '   ' }, download, discord });

    const code = await runEmojiProd(current.options);

    expect(code).toBe(1);
    expect(current.stderr.join('')).toMatch(/DISCORD_BOT_TOKEN/u);
    expect(download).not.toHaveBeenCalled();
    expect(discord.request).not.toHaveBeenCalled();
  });

  it('omite o token se uma falha o repetir', async () => {
    const discord = client(async () => {
      throw new Error(`vazou ${TOKEN}`);
    });
    const current = io({ download: async () => PNG, processor: fakeProcessor(), discord });

    const code = await runEmojiProd(current.options);

    expect(code).toBe(1);
    expect(current.stderr.join('')).toBe('Falha ao criar o emoji.\n');
    expect(current.stderr.join('')).not.toContain(TOKEN);
  });

  it('comprime imagem acima do limite para caber no Discord', async () => {
    const width = 640;
    const height = 640;
    const raw = Buffer.alloc(width * height * 3);
    for (let index = 0; index < raw.length; index += 1) raw[index] = index % 251;
    const png = await sharp(raw, { raw: { width, height, channels: 3 } }).png({ compressionLevel: 0 }).toBuffer();
    expect(png.byteLength).toBeGreaterThan(DISCORD_EMOJI_MAX_BYTES);

    let posted: unknown;
    const discord = client(async (method, apiPath, body) => {
      if (apiPath === '/applications/@me') return { id: APPLICATION_ID };
      if (method === 'GET') return { items: [] };
      posted = body;
      return { id: EMOJI_ID, name: 'festa' };
    });
    const current = io({
      env: { EMOJI_SOURCE: 'https://cdn.discordapp.com/attachments/1/2/noisy.png' },
      download: async () => png,
      processor: createSharpEmojiProcessor(),
      discord,
    });

    const code = await runEmojiProd(current.options);

    expect(code).toBe(0);
    const image = (posted as { image?: string }).image ?? '';
    expect(image.startsWith('data:image/png;base64,')).toBe(true);
    const decoded = Buffer.from(image.slice('data:image/png;base64,'.length), 'base64');
    expect(decoded.byteLength).toBeLessThanOrEqual(DISCORD_EMOJI_MAX_BYTES);
    expect(decoded.byteLength).toBeLessThan(png.byteLength);
  }, 20_000);
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

  it('cria em memória, sem curl nem arquivo temporário', () => {
    expect(workflow).toContain('source:');
    expect(workflow).not.toContain('image_url');
    expect(workflow).not.toContain('image_path');
    expect(workflow).not.toContain('assets/emojis');
    expect(workflow).not.toContain('curl');
    expect(workflow).not.toContain('RUNNER_TEMP');
    expect(workflow).toContain('environment: production');
    expect(workflow).toMatch(/name:\n\s+description:.*\n\s+required: false/u);
    expect(workflow).toMatch(/source:\n\s+description:.*\n\s+required: true/u);
    expect(workflow).toContain('npm ci --engine-strict');
    expect(workflow).toContain('npm run bot build');
    expect(workflow).toContain('doppler run --only-secrets DISCORD_BOT_TOKEN -- node scripts/add-production-emoji.ts');
    expect(workflow).not.toMatch(/echo [^"\n]*\$\{?DOPPLER_TOKEN/u);
    expect(workflow).not.toMatch(/echo [^"\n]*\$\{?DISCORD_BOT_TOKEN/u);
  });
});
