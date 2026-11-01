import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import type { Server } from 'node:http';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readSiteConfig } from '../apps/site/server/config.js';
import { createSiteServer } from '../apps/site/server/http.js';

const withBot = '223456789012345678';
const withoutBot = '323456789012345678';
const botId = '423456789012345678';
const page = new URL('../apps/site/index.html', import.meta.url);
const publicDir = new URL('../apps/site/public/', import.meta.url);
const realFetch = globalThis.fetch;

describe('session guilds with the bot presence and invite link', () => {
  let server: Server;
  let origin = '';
  let directory = '';
  let discordGuilds: unknown = [{ id: withBot }];
  const discordCalls: string[] = [];

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'kuruttina-invite-'));
    const file = join(directory, 'sessions.json');
    const now = Date.now();
    const user = { id: '123456789012345678', label: 'Dev', avatarUrl: null };
    const guilds = [
      { id: withoutBot, name: 'Alfa', iconUrl: null, bannerUrl: null, members: 10 },
      { id: withBot, name: 'Zeta', iconUrl: null, bannerUrl: null, members: 20 },
    ];
    const key = createHash('sha256').update('token').digest('hex');
    await writeFile(file, JSON.stringify({ [key]: { created: now, expires: now + 60_000, user, guilds } }));
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (!url.startsWith('https://discord.com/')) return realFetch(input, init);
      discordCalls.push(url);
      if (url.includes('/users/@me/guilds')) return Response.json(discordGuilds);
      if (url.endsWith('/users/@me')) return Response.json({ id: botId, username: 'Kuruttina', avatar: null });
      return new Response('{}', { status: 404 });
    }));
    server = await createSiteServer(readSiteConfig({
      APP_ENV: 'development', PORT: '3666', SITE_URL: 'http://localhost:3666', ASSETS_BASE_URL: 'https://assets.example.com/',
      DATABASE_URL: 'postgres://kuruttina_site:test-pw@db.internal:5432/kuruttina', SESSION_FILE: file, DISCORD_BOT_TOKEN: 'bot-token',
    }), page, publicDir, async () => null);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Expected local HTTP server.');
    origin = `http://127.0.0.1:${address.port}`;
  });
  afterEach(async () => {
    vi.unstubAllGlobals();
    discordCalls.length = 0;
    discordGuilds = [{ id: withBot }];
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    await rm(directory, { recursive: true, force: true });
  });

  const readGuilds = async () => {
    const body = (await (await realFetch(origin + '/api/session', { headers: { Cookie: 'kuruttina_session=token' } })).json()) as { guilds: Array<{ id: string; botIn: boolean | null; inviteUrl: string | null }> };
    return body.guilds;
  };

  it('marks where the bot is, puts those servers first and builds an invite only for the others', async () => {
    const guilds = await readGuilds();
    expect(guilds.map((guild) => [guild.id, guild.botIn])).toEqual([[withBot, true], [withoutBot, false]]);
    expect(guilds[0]?.inviteUrl).toBeNull();
    const invite = new URL(guilds[1]?.inviteUrl ?? '');
    expect(invite.origin + invite.pathname).toBe('https://discord.com/oauth2/authorize');
    expect(invite.searchParams.get('client_id')).toBe(botId);
    expect(invite.searchParams.get('guild_id')).toBe(withoutBot);
    expect(invite.searchParams.get('scope')).toBe('bot applications.commands');
    expect(invite.searchParams.get('disable_guild_select')).toBe('true');
    expect(invite.searchParams.get('permissions')).toMatch(/^[1-9][0-9]*$/u);
  });

  it('does not guess the bot presence when Discord fails, so no invite is offered', async () => {
    discordGuilds = { message: 'erro' };
    const guilds = await readGuilds();
    expect(guilds.every((guild) => guild.botIn === null && guild.inviteUrl === null)).toBe(true);
  });
});
