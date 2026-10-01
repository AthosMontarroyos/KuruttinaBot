import type { Client } from 'discord.js';
import { describe, expect, it, vi } from 'vitest';
import { emojiError, type PreparedEmojiImage } from '../apps/bot/src/application/emojis/types.js';
import { createDiscordEmojiAdapter } from '../apps/bot/src/infrastructure/discord/emojiAdapter.js';
import type { ProductionApplicationEmojiPort, ProductionEmojiAudit } from '../apps/bot/src/infrastructure/discord/productionApplicationEmojis.js';

const IMAGE: PreparedEmojiImage = {
  bytes: Uint8Array.from([1, 2, 3]),
  contentType: 'image/gif',
  animated: true,
  width: 1,
  height: 1,
  sourceBytes: 3,
  transformations: [],
};

interface FakeClient {
  readonly client: Client;
  readonly appEmojis: {
    fetch: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
  readonly guildEmojis: { create: ReturnType<typeof vi.fn> };
  readonly guildsFetch: ReturnType<typeof vi.fn>;
}

function fakeProduction(): {
  readonly port: ProductionApplicationEmojiPort;
  readonly count: ReturnType<typeof vi.fn>;
  readonly create: ReturnType<typeof vi.fn>;
} {
  const count = vi.fn(async () => 7);
  const create = vi.fn(async (name: string, _image: PreparedEmojiImage, _audit?: ProductionEmojiAudit) => ({ id: '111', name }));
  return { port: { count, create }, count, create };
}

function fakeClient(options?: { readonly withoutApplication?: boolean; readonly guildFetchFails?: boolean }): FakeClient {
  const appEmojis = {
    fetch: vi.fn(async () => ({ size: 7 })),
    create: vi.fn(async (payload: { attachment: string; name: string }) => ({ id: '111', name: payload.name })),
  };
  const guildEmojis = {
    create: vi.fn(async (payload: { attachment: string; name: string }) => ({ id: '222', name: payload.name })),
  };
  const guildsFetch = vi.fn(async () => {
    if (options?.guildFetchFails) throw new Error('Unknown Guild');
    return { emojis: guildEmojis };
  });
  const client = {
    ...(options?.withoutApplication ? {} : { application: { emojis: appEmojis } }),
    guilds: { fetch: guildsFetch },
    // Estrutura mínima em forma de Client real; só os métodos usados são chamados.
  } as unknown as Client;
  return { client, appEmojis, guildEmojis, guildsFetch };
}

async function expectErrorCode(promise: Promise<unknown>, code: string): Promise<void> {
  await expect(promise).rejects.toMatchObject({ code });
}

describe('adapter Discord de emojis', () => {
  it('consulta Application Emojis no bot de produção, não no client conectado', async () => {
    const fake = fakeClient({ withoutApplication: true });
    const production = fakeProduction();
    const adapter = createDiscordEmojiAdapter(fake.client, production.port);

    await expect(adapter.countApplicationEmojis()).resolves.toBe(7);

    expect(production.count).toHaveBeenCalledOnce();
    expect(fake.appEmojis.fetch).not.toHaveBeenCalled();
  });

  it('repassa a falha ao consultar o bot de produção', async () => {
    const production = fakeProduction();
    production.count.mockRejectedValue(emojiError('destination_unavailable', 'Não consegui consultar os Application Emojis do bot de produção.'));
    const adapter = createDiscordEmojiAdapter(fakeClient().client, production.port);

    await expectErrorCode(adapter.countApplicationEmojis(), 'destination_unavailable');
  });

  it('cria Application Emoji só pela capability de produção', async () => {
    const fake = fakeClient();
    const production = fakeProduction();
    const adapter = createDiscordEmojiAdapter(fake.client, production.port);

    const created = await adapter.create(
      { kind: 'application', actorUserId: '123456789012345678', guildId: '223456789012345678' },
      'festinha',
      IMAGE,
    );

    expect(created).toEqual({ id: '111', name: 'festinha' });
    expect(production.create).toHaveBeenCalledWith('festinha', IMAGE, {
      userId: '123456789012345678',
      guildId: '223456789012345678',
    });
    expect(fake.appEmojis.create).not.toHaveBeenCalled();
    expect(fake.appEmojis.fetch).not.toHaveBeenCalled();
  });

  it('cria emoji em servidor buscando a guild no Discord', async () => {
    const fake = fakeClient();
    const production = fakeProduction();
    const adapter = createDiscordEmojiAdapter(fake.client, production.port);

    const created = await adapter.create({ kind: 'guild', guildId: '123456789012345678' }, 'stats', IMAGE);

    expect(fake.guildsFetch).toHaveBeenCalledWith('123456789012345678');
    expect(production.create).not.toHaveBeenCalled();
    const payload = fake.guildEmojis.create.mock.calls[0]?.[0] as { attachment: string; name: string };
    expect(payload.attachment).toMatch(/^data:image\/gif;base64,/u);
    expect(created).toEqual({ id: '222', name: 'stats' });
  });

  it('mapeia guild inacessível para destino indisponível', async () => {
    const fake = fakeClient({ guildFetchFails: true });
    const adapter = createDiscordEmojiAdapter(fake.client, fakeProduction().port);
    await expectErrorCode(
      adapter.create({ kind: 'guild', guildId: '123456789012345678' }, 'stats', IMAGE),
      'destination_unavailable',
    );
    expect(fake.guildEmojis.create).not.toHaveBeenCalled();
  });

  it.each([30008, 30018, 30056])('mapeia o código %i de capacidade do Discord', async (code) => {
    const fake = fakeClient();
    fake.guildEmojis.create.mockRejectedValue(Object.assign(new Error('maximum reached'), { code }));
    const adapter = createDiscordEmojiAdapter(fake.client, fakeProduction().port);

    await expectErrorCode(
      adapter.create({ kind: 'guild', guildId: '123456789012345678' }, 'stats', IMAGE),
      'capacity_reached',
    );
  });

  it('sanitiza falha de capacidade vinda da capability de produção', async () => {
    const production = fakeProduction();
    production.create.mockRejectedValue(Object.assign(new Error('maximum reached token=abc'), { code: 30018 }));
    const adapter = createDiscordEmojiAdapter(fakeClient().client, production.port);

    const error = await adapter.create({ kind: 'application' }, 'stats', IMAGE).catch((caught: unknown) => caught);
    expect(error).toMatchObject({ code: 'capacity_reached' });
    expect((error as Error).message).not.toContain('token=abc');
  });

  it('sanitiza outros erros da API do Discord', async () => {
    const fake = fakeClient();
    fake.guildEmojis.create.mockRejectedValue(new Error('Internal Server Error token=abc'));
    const adapter = createDiscordEmojiAdapter(fake.client, fakeProduction().port);

    const error = await adapter
      .create({ kind: 'guild', guildId: '123456789012345678' }, 'stats', IMAGE)
      .catch((caught: unknown) => caught);
    expect(error).toMatchObject({ code: 'create_failed' });
    expect((error as Error).message).not.toContain('token=abc');
  });
});
