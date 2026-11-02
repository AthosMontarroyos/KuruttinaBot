import { createServer } from 'node:http';
import { readdir, readFile } from 'node:fs/promises';
import { createDatabase } from '@kuruttina/database';
import { createAuth } from './auth.js';
import { createDiscordBot } from './discord.js';
import { createRoleGroupsApi } from './role-groups.js';
import { createCustomActionsApi } from './custom-actions.js';
import { createMemberEventsApi } from './member-events.js';
import { createGuildApi } from './guild.js';
import { createTemplatesApi } from './templates.js';
import type { readSiteConfig } from './config.js';
import { isDashboardServerPath } from './http-utils.js';

type SiteConfig = ReturnType<typeof readSiteConfig>;
const iconPaths = [
  '/icons/account/user-mobile.svg',
  '/icons/account/user.svg',
  '/icons/community/discord-mobile.svg',
  '/icons/community/discord.svg',
  '/icons/language/brasil.svg',
  '/icons/social/github.svg',
  '/icons/social/instagram.svg',
  '/icons/social/tiktok.svg',
  '/icons/social/x.svg',
  '/icons/theme/theme-mobile.svg',
  '/icons/theme/theme.svg',
] as const;
const safePublicPath = /^\/(?:[A-Za-z0-9._-]+\/)*[A-Za-z0-9._-]+$/u;
const safeBuildAssetName = /^[A-Za-z0-9._-]+$/u;
const escapeAttribute = (value: string): string => value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

function contentType(pathname: string): string {
  if (pathname.endsWith('.css')) return 'text/css; charset=utf-8';
  if (pathname.endsWith('.js')) return 'text/javascript; charset=utf-8';
  if (pathname.endsWith('.json') || pathname.endsWith('.map')) return 'application/json; charset=utf-8';
  if (pathname.endsWith('.svg')) return 'image/svg+xml';
  if (pathname.endsWith('.woff2')) return 'font/woff2';
  if (pathname.endsWith('.woff')) return 'font/woff';
  if (pathname.endsWith('.ttf')) return 'font/ttf';
  return 'application/octet-stream';
}

function referencedPaths(html: string): string[] {
  const paths = new Set<string>();
  for (const match of html.matchAll(/(?:src|href|srcset)="([^"]*)"/gu)) {
    const candidate = match[1]?.split(/\s+/u)[0]?.split('?')[0] ?? '';
    if (safePublicPath.test(candidate)) paths.add(candidate);
  }
  return [...paths];
}

async function readPublicFile(directory: URL, pathname: string): Promise<Buffer> {
  if (!safePublicPath.test(pathname)) throw new Error('Caminho público inválido.');
  return readFile(new URL(pathname.slice(1), directory));
}

// Chunks de import() dinâmico não aparecem no HTML: publica todo arquivo regular de assets/ do build.
async function publishBuildAssets(directory: URL, assets: Map<string, { type: string; body: Buffer | string }>): Promise<void> {
  const entries = await readdir(new URL('assets/', directory), { withFileTypes: true }).catch((error: unknown) => {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return [];
    throw error;
  });
  await Promise.all(entries.map(async (entry) => {
    if (!entry.isFile() || entry.name.startsWith('.') || !safeBuildAssetName.test(entry.name)) return;
    const pathname = `/assets/${entry.name}`;
    if (assets.has(pathname)) return;
    assets.set(pathname, { type: contentType(pathname), body: await readPublicFile(directory, pathname) });
  }));
}

export async function createSiteServer(config: SiteConfig, pageFile: URL, staticDirectory: URL, loadActiveDevId?: () => Promise<string | null>) {
  const template = await readFile(pageFile, 'utf8');
  // Foto do bot e ícone do app saem do Discord a cada página; sem eles, vale o R2 (`config.avatarUrl`).
  const fallbackImages = { avatarUrl: config.avatarUrl, appIconUrl: config.avatarUrl };
  const renderPage = (images: { avatarUrl: string; appIconUrl: string }): string => template
    .replaceAll('{{AVATAR_URL}}', escapeAttribute(images.avatarUrl))
    .replaceAll('{{APP_ICON_URL}}', escapeAttribute(images.appIconUrl));
  const html = renderPage(fallbackImages);
  const pageRoutes = new Set(['/', '/comandos', '/modulos', '/login', '/dashboard']);
  const assets = new Map<string, { type: string; body: Buffer | string }>([
    ['/healthz', { type: 'application/json', body: '{"status":"ok"}' }],
  ]);
  const missingBundledAssets: string[] = [];
  await Promise.all(referencedPaths(html).map(async (pathname) => {
    try {
      assets.set(pathname, { type: contentType(pathname), body: await readPublicFile(staticDirectory, pathname) });
    } catch (error) {
      const missing = error instanceof Error && 'code' in error && error.code === 'ENOENT';
      if (!missing) throw error;
      if (pathname.startsWith('/assets/')) missingBundledAssets.push(pathname);
    }
  }));
  if (missingBundledAssets.length > 0) throw new Error('O build da Home não contém todos os arquivos publicados.');
  await publishBuildAssets(staticDirectory, assets);
  await Promise.all(iconPaths.map(async (pathname) => {
    assets.set(pathname, { type: 'image/svg+xml', body: await readPublicFile(staticDirectory, pathname) });
  }));
  const database = createDatabase(config.database, config.target);
  const auth = createAuth(config, loadActiveDevId ?? (() => database.getActiveDevUserId()));
  const discord = createDiscordBot(config);
  const templatesApi = createTemplatesApi(config, auth, database, discord);
  const guildApi = createGuildApi(auth, discord);
  const roleGroupsApi = createRoleGroupsApi(config, auth, database, discord);
  const customActionsApi = createCustomActionsApi(config, auth, database, discord);
  const memberEventsApi = createMemberEventsApi(config, auth, database, discord);
  // Erro inesperado em botImages não derruba a página: vale o R2.
  const pageImages = async (): Promise<{ avatarUrl: string; appIconUrl: string }> => {
    try {
      return await auth.botImages();
    } catch {
      return fallbackImages;
    }
  };
  const server = createServer({ requestTimeout: 10_000, maxHeaderSize: 8192 }, async (req, res) => {
    const [path = '', search = ''] = (req.url ?? '').split('?');
    // Só o painel carrega imagens de qualquer https: a prévia das mensagens mostra os links que o administrador cola.
    const imageSources = path === '/dashboard' || isDashboardServerPath(path) ? 'https:' : `${config.assetsOrigin} https://cdn.discordapp.com`;
    res.setHeader('Content-Security-Policy', `default-src 'none'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' ${imageSources}; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Cache-Control', 'no-cache');
    if (auth.handle(req, res, path, search)) return;
    if (templatesApi.handle(req, res, path, search)) return;
    if (guildApi.handle(req, res, path)) return;
    if (roleGroupsApi.handle(req, res, path)) return;
    if (customActionsApi.handle(req, res, path)) return;
    if (memberEventsApi.handle(req, res, path)) return;
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405, { Allow: 'GET, HEAD' }).end(); return; }
    if (pageRoutes.has(path) || isDashboardServerPath(path)) {
      const body = renderPage(await pageImages());
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(req.method === 'HEAD' ? undefined : body);
      return;
    }
    const asset = assets.get(path);
    if (!asset) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end(req.method === 'HEAD' ? undefined : 'Página não encontrada.'); return; }
    res.writeHead(200, { 'Content-Type': asset.type });
    res.end(req.method === 'HEAD' ? undefined : asset.body);
  });
  server.headersTimeout = 10_000;
  // Fecha o pool de templates junto com o servidor HTTP (sinal tratado em server/index.ts).
  server.on('close', () => { void templatesApi.close(); });
  return server;
}
