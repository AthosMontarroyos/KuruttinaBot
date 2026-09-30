import { describe, expect, it, vi } from 'vitest';
import { createEmojiImportService, type EmojiImportDeps } from '../apps/bot/src/application/emojis/importEmoji.js';
import {
  DEFAULT_EMOJI_IMAGE_LIMITS,
  DISCORD_APPLICATION_EMOJI_LIMIT,
  EmojiImportError,
  emojiError,
  type CompressedImage,
  type EmojiCreationPort,
  type EmojiDestination,
  type EmojiImageProcessor,
  type PreparedEmojiImage,
} from '../apps/bot/src/application/emojis/types.js';

const PNG_BYTES = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);

const COMPRESSION: CompressedImage = {
  bytes: Uint8Array.from([9, 9]),
  contentType: 'image/png',
  animated: false,
  width: 32,
  height: 32,
  transformations: [],
};

interface DepsStub {
  readonly deps: EmojiImportDeps;
  readonly download: ReturnType<typeof vi.fn>;
  readonly create: {
    countApplicationEmojis: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
  readonly processor: EmojiImageProcessor;
}

function depsStub(): DepsStub {
  const download = vi.fn(async () => PNG_BYTES);
  const countApplicationEmojis = vi.fn(async () => 10);
  const createEmoji = vi.fn(
    async (_destination: EmojiDestination, name: string, _image: PreparedEmojiImage) => ({
      id: '41771983429993937',
      name,
    }),
  );
  const processor: EmojiImageProcessor = {
    inspect: vi.fn(async () => ({ format: 'png' as const, width: 100, height: 100, frames: 1, totalDurationMs: 0 })),
    compress: vi.fn(async () => COMPRESSION),
  };
  const create: EmojiCreationPort = { countApplicationEmojis, create: createEmoji };
  return {
    deps: { download, processor, create },
    download,
    create: { countApplicationEmojis, create: createEmoji },
    processor,
  };
}

async function expectErrorCode(promise: Promise<unknown>, code: string): Promise<void> {
  await expect(promise).rejects.toBeInstanceOf(EmojiImportError);
  await expect(promise).rejects.toMatchObject({ code });
}

const GUILD_EMOJI_URL = 'https://cdn.discordapp.com/emojis/123456789012345678.gif?size=128&quality=lossless';
const GUILD_EMOJI_URL_PNG = 'https://cdn.discordapp.com/emojis/123456789012345678.png?size=128&quality=lossless';

describe('importação de emojis', () => {
  it('importa emoji de guild para os Application Emojis do bot', async () => {
    const stub = depsStub();
    const service = createEmojiImportService(stub.deps);

    const result = await service.importEmoji({
      source: { kind: 'guild-emoji', ref: '<a:festinha:123456789012345678>' },
      destination: { kind: 'application' },
    });

    expect(stub.download).toHaveBeenCalledWith(GUILD_EMOJI_URL, {
      maxBytes: DEFAULT_EMOJI_IMAGE_LIMITS.maxInputBytes,
      timeoutMs: DEFAULT_EMOJI_IMAGE_LIMITS.downloadTimeoutMs,
    });
    expect(stub.create.countApplicationEmojis).toHaveBeenCalledTimes(1);
    expect(stub.create.create).toHaveBeenCalledWith({ kind: 'application' }, 'festinha', expect.anything());
    expect(result.created).toEqual({ id: '41771983429993937', name: 'festinha' });
    expect(result.image.sourceBytes).toBe(PNG_BYTES.byteLength);
  });

  it('tenta o GIF animado antes e cai para PNG quando não existe', async () => {
    const stub = depsStub();
    stub.download
      .mockRejectedValueOnce(emojiError('source_missing', 'não achado'))
      .mockResolvedValueOnce(PNG_BYTES);
    const service = createEmojiImportService(stub.deps);

    await service.importEmoji({
      source: { kind: 'guild-emoji', ref: '<:stats:123456789012345678>' },
      destination: { kind: 'application' },
    });

    const urls = stub.download.mock.calls.map((call: unknown[]) => call[0]);
    expect(urls).toEqual([GUILD_EMOJI_URL, GUILD_EMOJI_URL_PNG]);
  });

  it('rejeita referência de emoji inválida antes de qualquer rede', async () => {
    const stub = depsStub();
    const service = createEmojiImportService(stub.deps);

    await expectErrorCode(
      service.importEmoji({
        source: { kind: 'guild-emoji', ref: '<a:x:123>' },
        destination: { kind: 'application' },
      }),
      'invalid_source',
    );
    expect(stub.download).not.toHaveBeenCalled();
    expect(stub.create.countApplicationEmojis).not.toHaveBeenCalled();
  });

  it('valida nome explícito antes de qualquer rede', async () => {
    const stub = depsStub();
    const service = createEmojiImportService(stub.deps);

    await expectErrorCode(
      service.importEmoji({
        source: { kind: 'guild-emoji', ref: '<:stats:123456789012345678>' },
        destination: { kind: 'application' },
        name: 'nome com espaço',
      }),
      'invalid_name',
    );
    expect(stub.download).not.toHaveBeenCalled();
  });

  it('exige nome quando a origem só tem um ID', async () => {
    const stub = depsStub();
    const service = createEmojiImportService(stub.deps);

    await expectErrorCode(
      service.importEmoji({
        source: { kind: 'guild-emoji', ref: '123456789012345678' },
        destination: { kind: 'application' },
      }),
      'invalid_name',
    );
    expect(stub.download).not.toHaveBeenCalled();
  });

  it('aceita ID puro quando um nome explícito é informado', async () => {
    const stub = depsStub();
    const service = createEmojiImportService(stub.deps);

    const result = await service.importEmoji({
      source: { kind: 'guild-emoji', ref: '123456789012345678' },
      destination: { kind: 'application' },
      name: 'legal_emoji',
    });

    expect(result.created.name).toBe('legal_emoji');
    expect(stub.download).toHaveBeenCalledWith(GUILD_EMOJI_URL, expect.anything());
  });

  it('deriva o nome do anexo quando o filename é aproveitável', async () => {
    const stub = depsStub();
    const service = createEmojiImportService(stub.deps);

    const result = await service.importEmoji({
      source: { kind: 'attachment', url: 'https://media.discordapp.net/attachments/1/2/party_cat.png' },
      destination: { kind: 'application' },
    });

    expect(stub.download).toHaveBeenCalledWith('https://media.discordapp.net/attachments/1/2/party_cat.png', {
      maxBytes: DEFAULT_EMOJI_IMAGE_LIMITS.maxInputBytes,
      timeoutMs: DEFAULT_EMOJI_IMAGE_LIMITS.downloadTimeoutMs,
    });
    expect(result.created.name).toBe('party_cat');
  });

  it('exige nome quando o filename do anexo não serve', async () => {
    const stub = depsStub();
    const service = createEmojiImportService(stub.deps);

    await expectErrorCode(
      service.importEmoji({
        source: { kind: 'attachment', url: 'https://media.discordapp.net/attachments/1/2/party-cat.png' },
        destination: { kind: 'application' },
      }),
      'invalid_name',
    );
    expect(stub.download).not.toHaveBeenCalled();
  });

  it('aceita anexo com filename inválido quando o nome é explícito', async () => {
    const stub = depsStub();
    const service = createEmojiImportService(stub.deps);

    const result = await service.importEmoji({
      source: { kind: 'attachment', url: 'https://media.discordapp.net/attachments/1/2/party-cat.png' },
      destination: { kind: 'application' },
      name: 'party_cat',
    });

    expect(result.created.name).toBe('party_cat');
    expect(stub.download).toHaveBeenCalledTimes(1);
  });

  it('prefere o filename informado ao segmento da URL', async () => {
    const stub = depsStub();
    const service = createEmojiImportService(stub.deps);

    const result = await service.importEmoji({
      source: {
        kind: 'attachment',
        url: 'https://media.discordapp.net/attachments/1/2/party-cat.png',
        filename: 'party_cat.png',
      },
      destination: { kind: 'application' },
    });

    expect(result.created.name).toBe('party_cat');
  });

  it('recusa antes do download quando o tamanho declarado excede o limite', async () => {
    const stub = depsStub();
    const service = createEmojiImportService(stub.deps);

    await expectErrorCode(
      service.importEmoji({
        source: {
          kind: 'attachment',
          url: 'https://media.discordapp.net/attachments/1/2/huge.png',
          filename: 'huge.png',
          size: DEFAULT_EMOJI_IMAGE_LIMITS.maxInputBytes + 1,
        },
        destination: { kind: 'application' },
      }),
      'input_too_large',
    );
    expect(stub.download).not.toHaveBeenCalled();
  });

  it('falha barato quando o bot principal está no limite de Application Emojis', async () => {
    const stub = depsStub();
    stub.create.countApplicationEmojis.mockResolvedValue(DISCORD_APPLICATION_EMOJI_LIMIT);
    const service = createEmojiImportService(stub.deps);

    await expectErrorCode(
      service.importEmoji({
        source: { kind: 'guild-emoji', ref: '<:stats:123456789012345678>' },
        destination: { kind: 'application' },
      }),
      'capacity_reached',
    );
    expect(stub.download).not.toHaveBeenCalled();
    expect(stub.create.create).not.toHaveBeenCalled();
  });

  it('não consulta a cota do bot para destino em servidor', async () => {
    const stub = depsStub();
    const service = createEmojiImportService(stub.deps);

    await service.importEmoji({
      source: { kind: 'guild-emoji', ref: '<:stats:123456789012345678>' },
      destination: { kind: 'guild', guildId: '123456789012345678' },
    });

    expect(stub.create.countApplicationEmojis).not.toHaveBeenCalled();
    expect(stub.create.create).toHaveBeenCalledWith(
      { kind: 'guild', guildId: '123456789012345678' },
      'stats',
      expect.anything(),
    );
  });

  it('propaga falha de download', async () => {
    const stub = depsStub();
    stub.download.mockRejectedValue(emojiError('download_failed', 'timeout'));
    const service = createEmojiImportService(stub.deps);

    await expectErrorCode(
      service.importEmoji({
        source: { kind: 'guild-emoji', ref: '<:stats:123456789012345678>' },
        destination: { kind: 'application' },
      }),
      'download_failed',
    );
    expect(stub.create.create).not.toHaveBeenCalled();
  });

  it('rejeita novas solicitações quando a fila de espera está cheia', async () => {
    const stub = depsStub();
    let release!: (bytes: Uint8Array) => void;
    stub.download.mockImplementation(
      () =>
        new Promise<Uint8Array>((resolve) => {
          release = resolve;
        }),
    );
    const service = createEmojiImportService(stub.deps, { queue: { concurrency: 1, maxQueued: 0 } });

    const first = service.importEmoji({
      source: { kind: 'guild-emoji', ref: '<:stats:123456789012345678>' },
      destination: { kind: 'application' },
    });
    await expectErrorCode(
      service.importEmoji({
        source: { kind: 'guild-emoji', ref: '<:stats:123456789012345678>' },
        destination: { kind: 'application' },
      }),
      'queue_full',
    );

    release(PNG_BYTES);
    await expect(first).resolves.toMatchObject({ created: { name: 'stats' } });
  });

  it('processa na sequência quando a fila tem espaço', async () => {
    const stub = depsStub();
    const service = createEmojiImportService(stub.deps, { queue: { concurrency: 1, maxQueued: 1 } });

    const [first, second] = [
      service.importEmoji({
        source: { kind: 'guild-emoji', ref: '<:stats:123456789012345678>' },
        destination: { kind: 'application' },
      }),
      service.importEmoji({
        source: { kind: 'guild-emoji', ref: '<:festinha:1234567890123456789>' },
        destination: { kind: 'application' },
      }),
    ];

    await expect(first).resolves.toMatchObject({ created: { name: 'stats' } });
    await expect(second).resolves.toMatchObject({ created: { name: 'festinha' } });
    expect(stub.create.create).toHaveBeenCalledTimes(2);
  });
});
