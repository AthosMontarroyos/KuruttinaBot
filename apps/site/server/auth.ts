import { createHash, randomBytes } from 'node:crypto';
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { readSiteConfig } from './config.js';
import { isDiscordSnowflake, requireSameOrigin, sendJson } from './http-utils.js';

type SiteConfig = ReturnType<typeof readSiteConfig>;
type SessionGuild = { id: string; name: string; iconUrl: string | null; bannerUrl: string | null; members: number | null };
/** Perfil do bot (nome, ID e foto) que o preview das mensagens usa no lugar do usuário que dispara a ação. */
type BotProfile = { id: string; name: string; avatarUrl: string | null };
// `id` é o Discord ID canônico de quem logou: usado só no servidor (auditoria de quem criou/editou
// um template) e nunca devolvido ao cliente em `sessionBody` (exposição mínima).
type SessionUser = { id: string; label: string; avatarUrl: string | null };
type PublicSessionUser = { label: string; avatarUrl: string | null };
type Session = { created: number; expires: number; user: SessionUser; guilds: SessionGuild[] };
type DiscordGuild = { id?: unknown; name?: unknown; icon?: unknown; banner?: unknown; owner?: unknown; permissions?: unknown; approximate_member_count?: unknown };

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

async function discordRequest(path: string, init: RequestInit): Promise<unknown> {
  const response = await fetch(discordApi + path, { ...init, signal: AbortSignal.timeout(5_000) });
  if (!response.ok) throw new Error(`Discord respondeu ${response.status}.`);
  return response.json();
}

function toSessionGuild(raw: DiscordGuild): SessionGuild | null {
  if (typeof raw.id !== 'string' || !isDiscordSnowflake(raw.id) || typeof raw.name !== 'string') return null;
  const icon = typeof raw.icon === 'string' && iconHash.test(raw.icon) ? raw.icon : null;
  const banner = typeof raw.banner === 'string' && iconHash.test(raw.banner) ? raw.banner : null;
  return {
    id: raw.id,
    name: raw.name.slice(0, 100),
    iconUrl: icon ? `https://cdn.discordapp.com/icons/${raw.id}/${icon}.png?size=64` : null,
    bannerUrl: banner ? `https://cdn.discordapp.com/banners/${raw.id}/${banner}.png?size=1024` : null,
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
      if (!user || typeof user.id !== 'string' || !isDiscordSnowflake(user.id)) return [];
      if (typeof user.label !== 'string' || !(user.avatarUrl === null || typeof user.avatarUrl === 'string') || !Array.isArray(value.guilds)) return [];
      const guilds = value.guilds.filter((guild): guild is SessionGuild => typeof guild?.id === 'string' && isDiscordSnowflake(guild.id) && typeof guild.name === 'string');
      return [[key, { created: value.created, expires: Math.min(value.expires, value.created + absoluteTtlSeconds * 1000), user, guilds: guilds.slice(0, maxGuilds) }] as [string, Session]];
    }).slice(0, maxSessions);
  } catch {
    return [];
  }
}

export function createAuth(config: SiteConfig, loadActiveDevId: () => Promise<string | null>) {
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
  // Perfil do bot lido pelo token do bot e guardado por 10 minutos; sem token ou em falha, o preview usa o padrão.
  let botCache: { value: BotProfile | null; expires: number } | undefined;
  async function botProfile(): Promise<BotProfile | null> {
    if (!config.botToken) return null;
    if (botCache && botCache.expires > Date.now()) return botCache.value;
    let value: BotProfile | null = null;
    try {
      const raw = (await discordRequest('/users/@me', { headers: { Authorization: `Bot ${config.botToken}` } })) as { id?: unknown; username?: unknown; global_name?: unknown; avatar?: unknown };
      if (typeof raw.id === 'string' && isDiscordSnowflake(raw.id)) {
        const name = typeof raw.global_name === 'string' && raw.global_name ? raw.global_name : raw.username;
        const avatar = typeof raw.avatar === 'string' && iconHash.test(raw.avatar) ? raw.avatar : null;
        if (typeof name === 'string' && name !== '') value = { id: raw.id, name: name.slice(0, 32), avatarUrl: avatar ? `https://cdn.discordapp.com/avatars/${raw.id}/${avatar}.png?size=256` : null };
      }
    } catch {
      value = null;
    }
    botCache = { value, expires: Date.now() + (value ? 600_000 : 30_000) };
    return value;
  }
  const sessionBody = async (session: Session | undefined) => {
    const bot = session ? await botProfile() : null;
    return {
      mock: config.devMock,
      discord: config.oauth !== undefined,
      authenticated: session !== undefined,
      ...(session ? { user: toPublicUser(session.user), guilds: session.guilds, ...(bot ? { bot } : {}) } : {}),
    };
  };

  // Servidores do dev no mock: os do bot em que o user_id ativo de papel dev é membro.
  // Sem token do bot a sessão abre sem servidores. O mock não tem token OAuth do usuário.
  async function mockGuilds(devId: string): Promise<SessionGuild[]> {
    if (!config.botToken) return [];
    const headers = { Authorization: `Bot ${config.botToken}` };
    const botGuilds = (await discordRequest('/users/@me/guilds?limit=100', { headers })) as DiscordGuild[];
    const checked = await Promise.allSettled(botGuilds.slice(0, 25).map(async (guild) => {
      if (typeof guild.id !== 'string' || !isDiscordSnowflake(guild.id)) return null;
      await discordRequest(`/guilds/${guild.id}/members/${devId}`, { headers });
      return toSessionGuild((await discordRequest(`/guilds/${guild.id}?with_counts=true`, { headers })) as DiscordGuild);
    }));
    return checked.flatMap((result) => (result.status === 'fulfilled' && result.value ? [result.value] : []));
  }

  // Nome e foto do dev no mock, lidos pelo token do bot; sem token ou em falha, cai para "Dev" sem foto.
  async function mockProfile(devId: string): Promise<SessionUser> {
    const fallback = { id: devId, label: 'Dev', avatarUrl: null };
    if (!config.botToken) return fallback;
    try {
      const profile = (await discordRequest(`/users/${devId}`, { headers: { Authorization: `Bot ${config.botToken}` } })) as { username?: unknown; global_name?: unknown; avatar?: unknown };
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
      if (typeof profile.id !== 'string' || !isDiscordSnowflake(profile.id)) throw new Error('Identidade inválida.');
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
    if (!config.devMock) { sendJson(res, 404, { error: 'not_found' }); return; }
    let devId: string | null;
    try {
      devId = await loadActiveDevId();
    } catch {
      sendJson(res, 503, { error: 'dev_indisponivel' });
      return;
    }
    if (devId == null) { sendJson(res, 409, { error: 'dev_ausente' }); return; }
    if (!isDiscordSnowflake(devId)) { sendJson(res, 503, { error: 'dev_indisponivel' }); return; }
    try {
      const [guilds, user] = await Promise.all([mockGuilds(devId), mockProfile(devId)]);
      sendJson(res, 200, await sessionBody({ created: 0, expires: 0, user, guilds }), { 'Set-Cookie': openSession(user, guilds) });
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
      void sessionBody(currentSession(req)).then((body) => sendJson(res, 200, body));
      return true;
    }
    // Outras rotas de API (ex.: templates de mensagem) são de outro módulo; não decide 404 por elas.
    if (path !== '/api/mock-login' && path !== '/api/logout') return false;
    if (req.method !== 'POST') { res.writeHead(405, { Allow: 'POST' }).end(); return true; }
    req.resume();
    if (!requireSameOrigin(req, res, config.siteUrl)) return true;
    if (sessions.delete(hashToken(readCookie(req.headers.cookie, sessionCookie)))) persist();
    if (path === '/api/logout') {
      void sessionBody(undefined).then((body) => sendJson(res, 200, body, { 'Set-Cookie': `${sessionCookie}=; ${cookieAttributes(0, 'Strict')}` }));
    } else {
      void mockLogin(res);
    }
    return true;
  };

  return { handle, getAuthorizedGuild, isSameOrigin };
}
