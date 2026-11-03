import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Server } from 'node:http';
import { createHash } from 'node:crypto';
import { inspect } from 'node:util';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readSiteConfig } from '../apps/site/server/config.js';
import { createSiteServer } from '../apps/site/server/http.js';

const environment = {
  SESSION_FILE: '', APP_ENV: 'development', PORT: '3666', SITE_URL: 'http://localhost:3666', ASSETS_BASE_URL: 'https://assets.example.com/',
  // Role própria do site (kuruttina_site), distinta da do bot; host não local, então vale em development e production.
  DATABASE_URL: 'postgres://kuruttina_site:test-pw@db.internal:5432/kuruttina',
};
describe('site configuration', () => {
  it('exposes only public configuration and keeps the stable avatar path', () => {
    expect(readSiteConfig(environment)).toEqual({
      target: 'development', devMock: true,
      port: 3666, host: '127.0.0.1', siteUrl: 'http://localhost:3666', assetsOrigin: 'https://assets.example.com', avatarUrl: 'https://assets.example.com/icons/Icons/1.jpg',
      homeCoverUrl: 'https://assets.example.com/dashboard/LaddingPage/CardRetrato-recorte.webp',
      database: {
        host: 'db.internal', port: 5432, user: 'kuruttina_site', password: 'test-pw', database: 'kuruttina',
        ssl: { rejectUnauthorized: true },
        connectionTimeoutMillis: 5000, statement_timeout: 5000, idle_in_transaction_session_timeout: 5000,
        options: '-c search_path=pg_catalog,bot_private',
      },
    });
  });
  it.each(['', 'http://assets.example.com', 'https://user:password@assets.example.com', 'https://assets.example.com/?token=secret', 'https://assets.example.com/#fragment'])('rejects invalid asset base %s', (base) => {
    expect(() => readSiteConfig({ ...environment, ASSETS_BASE_URL: base })).toThrow();
  });
  it.each(['0', '65536', '12x', '-1'])('rejects invalid port %s', (port) => {
    expect(() => readSiteConfig({ ...environment, PORT: port })).toThrow();
  });
  it('requires an explicit environment', () => {
    expect(() => readSiteConfig({ ASSETS_BASE_URL: environment.ASSETS_BASE_URL, SITE_URL: environment.SITE_URL })).toThrow();
  });
  it('honors an explicit public site URL and keeps the listen address independent', () => {
    expect(readSiteConfig({ ...environment, PORT: '8080', SITE_URL: 'http://localhost:3666/' }).siteUrl).toBe('http://localhost:3666');
    expect(readSiteConfig({ ...environment, APP_ENV: 'production', SITE_URL: 'https://kuruttina.athosmontarroyos.com' })).toMatchObject({
      port: 3666, host: '127.0.0.1', siteUrl: 'https://kuruttina.athosmontarroyos.com', devMock: false,
    });
  });
  it.each([
    '',
    'ftp://localhost:3666',
    'http://user:password@localhost:3666',
    'http://localhost:3666/home',
    'http://localhost:3666/?token=secret',
    'http://localhost:3666/#fragment',
  ])('rejects invalid site URL %s', (siteUrl) => {
    expect(() => readSiteConfig({ ...environment, SITE_URL: siteUrl })).toThrow();
  });
  it('derives the development URL from the port without using the bind address', () => {
    const { SITE_URL, PORT, ...withoutUrl } = environment;
    expect(readSiteConfig(withoutUrl).siteUrl).toBe('http://localhost:3666');
    expect(readSiteConfig({ ...withoutUrl, PORT: '3667', HOST: '0.0.0.0' }).siteUrl).toBe('http://localhost:3667');
    expect(readSiteConfig({ ...withoutUrl, PORT: '8080' }).siteUrl).toBe('http://localhost:8080');
    expect(() => readSiteConfig({ ...withoutUrl, APP_ENV: 'production' })).toThrow('SITE_URL');
  });
  it('allows HTTP only in development', () => {
    expect(readSiteConfig(environment).siteUrl).toBe('http://localhost:3666');
    expect(() => readSiteConfig({ ...environment, APP_ENV: 'production', SITE_URL: 'http://kuruttina.athosmontarroyos.com' })).toThrow();
  });
  it('listens on loopback when HOST is absent and on the container address when set', () => {
    expect(readSiteConfig(environment).host).toBe('127.0.0.1');
    expect(readSiteConfig({ ...environment, HOST: '   ' }).host).toBe('127.0.0.1');
    expect(readSiteConfig({ ...environment, HOST: '0.0.0.0', APP_ENV: 'production', SITE_URL: 'https://kuruttina.athosmontarroyos.com' })).toMatchObject({
      host: '0.0.0.0', siteUrl: 'https://kuruttina.athosmontarroyos.com',
    });
  });
  it.each(['http://0.0.0.0', '0.0.0.0:3666', 'localhost', 'example.com'])('rejects invalid listen host %s', (host) => {
    expect(() => readSiteConfig({ ...environment, HOST: host })).toThrow('HOST');
  });
});

describe('mock login configuration', () => {
  const production = { ...environment, APP_ENV: 'production', SITE_URL: 'https://kuruttina.athosmontarroyos.com' };
  it('enables the mock from APP_ENV and ignores OWNER_ID', () => {
    expect(readSiteConfig(environment).devMock).toBe(true);
    expect(readSiteConfig({ ...environment, OWNER_ID: 'abc' }).devMock).toBe(true);
    expect(readSiteConfig({ ...environment, OWNER_ID: '123456789012345678' }).devMock).toBe(true);
    expect(JSON.stringify(readSiteConfig({ ...environment, OWNER_ID: '123456789012345678' }))).not.toContain('123456789012345678');
  });
  it('keeps the mock off in production even when OWNER_ID or the bot token is present', () => {
    const config = readSiteConfig({ ...production, OWNER_ID: 'not-a-snowflake', DISCORD_BOT_TOKEN: 'test-secret' });
    expect(config.devMock).toBe(false);
    expect(JSON.stringify(config)).not.toContain('OWNER_ID');
  });
  it('reads the bot token in every environment, trimmed, and treats blank as absent', () => {
    expect(readSiteConfig(environment).botToken).toBeUndefined();
    expect(readSiteConfig({ ...environment, DISCORD_BOT_TOKEN: '  bot-token  ' }).botToken).toBe('bot-token');
    expect(readSiteConfig({ ...environment, DISCORD_BOT_TOKEN: '   ' }).botToken).toBeUndefined();
    expect(readSiteConfig({ ...production, DISCORD_BOT_TOKEN: 'bot-token' }).botToken).toBe('bot-token');
    expect(readSiteConfig(production).botToken).toBeUndefined();
  });
  it('never exposes the bot token through serialization, spread or inspection of the config', () => {
    const config = readSiteConfig({ ...production, DISCORD_BOT_TOKEN: 'test-secret' });
    expect(JSON.stringify(config)).not.toContain('test-secret');
    expect(JSON.stringify({ ...config })).not.toContain('test-secret');
    expect(inspect(config, { depth: 5 })).not.toContain('test-secret');
    expect(Object.keys(config)).not.toContain('botToken');
  });
});

describe('mock login HTTP boundary', () => {
  const devId = '123456789012345678';
  const page = new URL('../apps/site/index.html', import.meta.url);
  const publicDir = new URL('../apps/site/public/', import.meta.url);
  let server: Server;
  let origin: string;
  const post = (path: string, headers: Record<string, string> = {}) => fetch(origin + path, { method: 'POST', headers });
  beforeAll(async () => {
    server = await createSiteServer(readSiteConfig(environment), page, publicDir, async () => devId);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Expected local HTTP server.');
    origin = `http://127.0.0.1:${address.port}`;
  });
  afterAll(async () => { await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); });
  it('reports the mock without exposing the full ID', async () => {
    const body = await (await fetch(origin + '/api/session')).json();
    expect(body).toEqual({ mock: true, discord: false, authenticated: false });
  });
  it('rejects a login from another origin', async () => {
    expect((await post('/api/mock-login', { Origin: 'https://evil.example' })).status).toBe(403);
    expect((await post('/api/mock-login')).status).toBe(403);
  });
  it('opens and closes an HttpOnly session', async () => {
    const login = await post('/api/mock-login', { Origin: 'http://localhost:3666' });
    expect(login.status).toBe(200);
    const cookie = login.headers.get('set-cookie') ?? '';
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Strict');
    const text = await login.text();
    expect(text).toContain('"label":"Dev"');
    expect(text).not.toContain(devId);
    const pair = cookie.split(';')[0] ?? '';
    expect(await (await fetch(origin + '/api/session', { headers: { Cookie: pair } })).json()).toMatchObject({ authenticated: true });
    await fetch(origin + '/api/logout', { method: 'POST', headers: { Origin: 'http://localhost:3666', Cookie: pair } });
    expect(await (await fetch(origin + '/api/session', { headers: { Cookie: pair } })).json()).toMatchObject({ authenticated: false });
  });
  it('fails clearly when there is no active dev and does not open a session', async () => {
    const absent = await createSiteServer(readSiteConfig(environment), page, publicDir, async () => null);
    await new Promise<void>((resolve) => absent.listen(0, '127.0.0.1', resolve));
    const address = absent.address();
    if (!address || typeof address === 'string') throw new Error('Expected local HTTP server.');
    try {
      const response = await fetch(`http://127.0.0.1:${address.port}/api/mock-login`, { method: 'POST', headers: { Origin: 'http://localhost:3666' } });
      expect(response.status).toBe(409);
      expect(await response.json()).toEqual({ error: 'dev_ausente' });
      expect(response.headers.get('set-cookie')).toBeNull();
    } finally {
      await new Promise<void>((resolve, reject) => absent.close((error) => error ? reject(error) : resolve()));
    }
  });
  it('fails closed when the dev lookup fails or returns an invalid id', async () => {
    for (const loadActiveDevId of [async () => { throw new Error('database down'); }, async () => 'not-a-snowflake']) {
      const broken = await createSiteServer(readSiteConfig(environment), page, publicDir, loadActiveDevId);
      await new Promise<void>((resolve) => broken.listen(0, '127.0.0.1', resolve));
      const address = broken.address();
      if (!address || typeof address === 'string') throw new Error('Expected local HTTP server.');
      try {
        const response = await fetch(`http://127.0.0.1:${address.port}/api/mock-login`, { method: 'POST', headers: { Origin: 'http://localhost:3666' } });
        expect(response.status).toBe(503);
        expect(await response.json()).toEqual({ error: 'dev_indisponivel' });
        expect(response.headers.get('set-cookie')).toBeNull();
      } finally {
        await new Promise<void>((resolve, reject) => broken.close((error) => error ? reject(error) : resolve()));
      }
    }
  });
  it('never enables the mock in production', async () => {
    let lookups = 0;
    const production = await createSiteServer(
      readSiteConfig({ ...environment, APP_ENV: 'production', SITE_URL: 'https://kuruttina.athosmontarroyos.com', OWNER_ID: devId, DISCORD_BOT_TOKEN: 'test-secret' }),
      page,
      publicDir,
      async () => { lookups += 1; return devId; },
    );
    await new Promise<void>((resolve) => production.listen(0, '127.0.0.1', resolve));
    const address = production.address();
    if (!address || typeof address === 'string') throw new Error('Expected local HTTP server.');
    const base = `http://127.0.0.1:${address.port}`;
    try {
      expect(await (await fetch(base + '/api/session')).json()).toEqual({ mock: false, discord: false, authenticated: false });
      const response = await fetch(base + '/api/mock-login', { method: 'POST', headers: { Origin: 'https://kuruttina.athosmontarroyos.com' } });
      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({ error: 'not_found' });
      expect(lookups).toBe(0);
    } finally {
      await new Promise<void>((resolve, reject) => production.close((error) => error ? reject(error) : resolve()));
    }
  });
});

describe('session persistence across restarts', () => {
  const start = async (file: string) => {
    const server = await createSiteServer(readSiteConfig({ ...environment, SESSION_FILE: file }), new URL('../apps/site/index.html', import.meta.url), new URL('../apps/site/public/', import.meta.url), async () => '123456789012345678');
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Expected local HTTP server.');
    return { server, origin: `http://127.0.0.1:${address.port}` };
  };
  const stop = (server: Server) => new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  it('keeps the login after the server restarts and drops it after logout', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'kuruttina-sessions-'));
    const file = join(directory, 'sessions.json');
    try {
      const first = await start(file);
      const login = await fetch(first.origin + '/api/mock-login', { method: 'POST', headers: { Origin: 'http://localhost:3666' } });
      const pair = (login.headers.get('set-cookie') ?? '').split(';')[0] ?? '';
      await new Promise((resolve) => setTimeout(resolve, 400));
      await stop(first.server);
      const second = await start(file);
      expect(await (await fetch(second.origin + '/api/session', { headers: { Cookie: pair } })).json()).toMatchObject({ authenticated: true });
      expect(await readFile(file, 'utf8')).not.toContain(pair.split('=')[1] ?? 'missing');
      await fetch(second.origin + '/api/logout', { method: 'POST', headers: { Origin: 'http://localhost:3666', Cookie: pair } });
      await new Promise((resolve) => setTimeout(resolve, 400));
      await stop(second.server);
      const third = await start(file);
      expect(await (await fetch(third.origin + '/api/session', { headers: { Cookie: pair } })).json()).toMatchObject({ authenticated: false });
      await stop(third.server);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});

describe('session lifetime', () => {
  const day = 24 * 60 * 60 * 1000;
  const hash = (token: string) => createHash('sha256').update(token).digest('hex');
  const user = { id: '100000000000000001', label: 'Dev', avatarUrl: null };
  it('renews up to 7 days of idle time but never past 14 days since login', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'kuruttina-lifetime-'));
    const file = join(directory, 'sessions.json');
    const now = Date.now();
    const created = { fresh: now - 1 * day, nearCap: now - 13 * day, overCap: now - 15 * day };
    await writeFile(file, JSON.stringify({
      [hash('fresh')]: { created: created.fresh, expires: now + 2 * day, user, guilds: [] },
      [hash('near-cap')]: { created: created.nearCap, expires: now + 60 * 60 * 1000, user, guilds: [] },
      [hash('over-cap')]: { created: created.overCap, expires: now + 3 * day, user, guilds: [] },
    }));
    const server = await createSiteServer(readSiteConfig({ ...environment, SESSION_FILE: file }), new URL('../apps/site/index.html', import.meta.url), new URL('../apps/site/public/', import.meta.url));
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Expected local HTTP server.');
    const origin = `http://127.0.0.1:${address.port}`;
    const check = async (token: string) => (await (await fetch(origin + '/api/session', { headers: { Cookie: `kuruttina_session=${token}` } })).json()) as { authenticated: boolean };
    try {
      expect((await check('fresh')).authenticated).toBe(true);
      expect((await check('near-cap')).authenticated).toBe(true);
      expect((await check('over-cap')).authenticated).toBe(false);
      await new Promise((resolve) => setTimeout(resolve, 400));
      const saved = JSON.parse(await readFile(file, 'utf8')) as Record<string, { expires: number }>;
      expect(Math.abs((saved[hash('fresh')]?.expires ?? 0) - (Date.now() + 7 * day))).toBeLessThan(60_000);
      expect(Math.abs((saved[hash('near-cap')]?.expires ?? 0) - (created.nearCap + 14 * day))).toBeLessThan(1_000);
      expect(saved[hash('over-cap')]).toBeUndefined();
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
      await rm(directory, { recursive: true, force: true });
    }
  });
});

describe('Discord OAuth HTTP boundary', () => {
  const oauthEnvironment = { ...environment, DISCORD_BOT_ID: '123456789012345678', DISCORD_CLIENT_SECRET: 'test-secret' }; // gitleaks:allow
  let server: Server;
  let origin: string;
  beforeAll(async () => {
    server = await createSiteServer(readSiteConfig(oauthEnvironment), new URL('../apps/site/index.html', import.meta.url), new URL('../apps/site/public/', import.meta.url));
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Expected local HTTP server.');
    origin = `http://127.0.0.1:${address.port}`;
  });
  afterAll(async () => { await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); });
  it('keeps the secret out of the configuration unless both values exist', () => {
    expect(readSiteConfig(environment).oauth).toBeUndefined();
    expect(readSiteConfig(oauthEnvironment).oauth).toMatchObject({ clientId: '123456789012345678', redirectUri: 'http://localhost:3666/auth/callback' });
  });
  it('redirects to Discord with state, PKCE and a bound cookie', async () => {
    const response = await fetch(origin + '/auth/discord', { redirect: 'manual' });
    expect(response.status).toBe(302);
    const location = new URL(response.headers.get('location') ?? '');
    expect(location.origin + location.pathname).toBe('https://discord.com/oauth2/authorize');
    expect(location.searchParams.get('scope')).toBe('identify guilds');
    expect(location.searchParams.get('code_challenge_method')).toBe('S256');
    expect(location.searchParams.get('redirect_uri')).toBe('http://localhost:3666/auth/callback');
    expect(response.headers.get('set-cookie')).toContain(`kuruttina_oauth=${location.searchParams.get('state')}`);
    expect(location.href).not.toContain('test-secret');
  });
  it('rejects a callback without a matching state', async () => {
    const response = await fetch(origin + '/auth/callback?code=abc&state=forged', { redirect: 'manual', headers: { Cookie: 'kuruttina_oauth=forged' } });
    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe('/login?erro=login');
  });
});

describe('public Home HTTP boundary', () => {
  let server: Server;
  let origin: string;
  beforeAll(async () => {
    server = await createSiteServer(readSiteConfig(environment), new URL('../apps/site/index.html', import.meta.url), new URL('../apps/site/public/', import.meta.url));
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Expected local HTTP server.');
    origin = `http://127.0.0.1:${address.port}`;
  });
  afterAll(async () => { await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); });
  it('renders direct remote images with an explicit CSP', async () => {
    const response = await fetch(origin);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-security-policy')).toContain("img-src 'self' https://assets.example.com");
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    const html = await response.text();
    expect(html).toContain('https://assets.example.com/icons/Icons/1.jpg');
    expect(html).not.toContain('{{AVATAR_URL}}');
  });
  it('falls back to the R2 image in both metas when there is no bot token', async () => {
    const html = await (await fetch(origin)).text();
    expect(html).toContain('<meta name="kuruttina-avatar" content="https://assets.example.com/icons/Icons/1.jpg">');
    expect(html).toContain('<meta name="kuruttina-app-icon" content="https://assets.example.com/icons/Icons/1.jpg">');
    expect(html).toContain('<meta name="kuruttina-home-cover" content="https://assets.example.com/dashboard/LaddingPage/CardRetrato-recorte.webp">');
    expect(html).not.toContain('kuruttina-home-cover-dark');
    expect(html).not.toContain('{{HOME_COVER_URL}}');
  });
  it('loads the theme before the first paint from a same-origin file, because the CSP blocks inline scripts', async () => {
    const response = await fetch(origin);
    const html = await response.text();
    expect(html).toContain('<script src="/theme-init.js"></script>');
    expect(html).not.toMatch(/<script(?![^>]*\bsrc=)[^>]*>/u);
    expect(response.headers.get('content-security-policy')).toContain("script-src 'self'");
    const script = await fetch(`${origin}/theme-init.js`);
    expect(script.status).toBe(200);
    expect(script.headers.get('content-type')).toBe('text/javascript; charset=utf-8');
    expect(await script.text()).toContain('kuruttina-theme');
  });
  it('allows any https image only on the dashboard, for the message preview', async () => {
    const dashboard = (await fetch(`${origin}/dashboard`)).headers.get('content-security-policy');
    const server = (await fetch(`${origin}/dashboard/1422623678205657160`)).headers.get('content-security-policy');
    const home = (await fetch(origin)).headers.get('content-security-policy');
    expect(dashboard).toContain("img-src 'self' https:;");
    expect(server).toContain("img-src 'self' https:;");
    expect(home).not.toContain("img-src 'self' https:;");
  });
  it.each(['/.env', '/package.json', '/src/config.ts', '/%2e%2e/.env', '/icons/../../.env', '/icons/theme.svg'])('never serves non-allowlisted file %s', async (path) => {
    expect((await fetch(origin + path)).status).toBe(404);
  });
  it.each([
    '/icons/theme/theme.svg',
    '/icons/theme/theme-mobile.svg',
    '/icons/account/user.svg',
    '/icons/account/user-mobile.svg',
    '/icons/language/brasil.svg',
    '/icons/community/discord.svg',
    '/icons/community/discord-mobile.svg',
    '/icons/social/instagram.svg',
    '/icons/social/tiktok.svg',
    '/icons/social/github.svg',
    '/icons/social/x.svg',
  ])('serves icon grouped by function %s', async (path) => {
    const response = await fetch(origin + path);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/svg+xml');
  });
  it.each(['/comandos', '/modulos', '/dashboard', '/dashboard/123456789012345678', '/login'])('serves the shell for the construction page %s', async (path) => {
    const response = await fetch(origin + path);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('text/html; charset=utf-8');
  });
  it.each(['/dashboard/abc', '/dashboard/123', '/dashboard/123456789012345678/extra'])('rejects a malformed dashboard server path %s', async (path) => {
    const response = await fetch(origin + path);
    expect(response.status).toBe(404);
  });
  it('rejects mutations, supports HEAD and exposes a light health check', async () => {
    expect((await fetch(origin, { method: 'POST' })).status).toBe(405);
    expect(await (await fetch(origin, { method: 'HEAD' })).text()).toBe('');
    expect(await (await fetch(origin + '/healthz')).json()).toEqual({ status: 'ok' });
  });
});

describe('bot images from the Discord token', () => {
  const realFetch = globalThis.fetch;
  const appId = '223456789012345678';
  const botId = '323456789012345678';
  const botEnvironment = { ...environment, DISCORD_BOT_TOKEN: 'bot-token' };
  const servers: Server[] = [];
  // Cada servidor tem o seu cache de imagens; `applicationStatus` simula a falha só do ícone do app.
  const serve = async (applicationStatus: number): Promise<string> => {
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (!url.startsWith('https://discord.com/')) return realFetch(input, init);
      if (url.endsWith('/applications/@me')) return applicationStatus === 200 ? Response.json({ id: appId, icon: 'abc123' }) : new Response('{}', { status: applicationStatus });
      if (url.endsWith('/users/@me')) return Response.json({ id: botId, username: 'Kuruttina', avatar: 'def456' });
      return new Response('{}', { status: 404 });
    }));
    const server = await createSiteServer(readSiteConfig(botEnvironment), new URL('../apps/site/index.html', import.meta.url), new URL('../apps/site/public/', import.meta.url));
    servers.push(server);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Expected local HTTP server.');
    return `http://127.0.0.1:${address.port}`;
  };
  afterAll(async () => {
    vi.unstubAllGlobals();
    await Promise.all(servers.map((server) => new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))));
  });
  it('puts the app icon and the bot photo from Discord in their metas', async () => {
    const html = await (await fetch(await serve(200))).text();
    expect(html).toContain(`<meta name="kuruttina-app-icon" content="https://cdn.discordapp.com/app-icons/${appId}/abc123.png?size=128">`);
    expect(html).toContain(`<meta name="kuruttina-avatar" content="https://cdn.discordapp.com/avatars/${botId}/def456.png?size=512">`);
    expect(html).not.toContain('{{APP_ICON_URL}}');
  });
  it('falls back to the R2 image for the app icon alone when its lookup fails', async () => {
    const html = await (await fetch(await serve(500))).text();
    expect(html).toContain('<meta name="kuruttina-app-icon" content="https://assets.example.com/icons/Icons/1.jpg">');
    expect(html).toContain(`<meta name="kuruttina-avatar" content="https://cdn.discordapp.com/avatars/${botId}/def456.png?size=512">`);
  });
});

describe('build assets not referenced by the HTML', () => {
  const lazySource = 'export const lazy = 1;';
  let directory: string;
  let server: Server;
  let origin: string;
  beforeAll(async () => {
    directory = await mkdtemp(join(tmpdir(), 'kuruttina-assets-'));
    await writeFile(join(directory, 'index.html'), '<!doctype html><title>Kuruttina</title>');
    await cp(new URL('../apps/site/public/icons/', import.meta.url), join(directory, 'public', 'icons'), { recursive: true });
    await mkdir(join(directory, 'public', 'assets', 'nested'), { recursive: true });
    await writeFile(join(directory, 'public', 'assets', 'lazy-abc123.js'), lazySource);
    await writeFile(join(directory, 'public', 'assets', 'emojis-abc123.json'), '{"ok":true}');
    await writeFile(join(directory, 'public', 'assets', 'nested', 'secret.js'), 'secret');
    await writeFile(join(directory, 'public', 'assets', 'bad name.js'), 'bad');
    await writeFile(join(directory, 'public', 'assets', '.hidden.js'), 'hidden');
    server = await createSiteServer(readSiteConfig(environment), pathToFileURL(join(directory, 'index.html')), new URL(`${pathToFileURL(join(directory, 'public')).href}/`));
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Expected local HTTP server.');
    origin = `http://127.0.0.1:${address.port}`;
  });
  afterAll(async () => {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await rm(directory, { recursive: true, force: true });
  });
  it('serves a chunk loaded by dynamic import with the JavaScript type and the same content', async () => {
    const response = await fetch(origin + '/assets/lazy-abc123.js');
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('text/javascript; charset=utf-8');
    expect(await response.text()).toBe(lazySource);
  });
  it('serves a JSON asset with the JSON type', async () => {
    const response = await fetch(origin + '/assets/emojis-abc123.json');
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('application/json; charset=utf-8');
  });
  it.each(['/assets/nested/secret.js', '/assets/nested', '/assets/bad%20name.js', '/assets/.hidden.js'])('does not publish %s', async (path) => {
    expect((await fetch(origin + path)).status).toBe(404);
  });
  it('keeps building when the assets folder is absent', async () => {
    const bare = await mkdtemp(join(tmpdir(), 'kuruttina-no-assets-'));
    try {
      await writeFile(join(bare, 'index.html'), '<!doctype html><title>Kuruttina</title>');
      await cp(new URL('../apps/site/public/icons/', import.meta.url), join(bare, 'public', 'icons'), { recursive: true });
      const plain = await createSiteServer(readSiteConfig(environment), pathToFileURL(join(bare, 'index.html')), new URL(`${pathToFileURL(join(bare, 'public')).href}/`));
      await new Promise<void>((resolve) => plain.listen(0, '127.0.0.1', resolve));
      const address = plain.address();
      if (!address || typeof address === 'string') throw new Error('Expected local HTTP server.');
      try {
        expect((await fetch(`http://127.0.0.1:${address.port}/`)).status).toBe(200);
      } finally {
        await new Promise<void>((resolve, reject) => plain.close((error) => error ? reject(error) : resolve()));
      }
    } finally {
      await rm(bare, { recursive: true, force: true });
    }
  });
});
