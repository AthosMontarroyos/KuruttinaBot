import { createHash, randomBytes } from 'node:crypto';
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { readSiteConfig } from './config.js';

type SiteConfig = ReturnType<typeof readSiteConfig>;
type SessionGuild = { id: string; name: string; iconUrl: string | null; members: number | null };
// `id` é o Discord ID canônico de quem logou: usado só no servidor (auditoria de quem criou/editou
// um template) e nunca devolvido ao cliente em `sessionBody` (exposição mínima).
type SessionUser = { id: string; label: string; avatarUrl: string | null };
type PublicSessionUser = { label: string; avatarUrl: string | null };
type Session = { created: number; expires: number; user: SessionUser; guilds: SessionGuild[] };
type DiscordGuild = { id?: unknown; name?: unknown; icon?: unknown; owner?: unknown; permissions?: unknown; approximate_member_count?: unknown };

const discordApi = 'https://discord.com/api/v10';
const sessionCookie = 'kuruttina_session';
const oauthCookie = 'kuruttina_oauth';
const idleTtlSeconds = 7 * 24 * 60 * 60;
const absoluteTtlSeconds = 14 * 24 * 60 * 60;
const renewStepMs = 60 * 60 * 1000;
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

// Só carrega o que tem o formato esperado e ainda não expirou; arquivo ausente ou ilegível vira lista vazia.
function loadSessions(file: string | undefined): Array<[string, Session]> {
  if (!file) return [];
  try {
    const raw = JSON.parse(readFileSync(file, 'utf8')) as Record<string, Partial<Session>>;
    const now = Date.now();
    return Object.entries(raw).flatMap(([key, value]) => {
      const user = value.user;
      if (!/^[a-f0-9]{64}$/u.test(key) || typeof value.expires !== 'number' || typeof value.created !== 'number') return [];
      if (value.expires <= now || value.created + absoluteTtlSeconds * 1000 <= now) return [];
      if (!user || typeof user.id !== 'string' || !snowflake.test(user.id)) return [];
      if (typeof user.label !== 'string' || !(user.avatarUrl === null || typeof user.avatarUrl === 'string') || !Array.isArray(value.guilds)) return [];
      const guilds = value.guilds.filter((guild): guild is SessionGuild => typeof guild?.id === 'string' && snowflake.test(guild.id) && typeof guild.name === 'string');
      return [[key, { created: value.created, expires: Math.min(value.expires, value.created + absoluteTtlSeconds * 1000), user, guilds: guilds.slice(0, maxGuilds) }] as [string, Session]];
    }).slice(0, maxSessions);
  } catch {
    return [];
  }
}

export function createAuth(config: SiteConfig) {
  const sessions = new Map<string, Session>(loadSessions(config.sessionFile));
  let saveTimer: NodeJS.Timeout | undefined;
  // Grava em disco logo depois da última mudança, de forma atômica; falha de disco não derruba o login.
  const persist = (): void => {
    const file = config.sessionFile;
    if (!file || saveTimer) return;
    saveTimer = setTimeout(() => {
      saveTimer = undefined;
      try {
        mkdirSync(dirname(file), { recursive: true });
        writeFileSync(file + '.tmp', JSON.stringify(Object.fromEntries(sessions)), { mode: 0o600 });
        renameSync(file + '.tmp', file);
      } catch { /* mantém as sessões em memória */ }
    }, 200);
    saveTimer.unref();
  };
  const pending = new Map<string, { verifier: string; expires: number }>();
  const cookieAttributes = (maxAge: number, sameSite: 'Strict' | 'Lax'): string => `HttpOnly; SameSite=${sameSite}; Path=/; Max-Age=${maxAge}${config.siteUrl.startsWith('https:') ? '; Secure' : ''}`;

  const prune = (): void => {
    const now = Date.now();
    for (const [key, value] of sessions) if (value.expires <= now || value.created + absoluteTtlSeconds * 1000 <= now) { sessions.delete(key); persist(); }
    for (const [key, value] of pending) if (value.expires <= now) pending.delete(key);
  };
  const currentSession = (req: IncomingMessage): Session | undefined => {
    prune();
    const session = sessions.get(hashToken(readCookie(req.headers.cookie, sessionCookie)));
    if (session) {
      // Cada acesso renova por mais 7 dias, sem passar de 14 dias desde o login; grava só se mudou mais de 1 hora.
      const renewed = Math.min(Date.now() + idleTtlSeconds * 1000, session.created + absoluteTtlSeconds * 1000);
      if (renewed - session.expires > renewStepMs) { session.expires = renewed; persist(); }
    }
    return session;
  };
  const openSession = (user: SessionUser, guilds: SessionGuild[]): string => {
    if (sessions.size >= maxSessions) sessions.delete(sessions.keys().next().value as string);
    const token = randomToken();
    const now = Date.now();
    sessions.set(hashToken(token), { created: now, expires: now + idleTtlSeconds * 1000, user, guilds: guilds.slice(0, maxGuilds) });
    persist();
    return `${sessionCookie}=${token}; ${cookieAttributes(absoluteTtlSeconds, 'Strict')}`;
  };
  // `id` do Discord nunca sai para o cliente: fica só para auditoria no servidor (ex.: quem criou um template).
  const toPublicUser = ({ label, avatarUrl }: SessionUser): PublicSessionUser => ({ label, avatarUrl });
  const sessionBody = (session: Session | undefined) => ({
    mock: config.mockOwnerId !== undefined,
    discord: config.oauth !== undefined,
    authenticated: session !== undefined,
    ...(session ? { user: toPublicUser(session.user), guilds: session.guilds } : {}),
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
    const fallback = { id: devId, label: 'Dev', avatarUrl: null };
    if (!config.mockBotToken) return fallback;
    try {
      const profile = (await discordRequest(`/users/${devId}`, { headers: { Authorization: `Bot ${config.mockBotToken}` } })) as { username?: unknown; global_name?: unknown; avatar?: unknown };
      const name = typeof profile.global_name === 'string' && profile.global_name ? profile.global_name : typeof profile.username === 'string' ? profile.username : 'Dev';
      const avatar = typeof profile.avatar === 'string' && iconHash.test(profile.avatar) ? profile.avatar : null;
      return { id: devId, label: name.slice(0, 64), avatarUrl: avatar ? `https://cdn.discordapp.com/avatars/${devId}/${avatar}.png?size=64` : null };
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
        'Set-Cookie': [openSession({ id: profile.id, label: name.slice(0, 64), avatarUrl: avatar ? `https://cdn.discordapp.com/avatars/${profile.id}/${avatar}.png?size=64` : null }, guilds), clearOauth],
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
      const [guilds, user] = await Promise.all([mockGuilds(devId), mockProfile(devId)]);
      sendJson(res, 200, sessionBody({ created: 0, expires: 0, user, guilds }), { 'Set-Cookie': openSession(user, guilds) });
    } catch {
      sendJson(res, 502, { error: 'discord_indisponivel' });
    }
  }

  // Para outros módulos de API (ex.: templates): confirma sessão e que o servidor está entre os que o usuário administra.
  // Devolve o Discord ID só para auditoria no servidor; nunca o reenvie ao cliente.
  // Distingue "sem sessão" (401, peça login) de "sessão sem acesso a este servidor" (404, sem revelar o motivo).
  type GuildAuthorization =
    | { readonly status: 'unauthenticated' }
    | { readonly status: 'forbidden' }
    | { readonly status: 'ok'; readonly discordId: string };
  function getAuthorizedGuild(req: IncomingMessage, guildId: string): GuildAuthorization {
    const session = currentSession(req);
    if (!session) return { status: 'unauthenticated' };
    if (!session.guilds.some((guild) => guild.id === guildId)) return { status: 'forbidden' };
    return { status: 'ok', discordId: session.user.id };
  }

  // Mesma política de CSRF usada em `/api/logout` e `/api/mock-login`: a mutation só aceita o Origin configurado.
  const isSameOrigin = (req: IncomingMessage): boolean => req.headers.origin === config.siteUrl;

  // Devolve true quando a rota é de autenticação e já foi respondida.
  const handle = function handle(req: IncomingMessage, res: ServerResponse, path: string, search: string): boolean {
    if (path === '/auth/discord' && (req.method === 'GET' || req.method === 'HEAD')) { startLogin(res); return true; }
    if (path === '/auth/callback' && (req.method === 'GET' || req.method === 'HEAD')) { void finishLogin(req, res, new URLSearchParams(search)); return true; }
    if (!path.startsWith('/api/')) return false;
    if (path === '/api/session') {
      if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405, { Allow: 'GET, HEAD' }).end(); return true; }
      sendJson(res, 200, sessionBody(currentSession(req)));
      return true;
    }
    // Outras rotas de API (ex.: templates de mensagem) são de outro módulo; não decide 404 por elas.
    if (path !== '/api/mock-login' && path !== '/api/logout') return false;
    if (req.method !== 'POST') { res.writeHead(405, { Allow: 'POST' }).end(); return true; }
    req.resume();
    if (req.headers.origin !== config.siteUrl) { sendJson(res, 403, { error: 'forbidden' }); return true; }
    if (sessions.delete(hashToken(readCookie(req.headers.cookie, sessionCookie)))) persist();
    if (path === '/api/logout') {
      sendJson(res, 200, sessionBody(undefined), { 'Set-Cookie': `${sessionCookie}=; ${cookieAttributes(0, 'Strict')}` });
    } else {
      void mockLogin(res);
    }
    return true;
  };

  return { handle, getAuthorizedGuild, isSameOrigin };
}
