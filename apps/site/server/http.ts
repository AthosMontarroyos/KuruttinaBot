import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import type { readSiteConfig } from './config.js';

type SiteConfig = ReturnType<typeof readSiteConfig>;
const iconNames = ['brasil', 'discord', 'discord-mobile', 'github', 'instagram', 'theme', 'theme-mobile', 'tiktok', 'user', 'user-mobile'] as const;
const safePublicPath = /^\/(?:[A-Za-z0-9._-]+\/)*[A-Za-z0-9._-]+$/u;

const escapeAttribute = (value: string): string => value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

function contentType(pathname: string): string {
  if (pathname.endsWith('.css')) return 'text/css; charset=utf-8';
  if (pathname.endsWith('.js')) return 'text/javascript; charset=utf-8';
  if (pathname.endsWith('.svg')) return 'image/svg+xml';
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

export async function createSiteServer(config: SiteConfig, pageFile: URL, staticDirectory: URL) {
  const template = await readFile(pageFile, 'utf8');
  const html = template.replaceAll('{{AVATAR_URL}}', escapeAttribute(config.avatarUrl));
  const assets = new Map<string, { type: string; body: Buffer | string }>([
    ['/', { type: 'text/html; charset=utf-8', body: html }],
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
  await Promise.all(iconNames.map(async (name) => {
    const pathname = `/icons/${name}.svg`;
    assets.set(pathname, { type: 'image/svg+xml', body: await readPublicFile(staticDirectory, pathname) });
  }));
  const server = createServer({ requestTimeout: 10_000, maxHeaderSize: 8192 }, (req, res) => {
    res.setHeader('Content-Security-Policy', `default-src 'none'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' ${config.assetsOrigin}; base-uri 'none'; frame-ancestors 'none'; form-action 'none'`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Cache-Control', 'no-cache');
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405, { Allow: 'GET, HEAD' }).end(); return; }
    const path = (req.url ?? '').split('?')[0] ?? '';
    const asset = assets.get(path);
    if (!asset) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end(req.method === 'HEAD' ? undefined : 'Página não encontrada.'); return; }
    res.writeHead(200, { 'Content-Type': asset.type });
    res.end(req.method === 'HEAD' ? undefined : asset.body);
  });
  server.headersTimeout = 10_000;
  return server;
}
