import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Server } from 'node:http';
import { readSiteConfig } from '../apps/site/server/config.js';
import { createSiteServer } from '../apps/site/server/http.js';

const environment = { APP_ENV: 'development', PORT: '3666', SITE_URL: 'http://localhost:3666', ASSETS_BASE_URL: 'https://assets.example.com/' };
describe('site configuration', () => {
  it('exposes only public configuration and keeps the stable avatar path', () => {
    expect(readSiteConfig({ ...environment, DISCORD_BOT_TOKEN_PRODUCTION: 'test-secret' })).toEqual({
      port: 3666, host: '127.0.0.1', siteUrl: 'http://localhost:3666', assetsOrigin: 'https://assets.example.com', avatarUrl: 'https://assets.example.com/icons/Icons/1.jpg',
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
      port: 3666, host: '127.0.0.1', siteUrl: 'https://kuruttina.athosmontarroyos.com',
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
  ])('serves icon grouped by function %s', async (path) => {
    const response = await fetch(origin + path);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/svg+xml');
  });
  it('rejects mutations, supports HEAD and exposes a light health check', async () => {
    expect((await fetch(origin, { method: 'POST' })).status).toBe(405);
    expect(await (await fetch(origin, { method: 'HEAD' })).text()).toBe('');
    expect(await (await fetch(origin + '/healthz')).json()).toEqual({ status: 'ok' });
  });
});
