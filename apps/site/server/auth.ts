import { createHash, randomBytes } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { readSiteConfig } from './config.js';

type SiteConfig = ReturnType<typeof readSiteConfig>;
type SessionGuild = { id: string; name: string; iconUrl: string | null; members: number | null };
type SessionUser = { label: string; avatarUrl: string | null };
type Session = { expires: number; user: SessionUser; guilds: SessionGuild[] };
type DiscordGuild = { id?: unknown; name?: unknown; icon?: unknown; owner?: unknown; permissions?: unknown; approximate_member_count?: unknown };

const discordApi = 'https://discord.com/api/v10';
const sessionCookie = 'kuruttina_session';
const oauthCookie = 'kuruttina_oauth';
const sessionTtlSeconds = 8 * 60 * 60;
const oauthTtlSeconds = 10 * 60;
const maxSessions = 20;
const maxPending = 50;
const maxGuilds = 100;
const snowflake = /^[1-9][0-9]{16,19}$/u;
const iconHash = /^(?:a_)?[a-f0-9]{1,64}$/u;
// ADMINISTRATOR (0x8) ou MANAGE_GUILD (0x20): quem pode configurar um servidor.
const manageBits = 0x28n;

const hashToken = (token: string): string => createHash('sha256').update(token).digest('hex');
const randomToken = (): string => randomBytes(32).toString('base64url');

function readCookie(header: string | undefined, name: string): string {
  for (const part of (header ?? '').split(';')) {
    const [key, ...value] = part.trim().split('=');
    if (key === name) return value.join('=');
  }
  return '';
}

function sendJson(res: ServerResponse, status: number, body: unknown, headers: Record<string, string | string[]> = {}): void {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers }).end(JSON.stringify(body));
}

async function discordRequest(path: string, init: RequestInit): Promise<unknown> {
  const response = await fetch(discordApi + path, { ...init, signal: AbortSignal.timeout(5_000) });
  if (!response.ok) throw new Error(`Discord respondeu ${response.status}.`);
  return response.json();
}

function toSessionGuild(raw: DiscordGuild): SessionGuild | null {
  if (typeof raw.id !== 'string' || !snowflake.test(raw.id) || typeof raw.name !== 'string') return null;
  const icon = typeof raw.icon === 'string' && iconHash.test(raw.icon) ? raw.icon : null;
  return {
    id: raw.id,
    name: raw.name.slice(0, 100),
    iconUrl: icon ? `https://cdn.discordapp.com/icons/${raw.id}/${icon}.png?size=64` : null,
    members: typeof raw.approximate_member_count === 'number' ? raw.approximate_member_count : null,
  };
}

function canManage(raw: DiscordGuild): boolean {
  if (raw.owner === true) return true;
  try { return (BigInt(typeof raw.permissions === 'string' ? raw.permissions : '0') & manageBits) !== 0n; } catch { return false; }
}

export function createAuth(config: SiteConfig) {
  const sessions = new Map<string, Session>();
  const pending = new Map<string, { verifier: string; expires: number }>();
  const cookieAttributes = (maxAge: number, sameSite: 'Strict' | 'Lax'): string => `HttpOnly; SameSite=${sameSite}; Path=/; Max-Age=${maxAge}${config.siteUrl.startsWith('https:') ? '; Secure' : ''}`;

  const prune = (): void => {
    const now = Date.now();
    for (const [key, value] of sessions) if (value.expires <= now) sessions.delete(key);
    for (const [key, value] of pending) if (value.expires <= now) pending.delete(key);
  };
  const currentSession = (req: IncomingMessage): Session | undefined => {
    prune();
    return sessions.get(hashToken(readCookie(req.headers.cookie, sessionCookie)));
  };
  const openSession = (user: SessionUser, guilds: SessionGuild[]): string => {
    if (sessions.size >= maxSessions) sessions.delete(sessions.keys().next().value as string);
    const token = randomToken();
    sessions.set(hashToken(token), { expires: Date.now() + sessionTtlSeconds * 1000, user, guilds: guilds.slice(0, maxGuilds) });
    return `${sessionCookie}=${token}; ${cookieAttributes(sessionTtlSeconds, 'Strict')}`;
  };
  const sessionBody = (session: Session | undefined) => ({
    mock: config.mockOwnerId !== undefined,
    discord: config.oauth !== undefined,
    authenticated: session !== undefined,
    ...(session ? { user: session.user, guilds: session.guilds } : {}),
  });

  // Servidores do dev no mock: os do bot onde o OWNER_ID é membro. O mock não tem token OAuth do usuário.
  async function mockGuilds(devId: string): Promise<SessionGuild[]> {
    if (!config.mockBotToken) return [];
    const headers = { Authorization: `Bot ${config.mockBotToken}` };
    const botGuilds = (await discordRequest('/users/@me/guilds?limit=100', { headers })) as DiscordGuild[];
    const checked = await Promise.allSettled(botGuilds.slice(0, 25).map(async (guild) => {
      if (typeof guild.id !== 'string' || !snowflake.test(guild.id)) return null;
      await discordRequest(`/guilds/${guild.id}/members/${devId}`, { headers });
      return toSessionGuild((await discordRequest(`/guilds/${guild.id}?with_counts=true`, { headers })) as DiscordGuild);
    }));
    return checked.flatMap((result) => (result.status === 'fulfilled' && result.value ? [result.value] : []));
  }

  // OWNER_ID pode apontar para o próprio bot. Nesse caso o dev é o dono humano da aplicação (time ou conta), lido pelo token do bot.
  async function resolveDevId(): Promise<string | undefined> {
    if (!config.mockOwnerId) return undefined;
    if (!config.mockBotToken) return config.mockOwnerId;
    const headers = { Authorization: `Bot ${config.mockBotToken}` };
    try {
      const target = (await discordRequest(`/users/${config.mockOwnerId}`, { headers })) as { bot?: unknown };
      if (target.bot !== true) return config.mockOwnerId;
      const app = (await discordRequest('/applications/@me', { headers })) as { team?: { owner_user_id?: unknown } | null; owner?: { id?: unknown } };
      const human = app.team?.owner_user_id ?? app.owner?.id;
      return typeof human === 'string' && snowflake.test(human) ? human : config.mockOwnerId;
    } catch {
      return config.mockOwnerId;
    }
  }

  // Nome e foto do dev no mock, lidos pelo token do bot; sem token ou em falha, cai para "Dev" sem foto.
  async function mockProfile(devId: string): Promise<SessionUser> {
    const fallback = { label: 'Dev', avatarUrl: null };
    if (!config.mockBotToken) return fallback;
    try {
      const profile = (await discordRequest(`/users/${devId}`, { headers: { Authorization: `Bot ${config.mockBotToken}` } })) as { username?: unknown; global_name?: unknown; avatar?: unknown };
      const name = typeof profile.global_name === 'string' && profile.global_name ? profile.global_name : typeof profile.username === 'string' ? profile.username : 'Dev';
      const avatar = typeof profile.avatar === 'string' && iconHash.test(profile.avatar) ? profile.avatar : null;
      return { label: name.slice(0, 64), avatarUrl: avatar ? `https://cdn.discordapp.com/avatars/${devId}/${avatar}.png?size=64` : null };
    } catch {
      return fallback;
    }
  }

  function startLogin(res: ServerResponse): void {
    if (!config.oauth) { res.writeHead(302, { Location: '/login?erro=indisponivel' }).end(); return; }
    prune();
    if (pending.size >= maxPending) pending.delete(pending.keys().next().value as string);
    const state = randomToken();
    const verifier = randomToken();
    pending.set(hashToken(state), { verifier, expires: Date.now() + oauthTtlSeconds * 1000 });
    const query = new URLSearchParams({
      client_id: config.oauth.clientId,
      response_type: 'code',
      redirect_uri: config.oauth.redirectUri,
      scope: 'identify guilds',
      state,
      code_challenge: createHash('sha256').update(verifier).digest('base64url'),
      code_challenge_method: 'S256',
    });
    res.writeHead(302, {
      Location: `https://discord.com/oauth2/authorize?${query}`,
      'Set-Cookie': `${oauthCookie}=${state}; ${cookieAttributes(oauthTtlSeconds, 'Lax')}`,
      'Cache-Control': 'no-store',
    }).end();
  }

  async function finishLogin(req: IncomingMessage, res: ServerResponse, query: URLSearchParams): Promise<void> {
    const clearOauth = `${oauthCookie}=; ${cookieAttributes(0, 'Lax')}`;
    const fail = (): void => { res.writeHead(302, { Location: '/login?erro=login', 'Set-Cookie': clearOauth, 'Cache-Control': 'no-store' }).end(); };
    const state = query.get('state') ?? '';
    const code = query.get('code') ?? '';
    prune();
    const entry = pending.get(hashToken(state));
    pending.delete(hashToken(state));
    if (!config.oauth || !entry || !code || state !== readCookie(req.headers.cookie, oauthCookie)) { fail(); return; }
    try {
      const token = (await discordRequest('/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: config.oauth.clientId,
          client_secret: config.oauth.clientSecret,
          grant_type: 'authorization_code',
          code,
          redirect_uri: config.oauth.redirectUri,
          code_verifier: entry.verifier,
        }),
      })) as { access_token?: unknown };
      if (typeof token.access_token !== 'string') throw new Error('Resposta de token inválida.');
      const headers = { Authorization: `Bearer ${token.access_token}` };
      const profile = (await discordRequest('/users/@me', { headers })) as { id?: unknown; username?: unknown; global_name?: unknown; avatar?: unknown };
      if (typeof profile.id !== 'string' || !snowflake.test(profile.id)) throw new Error('Identidade inválida.');
      const name = typeof profile.global_name === 'string' && profile.global_name ? profile.global_name : typeof profile.username === 'string' ? profile.username : 'Usuário';
      const avatar = typeof profile.avatar === 'string' && iconHash.test(profile.avatar) ? profile.avatar : null;
      const rawGuilds = (await discordRequest('/users/@me/guilds?with_counts=true', { headers })) as DiscordGuild[];
      const guilds = rawGuilds.filter(canManage).flatMap((guild) => { const item = toSessionGuild(guild); return item ? [item] : []; });
      // O access token não é guardado: a lista de servidores vale pela sessão e o login seguinte a renova.
      res.writeHead(302, {
        Location: '/dashboard',
        'Set-Cookie': [openSession({ label: name.slice(0, 64), avatarUrl: avatar ? `https://cdn.discordapp.com/avatars/${profile.id}/${avatar}.png?size=64` : null }, guilds), clearOauth],
        'Cache-Control': 'no-store',
      }).end();
    } catch {
      fail();
    }
  }

  async function mockLogin(res: ServerResponse): Promise<void> {
    if (!config.mockOwnerId) { sendJson(res, 404, { error: 'not_found' }); return; }
    try {
      const devId = (await resolveDevId()) ?? config.mockOwnerId;
      const [guilds, profile] = await Promise.all([mockGuilds(devId), mockProfile(devId)]);
      const user = { label: profile.label, avatarUrl: profile.avatarUrl };
      sendJson(res, 200, sessionBody({ expires: 0, user, guilds }), { 'Set-Cookie': openSession(user, guilds) });
    } catch {
      sendJson(res, 502, { error: 'discord_indisponivel' });
    }
  }

  // Devolve true quando a rota é de autenticação e já foi respondida.
  return function handle(req: IncomingMessage, res: ServerResponse, path: string, search: string): boolean {
    if (path === '/auth/discord' && (req.method === 'GET' || req.method === 'HEAD')) { startLogin(res); return true; }
    if (path === '/auth/callback' && (req.method === 'GET' || req.method === 'HEAD')) { void finishLogin(req, res, new URLSearchParams(search)); return true; }
    if (!path.startsWith('/api/')) return false;
    if (path === '/api/session') {
      if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405, { Allow: 'GET, HEAD' }).end(); return true; }
      sendJson(res, 200, sessionBody(currentSession(req)));
      return true;
    }
    if (path !== '/api/mock-login' && path !== '/api/logout') { sendJson(res, 404, { error: 'not_found' }); return true; }
    if (req.method !== 'POST') { res.writeHead(405, { Allow: 'POST' }).end(); return true; }
    req.resume();
    if (req.headers.origin !== config.siteUrl) { sendJson(res, 403, { error: 'forbidden' }); return true; }
    sessions.delete(hashToken(readCookie(req.headers.cookie, sessionCookie)));
    if (path === '/api/logout') {
      sendJson(res, 200, sessionBody(undefined), { 'Set-Cookie': `${sessionCookie}=; ${cookieAttributes(0, 'Strict')}` });
    } else {
      void mockLogin(res);
    }
    return true;
  };
}
