/**
 * Leituras do Discord feitas pelo servidor do site com o token do bot (nunca com o do usuário).
 * Decisão: docs/decisions/site-holds-bot-token.md. O token fica só aqui, no servidor: nada dele vai ao
 * navegador, a respostas de erro ou a logs. Só existem leituras (GET) de caminhos fixos, montados
 * com IDs já validados; qualquer novo uso do token entra neste arquivo.
 */
import type { readSiteConfig } from './config.js';

type SiteConfig = ReturnType<typeof readSiteConfig>;

export type GuildChannel = { id: string; name: string; type: 'text' | 'announcement'; category: string | null };
export type GuildCategory = { id: string; name: string };
export type GuildRole = { id: string; name: string; color: string | null; managed: boolean };

export type DiscordListResult<T> =
  | { readonly ok: true; readonly items: T[] }
  | { readonly ok: false; readonly reason: 'unavailable' | 'bot_not_in_guild' };

type RawChannel = { id?: unknown; name?: unknown; type?: unknown; parent_id?: unknown; position?: unknown };
type RawRole = { id?: unknown; name?: unknown; color?: unknown; position?: unknown; managed?: unknown };

const discordApi = 'https://discord.com/api/v10';
const snowflake = /^[1-9][0-9]{16,19}$/u;
const CATEGORY = 4;
const channelTypes: Record<number, GuildChannel['type']> = { 0: 'text', 5: 'announcement' };
const cacheMs = 30_000;
const maxCachedPaths = 300;
const maxItems = 500;

const position = (value: unknown): number => (typeof value === 'number' && Number.isFinite(value) ? value : 0);

function rawChannels(raw: unknown): RawChannel[] {
  if (!Array.isArray(raw)) return [];
  return (raw as RawChannel[]).slice(0, maxItems).filter((entry) => typeof entry?.id === 'string' && snowflake.test(entry.id));
}

function categoriesOf(entries: RawChannel[]): Map<string, { name: string; position: number }> {
  const categories = new Map<string, { name: string; position: number }>();
  for (const entry of entries) {
    if (entry.type === CATEGORY && typeof entry.name === 'string') categories.set(entry.id as string, { name: entry.name.slice(0, 100), position: position(entry.position) });
  }
  return categories;
}

/** Canais de texto e de anúncio, na ordem em que o Discord os mostra (sem categoria primeiro, depois por categoria). */
function toChannels(raw: unknown): GuildChannel[] {
  const entries = rawChannels(raw);
  const categories = categoriesOf(entries);
  return entries
    .flatMap((entry) => {
      const type = typeof entry.type === 'number' ? channelTypes[entry.type] : undefined;
      if (!type || typeof entry.name !== 'string') return [];
      const category = typeof entry.parent_id === 'string' ? categories.get(entry.parent_id) : undefined;
      return [{ channel: { id: entry.id as string, name: entry.name.slice(0, 100), type, category: category?.name ?? null }, order: [category ? category.position : -1, position(entry.position)] as const }];
    })
    .sort((a, b) => a.order[0] - b.order[0] || a.order[1] - b.order[1])
    .map(({ channel }) => channel);
}

function toCategories(raw: unknown): GuildCategory[] {
  const entries = rawChannels(raw);
  return [...categoriesOf(entries)]
    .sort((a, b) => a[1].position - b[1].position)
    .map(([id, category]) => ({ id, name: category.name }));
}

/** Cargos do servidor, do mais alto ao mais baixo como no Discord; o `@everyone` (mesmo id do servidor) fica de fora. */
function toRoles(raw: unknown, guildId: string): GuildRole[] {
  if (!Array.isArray(raw)) return [];
  return (raw as RawRole[])
    .slice(0, maxItems)
    .filter((entry) => typeof entry?.id === 'string' && snowflake.test(entry.id) && entry.id !== guildId && typeof entry.name === 'string')
    .sort((a, b) => position(b.position) - position(a.position))
    .map((entry) => ({
      id: entry.id as string,
      name: (entry.name as string).slice(0, 100),
      color: typeof entry.color === 'number' && entry.color > 0 && entry.color <= 0xffffff ? `#${entry.color.toString(16).padStart(6, '0')}` : null,
      managed: entry.managed === true,
    }));
}

export function createDiscordBot(config: SiteConfig) {
  const cache = new Map<string, { expires: number; json: unknown }>();

  /** Lê um caminho do Discord com o token do bot. Sem token, sem o bot no servidor ou com o Discord fora do ar, devolve só o motivo. */
  async function read(guildId: string, path: string): Promise<{ ok: true; json: unknown } | { ok: false; reason: 'unavailable' | 'bot_not_in_guild' }> {
    if (!config.botToken || !snowflake.test(guildId)) return { ok: false, reason: 'unavailable' };
    const cached = cache.get(path);
    if (cached && cached.expires > Date.now()) return { ok: true, json: cached.json };
    let response: Response;
    try {
      response = await fetch(discordApi + path, { headers: { Authorization: `Bot ${config.botToken}` }, signal: AbortSignal.timeout(5_000) });
    } catch {
      return { ok: false, reason: 'unavailable' };
    }
    // 403/404: o bot não está nesse servidor (ou perdeu o acesso).
    if (response.status === 403 || response.status === 404) return { ok: false, reason: 'bot_not_in_guild' };
    if (!response.ok) return { ok: false, reason: 'unavailable' };
    let json: unknown;
    try {
      json = await response.json();
    } catch {
      return { ok: false, reason: 'unavailable' };
    }
    if (cache.size >= maxCachedPaths) cache.delete(cache.keys().next().value as string);
    cache.set(path, { expires: Date.now() + cacheMs, json });
    return { ok: true, json };
  }

  async function list<T>(guildId: string, path: string, parse: (json: unknown) => T[]): Promise<DiscordListResult<T>> {
    const result = await read(guildId, path);
    return result.ok ? { ok: true, items: parse(result.json) } : result;
  }

  return {
    listChannels: (guildId: string) => list(guildId, `/guilds/${guildId}/channels`, toChannels),
    // Categorias e canais vêm da mesma chamada ao Discord, que o cache compartilha.
    listCategories: (guildId: string) => list(guildId, `/guilds/${guildId}/channels`, toCategories),
    listRoles: (guildId: string) => list(guildId, `/guilds/${guildId}/roles`, (json) => toRoles(json, guildId)),
  };
}

export type DiscordBot = ReturnType<typeof createDiscordBot>;
