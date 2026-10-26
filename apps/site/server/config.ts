import { isIP } from 'node:net';

function readHost(raw: string | undefined): string {
  const value = raw?.trim() ?? '';
  if (!value) return '127.0.0.1';
  if (isIP(value) === 0) throw new Error('HOST inválido para o site.');
  return value;
}

function readSiteUrl(raw: string | undefined, production: boolean): string {
  let url: URL;
  try { url = new URL(raw?.trim() ?? ''); } catch { throw new Error('SITE_URL inválida para o site.'); }
  const https = url.protocol === 'https:';
  if ((production && !https) || (!https && url.protocol !== 'http:') || url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw new Error('SITE_URL inválida para o site.');
  }
  return url.origin;
}

// O login mock existe só em development, com o OWNER_ID do bot dev; production recusa iniciar se o receber.
function readMockOwnerId(env: NodeJS.ProcessEnv): string | undefined {
  const raw = env.OWNER_ID?.trim();
  if (!raw) return undefined;
  if (env.APP_ENV === 'production') throw new Error('Production não aceita o login mock: remova OWNER_ID do ambiente do site.');
  if (!/^[1-9][0-9]{16,19}$/u.test(raw)) throw new Error('OWNER_ID inválido para o login mock do site.');
  return raw;
}

// OAuth do Discord: o client id é o do próprio bot. Sem o par id/secret o login real fica indisponível, sem derrubar o site.
function readDiscordOAuth(env: NodeJS.ProcessEnv, siteUrl: string, mockOwnerId: string | undefined) {
  const clientId = env.DISCORD_BOT_ID?.trim() ?? '';
  const clientSecret = env.DISCORD_CLIENT_SECRET?.trim() ?? '';
  const botToken = env.DISCORD_BOT_TOKEN?.trim() ?? '';
  const oauth = /^[1-9][0-9]{16,19}$/u.test(clientId) && clientSecret
    ? { clientId, clientSecret, redirectUri: `${siteUrl}/auth/callback` }
    : undefined;
  // O token do bot só é lido para o mock listar os servidores do dev; nunca em production.
  return { oauth, mockBotToken: mockOwnerId && botToken ? botToken : undefined };
}

export function readSiteConfig(env: NodeJS.ProcessEnv) {
  if (env.APP_ENV !== 'development' && env.APP_ENV !== 'production') throw new Error('APP_ENV inválido para o site.');
  const mockOwnerId = readMockOwnerId(env);
  const rawPort = env.PORT ?? '3666';
  if (!/^\d{1,5}$/u.test(rawPort) || Number(rawPort) < 1 || Number(rawPort) > 65535) throw new Error('PORT inválida para o site.');
  let base: URL;
  try { base = new URL(env.ASSETS_BASE_URL ?? ''); } catch { throw new Error('ASSETS_BASE_URL inválida para o site.'); }
  if (base.protocol !== 'https:' || base.username || base.password || base.search || base.hash || (base.port && base.port !== '443')) throw new Error('ASSETS_BASE_URL deve ser uma URL HTTPS pública sem credenciais ou parâmetros.');
  // Only relative object keys are persisted; the browser loads media directly from R2.
  const avatarPath = 'icons/Icons/1.jpg';
  base.pathname = `${base.pathname.replace(/\/$/u, '')}/`;
  const siteUrl = readSiteUrl(env.SITE_URL ?? (env.APP_ENV === 'development' ? `http://localhost:${Number(rawPort)}` : undefined), env.APP_ENV === 'production');
  const { oauth, mockBotToken } = readDiscordOAuth(env, siteUrl, mockOwnerId);
  return Object.freeze({
    port: Number(rawPort),
    host: readHost(env.HOST),
    siteUrl,
    assetsOrigin: base.origin,
    avatarUrl: new URL(avatarPath, base).href,
    mockOwnerId,
    mockBotToken,
    oauth,
  });
}
