import { Routes } from 'discord.js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PreparedEmojiImage } from '../apps/bot/src/application/emojis/types.js';
import {
  createProductionApplicationEmojiWriter,
  type DiscordApplicationEmojiRest,
} from '../apps/bot/src/infrastructure/discord/productionApplicationEmojis.js';

const PRODUCTION_ID = '111111111111111111';
const DEVELOPMENT_ID = '222222222222222222';
const EMOJI_ID = '333333333333333333';
const USER_ID = '444444444444444444';
const GUILD_ID = '555555555555555555';
const TOKEN = 'production-token-do-not-log';

const IMAGE: PreparedEmojiImage = {
  bytes: Uint8Array.from([9, 9, 9]),
  contentType: 'image/gif',
  animated: true,
  width: 1,
  height: 1,
  sourceBytes: 3,
  transformations: [],
};

const logs: string[] = [];

afterEach(() => {
  logs.length = 0;
  vi.restoreAllMocks();
});

function captureLogs(): void {
  const write = (chunk: unknown): boolean => {
    logs.push(String(chunk));
    return true;
  };
  vi.spyOn(process.stdout, 'write').mockImplementation(write);
  vi.spyOn(process.stderr, 'write').mockImplementation(write);
}

function harness(verifyIdentity = vi.fn(async (_token: string, _expectedBotId: string) => PRODUCTION_ID)) {
  const get = vi.fn(async (_route: `/${string}`): Promise<unknown> => ({ items: [] }));
  const post = vi.fn(async (_route: `/${string}`, _options: { readonly body: unknown }): Promise<unknown> => ({
    id: EMOJI_ID,
    name: 'festinha',
  }));
  const rest: DiscordApplicationEmojiRest = { get, post };
  const port = createProductionApplicationEmojiWriter(
    { token: TOKEN, expectedBotId: PRODUCTION_ID },
    { rest, verifyIdentity },
  );
  return { rest, get, post, verifyIdentity, port };
}

function output(): string {
  return logs.join('');
}

describe('Application Emojis de produção', () => {
  it('conta e cria somente na aplicação confirmada, com auditoria sem segredo', async () => {
    captureLogs();
    const { get, post, verifyIdentity, port } = harness();

    await expect(port.count()).resolves.toBe(0);
    const created = await port.create('festinha', IMAGE, { userId: USER_ID, guildId: GUILD_ID });

    expect(created).toEqual({ id: EMOJI_ID, name: 'festinha' });
    expect(verifyIdentity).toHaveBeenCalledTimes(1);
    expect(verifyIdentity).toHaveBeenCalledWith(TOKEN, PRODUCTION_ID);
    expect(get).toHaveBeenCalledWith(Routes.applicationEmojis(PRODUCTION_ID));
    expect(post).toHaveBeenCalledWith(Routes.applicationEmojis(PRODUCTION_ID), {
      body: { name: 'festinha', image: expect.stringMatching(/^data:image\/gif;base64,/u) },
    });
    expect(String(post.mock.calls[0]?.[0])).not.toContain(DEVELOPMENT_ID);
    expect(output()).toContain(`applicationId=${PRODUCTION_ID}`);
    expect(output()).toContain(`emojiId=${EMOJI_ID}`);
    expect(output()).toContain(`userId=${USER_ID}`);
    expect(output()).toContain(`guildId=${GUILD_ID}`);
    expect(output()).not.toContain(TOKEN);
    expect(output()).not.toContain('CQkJ');
    expect(port).not.toHaveProperty('token');
    expect(JSON.stringify(port)).not.toContain(TOKEN);
  });

  it('reusa a identidade confirmada e não reaproveita uma rejeição', async () => {
    const verifyIdentity = vi.fn(async (_token: string, _expectedBotId: string) => PRODUCTION_ID);
    verifyIdentity.mockRejectedValueOnce(new Error(`validation failed ${TOKEN}`));
    const { get, port } = harness(verifyIdentity);
    captureLogs();

    await expect(port.count()).rejects.toMatchObject({
      code: 'destination_unavailable',
      message: 'Não foi possível confirmar a identidade do bot de produção.',
    });
    expect(get).not.toHaveBeenCalled();
    expect(output()).not.toContain(TOKEN);

    verifyIdentity.mockResolvedValueOnce(PRODUCTION_ID);
    get.mockResolvedValueOnce({ items: [{ id: EMOJI_ID }, { id: USER_ID }] });
    await expect(port.count()).resolves.toBe(2);
    expect(verifyIdentity).toHaveBeenCalledTimes(2);
    expect(get).toHaveBeenCalledOnce();
  });

  it('não chama a API quando a identidade não é a de produção', async () => {
    captureLogs();
    const { get, post, port } = harness(vi.fn(async (_token: string, _expectedBotId: string) => DEVELOPMENT_ID));

    await expect(port.create('festinha', IMAGE)).rejects.toMatchObject({ code: 'destination_unavailable' });

    expect(get).not.toHaveBeenCalled();
    expect(post).not.toHaveBeenCalled();
    expect(output()).toContain(`applicationId=${PRODUCTION_ID}`);
    expect(output()).not.toContain(DEVELOPMENT_ID);
    expect(output()).not.toContain(TOKEN);
  });

  it.each([
    null,
    {},
    { items: 'nope' },
  ])('recusa uma lista inválida %#', async (body) => {
    const { get, port } = harness();
    get.mockResolvedValueOnce(body);

    const error = await port.count().catch((caught: unknown) => caught);
    expect(error).toMatchObject({
      code: 'destination_unavailable',
      message: 'Não foi possível consultar os Application Emojis do bot de produção.',
    });
  });

  it('não ecoa a falha ao consultar a lista', async () => {
    const { get, port } = harness();
    get.mockRejectedValueOnce(new Error(`cdn ${TOKEN}`));

    const error = await port.count().catch((caught: unknown) => caught);

    expect(error).toMatchObject({
      code: 'destination_unavailable',
      message: 'Não foi possível consultar os Application Emojis do bot de produção.',
    });
    expect((error as Error).message).not.toContain(TOKEN);
  });

  it('omite da auditoria um identificador que não é snowflake', async () => {
    captureLogs();
    const { port } = harness();

    await port.create('festinha', IMAGE, { userId: TOKEN, guildId: 'guild-token' });

    expect(output()).toContain(`applicationId=${PRODUCTION_ID}`);
    expect(output()).not.toContain('userId=');
    expect(output()).not.toContain('guildId=');
    expect(output()).not.toContain(TOKEN);
  });

  it.each([30008, 30018, 30056])('mapeia o código %i sem repetir o corpo do erro', async (code) => {
    const { post, port } = harness();
    post.mockRejectedValueOnce(Object.assign(new Error(`limit ${TOKEN}`), { code }));

    const error = await port.create('festinha', IMAGE).catch((caught: unknown) => caught);

    expect(error).toMatchObject({
      code: 'capacity_reached',
      message: 'O bot principal atingiu o limite de Application Emojis.',
    });
    expect((error as Error).message).not.toContain(TOKEN);
  });

  it.each([401, 403])('fecha a criação quando a produção recusa a credencial (%i)', async (status) => {
    const { post, port } = harness();
    post.mockRejectedValueOnce(Object.assign(new Error(TOKEN), { status }));

    const error = await port.create('festinha', IMAGE).catch((caught: unknown) => caught);

    expect(error).toMatchObject({ code: 'destination_unavailable' });
    expect((error as Error).message).not.toContain(TOKEN);
  });

  it('sanitiza resposta e erro inesperados da criação', async () => {
    captureLogs();
    const { post, port } = harness();
    post.mockResolvedValueOnce({ id: 'nao-e-id', name: 'festinha' });

    await expect(port.create('festinha', IMAGE)).rejects.toMatchObject({ code: 'create_failed' });
    expect(output()).not.toContain('Emoji criado');

    post.mockRejectedValueOnce(new Error(`upstream ${TOKEN}`));
    const error = await port.create('festinha', IMAGE).catch((caught: unknown) => caught);
    expect(error).toMatchObject({ code: 'create_failed', message: 'O Discord recusou a criação do emoji.' });
    expect((error as Error).message).not.toContain(TOKEN);
    expect(output()).not.toContain(TOKEN);
  });
});
