import type { Client } from 'discord.js';
import { describe, expect, it, vi } from 'vitest';
import type { PreparedEmojiImage } from '../apps/bot/src/application/emojis/types.js';
import { createDiscordEmojiAdapter } from '../apps/bot/src/infrastructure/discord/emojis/emojiAdapter.js';

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
  it('recusa Application Emojis sem usar o client conectado', async () => {
    const fake = fakeClient({ withoutApplication: true });
    const adapter = createDiscordEmojiAdapter(fake.client);

    await expectErrorCode(adapter.countApplicationEmojis(), 'destination_unavailable');
    const error = await adapter.create({ kind: 'application' }, 'festinha', IMAGE).catch((caught: unknown) => caught);

    expect(error).toMatchObject({ code: 'destination_unavailable' });
    expect((error as Error).message).not.toMatch(/token/iu);
    expect(fake.appEmojis.fetch).not.toHaveBeenCalled();
    expect(fake.appEmojis.create).not.toHaveBeenCalled();
  });

  it('cria emoji em servidor buscando a guild no Discord', async () => {
    const fake = fakeClient();
    const adapter = createDiscordEmojiAdapter(fake.client);

    const created = await adapter.create({ kind: 'guild', guildId: '123456789012345678' }, 'stats', IMAGE);

    expect(fake.guildsFetch).toHaveBeenCalledWith('123456789012345678');
    const payload = fake.guildEmojis.create.mock.calls[0]?.[0] as { attachment: string; name: string };
    expect(payload.attachment).toMatch(/^data:image\/gif;base64,/u);
    expect(created).toEqual({ id: '222', name: 'stats' });
  });

  it('mapeia guild inacessível para destino indisponível', async () => {
    const fake = fakeClient({ guildFetchFails: true });
    const adapter = createDiscordEmojiAdapter(fake.client);
    await expectErrorCode(
      adapter.create({ kind: 'guild', guildId: '123456789012345678' }, 'stats', IMAGE),
      'destination_unavailable',
    );
    expect(fake.guildEmojis.create).not.toHaveBeenCalled();
  });

  it.each([30008, 30018, 30056])('mapeia o código %i de capacidade do Discord', async (code) => {
    const fake = fakeClient();
    fake.guildEmojis.create.mockRejectedValue(Object.assign(new Error('maximum reached'), { code }));
    const adapter = createDiscordEmojiAdapter(fake.client);

    await expectErrorCode(
      adapter.create({ kind: 'guild', guildId: '123456789012345678' }, 'stats', IMAGE),
      'capacity_reached',
    );
  });

  it('sanitiza outros erros da API do Discord', async () => {
    const fake = fakeClient();
    fake.guildEmojis.create.mockRejectedValue(new Error('Internal Server Error token=abc'));
    const adapter = createDiscordEmojiAdapter(fake.client);

    const error = await adapter
      .create({ kind: 'guild', guildId: '123456789012345678' }, 'stats', IMAGE)
      .catch((caught: unknown) => caught);
    expect(error).toMatchObject({ code: 'create_failed' });
    expect((error as Error).message).not.toContain('token=abc');
  });
});
