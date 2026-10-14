function readSiteUrl(raw: string | undefined, production: boolean): string {
  let url: URL;
  try { url = new URL(raw?.trim() ?? ''); } catch { throw new Error('SITE_URL inválida para o site.'); }
  const https = url.protocol === 'https:';
  if ((production && !https) || (!https && url.protocol !== 'http:') || url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw new Error('SITE_URL inválida para o site.');
  }
  return url.origin;
}

export function readSiteConfig(env: NodeJS.ProcessEnv) {
  if (env.APP_ENV !== 'development' && env.APP_ENV !== 'production') throw new Error('APP_ENV inválido para o site.');
  const rawPort = env.PORT ?? '3666';
  if (!/^\d{1,5}$/u.test(rawPort) || Number(rawPort) < 1 || Number(rawPort) > 65535) throw new Error('PORT inválida para o site.');
  let base: URL;
  try { base = new URL(env.ASSETS_BASE_URL ?? ''); } catch { throw new Error('ASSETS_BASE_URL inválida para o site.'); }
  if (base.protocol !== 'https:' || base.username || base.password || base.search || base.hash || (base.port && base.port !== '443')) throw new Error('ASSETS_BASE_URL deve ser uma URL HTTPS pública sem credenciais ou parâmetros.');
  // Only relative object keys are persisted; the browser loads media directly from R2.
  const avatarPath = 'icons/Icons/1.jpg';
  base.pathname = `${base.pathname.replace(/\/$/u, '')}/`;
  return Object.freeze({
    port: Number(rawPort),
    host: '127.0.0.1',
    siteUrl: readSiteUrl(env.SITE_URL, env.APP_ENV === 'production'),
    assetsOrigin: base.origin,
    avatarUrl: new URL(avatarPath, base).href,
  });
}
