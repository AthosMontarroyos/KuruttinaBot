import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createServer, type IncomingMessage, type Server } from 'node:http';
import { createGuildApi } from '../apps/site/server/guild.js';
import { createDiscordBot } from '../apps/site/server/discord.js';
import { readSiteConfig } from '../apps/site/server/config.js';
import { listCategories, listChannels as fetchChannels, listRoles } from '../apps/site/src/lib/guild-api.js';

const environment = {
  SESSION_FILE: '',
  APP_ENV: 'production',
  SITE_URL: 'https://kuruttina.athosmontarroyos.com',
  ASSETS_BASE_URL: 'https://assets.example.com/',
  DATABASE_URL: 'postgres://kuruttina_site:test-pw@db.internal:5432/kuruttina',
  DISCORD_BOT_TOKEN: 'secret-bot-token',
};
const guildId = '123456789012345678';

const discordChannels = [
  { id: '300000000000000002', name: 'Voz', type: 4, position: 2 },
  { id: '300000000000000001', name: 'Texto', type: 4, position: 1 },
  { id: '200000000000000003', name: 'regras', type: 0, parent_id: '300000000000000001', position: 1 },
  { id: '200000000000000002', name: 'geral', type: 0, parent_id: '300000000000000001', position: 0 },
  { id: '200000000000000004', name: 'sala-de-voz', type: 2, parent_id: '300000000000000002', position: 0 },
  { id: '200000000000000005', name: 'avisos', type: 5, position: 0 },
  { id: '200000000000000001', name: 'soltos', type: 0, position: 5 },
];

const discordRoles = [
  { id: guildId, name: '@everyone', color: 0, position: 0, managed: false },
  { id: '400000000000000001', name: 'Membro', color: 0, position: 1, managed: false, icon: null, unicode_emoji: '🛡️' },
  { id: '400000000000000003', name: 'Admin', color: 0xff0000, position: 5, managed: false, icon: 'abc123', unicode_emoji: null },
  { id: '400000000000000002', name: 'Kuruttina', color: 0x5865f2, position: 3, managed: true },
];

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

describe('discord bot reads', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => { fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('reads the channels with the bot token and keeps only text and announcement channels, in Discord order', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, discordChannels));
    const result = await createDiscordBot(readSiteConfig(environment)).listChannels(guildId);
    expect(fetchMock).toHaveBeenCalledWith(`https://discord.com/api/v10/guilds/${guildId}/channels`, expect.objectContaining({ headers: { Authorization: 'Bot secret-bot-token' } }));
    expect(result).toEqual({
      ok: true,
      items: [
        { id: '200000000000000005', name: 'avisos', type: 'announcement', category: null },
        { id: '200000000000000001', name: 'soltos', type: 'text', category: null },
        { id: '200000000000000002', name: 'geral', type: 'text', category: 'Texto' },
        { id: '200000000000000003', name: 'regras', type: 'text', category: 'Texto' },
      ],
    });
  });

  it('lists the categories in Discord order from the same call that lists the channels', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, discordChannels));
    const discord = createDiscordBot(readSiteConfig(environment));
    expect(await discord.listCategories(guildId)).toEqual({ ok: true, items: [{ id: '300000000000000001', name: 'Texto' }, { id: '300000000000000002', name: 'Voz' }] });
    await discord.listChannels(guildId);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('lists the roles from the highest to the lowest, without @everyone, with color and managed flag', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, discordRoles));
    const result = await createDiscordBot(readSiteConfig(environment)).listRoles(guildId);
    expect(fetchMock).toHaveBeenCalledWith(`https://discord.com/api/v10/guilds/${guildId}/roles`, expect.objectContaining({ headers: { Authorization: 'Bot secret-bot-token' } }));
    expect(result).toEqual({
      ok: true,
      items: [
        {
          id: '400000000000000003', name: 'Admin', color: '#ff0000', managed: false,
          iconUrl: 'https://cdn.discordapp.com/role-icons/400000000000000003/abc123.png', unicodeEmoji: null,
        },
        { id: '400000000000000002', name: 'Kuruttina', color: '#5865f2', managed: true, iconUrl: null, unicodeEmoji: null },
        { id: '400000000000000001', name: 'Membro', color: null, managed: false, iconUrl: null, unicodeEmoji: '🛡️' },
      ],
    });
  });

  it('caches each list for a short time', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, discordRoles));
    const discord = createDiscordBot(readSiteConfig(environment));
    await discord.listRoles(guildId);
    await discord.listRoles(guildId);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('is unavailable without a token and does not call Discord', async () => {
    const { DISCORD_BOT_TOKEN: _removed, ...withoutToken } = environment;
    const discord = createDiscordBot(readSiteConfig(withoutToken));
    expect(await discord.listChannels(guildId)).toEqual({ ok: false, reason: 'unavailable' });
    expect(await discord.listRoles(guildId)).toEqual({ ok: false, reason: 'unavailable' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('refuses ids that are not snowflakes before building the Discord path', async () => {
    const discord = createDiscordBot(readSiteConfig(environment));
    for (const id of ['../users/@me', '12', '']) {
      expect(await discord.listChannels(id)).toEqual({ ok: false, reason: 'unavailable' });
      expect(await discord.listRoles(id)).toEqual({ ok: false, reason: 'unavailable' });
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([[403], [404]])('reports the bot is not in the guild when Discord answers %i', async (status) => {
    fetchMock.mockResolvedValueOnce(jsonResponse(status, { message: 'x' }));
    expect(await createDiscordBot(readSiteConfig(environment)).listRoles(guildId)).toEqual({ ok: false, reason: 'bot_not_in_guild' });
  });

  it.each([[429], [500]])('reports unavailable for Discord status %i, and when the network fails', async (status) => {
    fetchMock.mockResolvedValueOnce(jsonResponse(status, {}));
    expect(await createDiscordBot(readSiteConfig(environment)).listChannels(guildId)).toEqual({ ok: false, reason: 'unavailable' });
    fetchMock.mockRejectedValueOnce(new Error('rede'));
    expect(await createDiscordBot(readSiteConfig(environment)).listChannels('223456789012345678')).toEqual({ ok: false, reason: 'unavailable' });
  });
});

describe('guild lists API', () => {
  let server: Server;
  let origin = '';
  let authorization: { status: 'unauthenticated' } | { status: 'forbidden' } | { status: 'ok'; discordId: string } = { status: 'ok', discordId: '111111111111111111' };
  const discord = { listChannels: vi.fn(), listCategories: vi.fn(), listRoles: vi.fn() };
  const authorizedGuilds: string[] = [];

  beforeEach(async () => {
    authorization = { status: 'ok', discordId: '111111111111111111' };
    for (const mock of Object.values(discord)) mock.mockReset();
    authorizedGuilds.length = 0;
    const api = createGuildApi(
      { getAuthorizedGuild: (_req: IncomingMessage, id: string) => { authorizedGuilds.push(id); return authorization; } } as never,
      discord as never,
    );
    server = createServer((req, res) => {
      if (!api.handle(req, res, (req.url ?? '').split('?')[0] ?? '')) res.writeHead(404).end();
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Expected local HTTP server.');
    origin = `http://127.0.0.1:${address.port}`;
  });
  afterEach(async () => { await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))); });

  it.each([
    ['channels', 'listChannels'],
    ['categories', 'listCategories'],
    ['roles', 'listRoles'],
  ] as const)('returns the %s of an authorized guild without caching them in the browser', async (list, method) => {
    discord[method].mockResolvedValueOnce({ ok: true, items: [{ id: '1', name: 'x' }] });
    const response = await fetch(`${origin}/api/guilds/${guildId}/${list}`);
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toEqual({ items: [{ id: '1', name: 'x' }] });
    expect(authorizedGuilds).toEqual([guildId]);
    expect(discord[method]).toHaveBeenCalledWith(guildId);
  });

  it('answers 401 without a session and 404 for a guild the user does not manage, never asking Discord', async () => {
    authorization = { status: 'unauthenticated' };
    expect((await fetch(`${origin}/api/guilds/${guildId}/roles`)).status).toBe(401);
    authorization = { status: 'forbidden' };
    expect((await fetch(`${origin}/api/guilds/${guildId}/roles`)).status).toBe(404);
    expect(discord.listRoles).not.toHaveBeenCalled();
  });

  it('rejects malformed guild ids before authorizing, and ignores other lists', async () => {
    expect((await fetch(`${origin}/api/guilds/abc/channels`)).status).toBe(404);
    expect(authorizedGuilds).toEqual([]);
    expect((await fetch(`${origin}/api/guilds/${guildId}/members`)).status).toBe(404);
    expect(authorizedGuilds).toEqual([]);
  });

  it('maps the Discord failures to 409 (bot not in the guild) and 503, without leaking details', async () => {
    discord.listRoles.mockResolvedValueOnce({ ok: false, reason: 'bot_not_in_guild' });
    const missing = await fetch(`${origin}/api/guilds/${guildId}/roles`);
    expect(missing.status).toBe(409);
    expect(await missing.json()).toEqual({ error: 'bot_not_in_guild' });
    discord.listRoles.mockResolvedValueOnce({ ok: false, reason: 'unavailable' });
    const down = await fetch(`${origin}/api/guilds/${guildId}/roles`);
    expect(down.status).toBe(503);
    expect(await down.json()).toEqual({ error: 'unavailable' });
    discord.listRoles.mockRejectedValueOnce(new Error('secret-bot-token'));
    const broken = await fetch(`${origin}/api/guilds/${guildId}/roles`);
    expect(broken.status).toBe(503);
    expect(await broken.text()).not.toContain('secret-bot-token');
  });

  it('only accepts GET and HEAD', async () => {
    const response = await fetch(`${origin}/api/guilds/${guildId}/channels`, { method: 'POST' });
    expect(response.status).toBe(405);
    expect(response.headers.get('allow')).toBe('GET, HEAD');
  });
});

describe('guild lists client', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => { fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it.each([
    ['channels', fetchChannels],
    ['categories', listCategories],
    ['roles', listRoles],
  ] as const)('reads the %s of the guild with the session cookie', async (list, read) => {
    const items = [{ id: '200000000000000001', name: 'geral' }];
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { items }));
    expect(await read(guildId)).toEqual({ ok: true, items });
    expect(fetchMock).toHaveBeenCalledWith(`/api/guilds/${guildId}/${list}`, expect.objectContaining({ method: 'GET', credentials: 'same-origin' }));
  });

  it.each([
    [409, { error: 'bot_not_in_guild' }, 'bot_not_in_guild'],
    [401, { error: 'unauthenticated' }, 'unauthenticated'],
    [404, { error: 'not_found' }, 'not_found'],
    [503, { error: 'unavailable' }, 'unavailable'],
    [500, { error: 'algo-novo' }, 'unavailable'],
  ] as const)('maps status %i to %s', async (status, body, error) => {
    fetchMock.mockResolvedValueOnce(jsonResponse(status, body));
    expect(await listRoles(guildId)).toEqual({ ok: false, error });
  });

  it('reports unavailable when the network fails or the answer is not JSON', async () => {
    fetchMock.mockRejectedValueOnce(new Error('rede'));
    expect(await listRoles(guildId)).toEqual({ ok: false, error: 'unavailable' });
    fetchMock.mockResolvedValueOnce(new Response('<html>', { status: 502 }));
    expect(await listRoles(guildId)).toEqual({ ok: false, error: 'unavailable' });
  });
});
