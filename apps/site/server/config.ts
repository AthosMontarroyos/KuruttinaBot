import { isIP } from 'node:net';
import { readDatabaseConfig } from '@kuruttina/database';

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

// O login mock existe só com APP_ENV=development. O id do dev vem do banco, não de variável de ambiente.
// Production nunca liga o mock, mesmo que OWNER_ID ou o token do bot estejam no processo.
function readDevMock(env: NodeJS.ProcessEnv): boolean {
  return env.APP_ENV === 'development';
}

function readMockBotToken(env: NodeJS.ProcessEnv, devMock: boolean): string | undefined {
  if (!devMock) return undefined;
  const token = env.DISCORD_BOT_TOKEN?.trim() ?? '';
  return token || undefined;
}

// OAuth do Discord: o client id é o do próprio bot. Sem o par id/secret o login real fica indisponível, sem derrubar o site.
function readDiscordOAuth(env: NodeJS.ProcessEnv, siteUrl: string) {
  const clientId = env.DISCORD_BOT_ID?.trim() ?? '';
  const clientSecret = env.DISCORD_CLIENT_SECRET?.trim() ?? '';
  return /^[1-9][0-9]{16,19}$/u.test(clientId) && clientSecret
    ? { clientId, clientSecret, redirectUri: `${siteUrl}/auth/callback` }
    : undefined;
}

// Arquivo das sessões: em development o padrão persiste em .sessions/ para o login sobreviver a reinícios.
// SESSION_FILE vazio desliga a persistência; em production só persiste se o caminho for informado.
function readSessionFile(env: NodeJS.ProcessEnv): string | undefined {
  if (env.SESSION_FILE !== undefined) return env.SESSION_FILE.trim() || undefined;
  return env.APP_ENV === 'development' ? '.sessions/site-sessions.json' : undefined;
}

export function readSiteConfig(env: NodeJS.ProcessEnv) {
  if (env.APP_ENV !== 'development' && env.APP_ENV !== 'production') throw new Error('APP_ENV inválido para o site.');
  const devMock = readDevMock(env);
  const rawPort = env.PORT ?? '3666';
  if (!/^\d{1,5}$/u.test(rawPort) || Number(rawPort) < 1 || Number(rawPort) > 65535) throw new Error('PORT inválida para o site.');
  let base: URL;
  try { base = new URL(env.ASSETS_BASE_URL ?? ''); } catch { throw new Error('ASSETS_BASE_URL inválida para o site.'); }
  if (base.protocol !== 'https:' || base.username || base.password || base.search || base.hash || (base.port && base.port !== '443')) throw new Error('ASSETS_BASE_URL deve ser uma URL HTTPS pública sem credenciais ou parâmetros.');
  // Only relative object keys are persisted; the browser loads media directly from R2.
  const avatarPath = 'icons/Icons/1.jpg';
  base.pathname = `${base.pathname.replace(/\/$/u, '')}/`;
  const siteUrl = readSiteUrl(env.SITE_URL ?? (env.APP_ENV === 'development' ? `http://localhost:${Number(rawPort)}` : undefined), env.APP_ENV === 'production');
  const oauth = readDiscordOAuth(env, siteUrl);
  const mockBotToken = readMockBotToken(env, devMock);
  // Role própria do site (`kuruttina_site`), distinta da do bot: privilégios mínimos por capacidade.
  const database = readDatabaseConfig(env, env.APP_ENV, 'runtime', 'kuruttina_site');
  return Object.freeze({
    target: env.APP_ENV,
    port: Number(rawPort),
    host: readHost(env.HOST),
    siteUrl,
    assetsOrigin: base.origin,
    avatarUrl: new URL(avatarPath, base).href,
    devMock,
    mockBotToken,
    oauth,
    sessionFile: readSessionFile(env),
    database,
  });
}
