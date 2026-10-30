/**
 * Leituras do Discord feitas pelo servidor do site com o token do bot (nunca com o do usuário).
 * Decisão: docs/decisions/site-holds-bot-token.md. O token fica só aqui, no servidor: nada dele vai ao
 * navegador, a respostas de erro ou a logs. Só existem leituras (GET) de caminhos fixos, montados
 * com IDs já validados; qualquer novo uso do token entra neste arquivo.
 */
import type { readSiteConfig } from './config.js';
import { isDiscordSnowflake } from './http-utils.js';

type SiteConfig = ReturnType<typeof readSiteConfig>;

export type GuildChannel = { id: string; name: string; type: 'text' | 'announcement'; category: string | null };
/** Canal de voz (`voice`) ou de palco (`stage`). */
export type GuildVoiceChannel = { id: string; name: string; type: 'voice' | 'stage'; category: string | null };
export type GuildCategory = { id: string; name: string };
/** `iconUrl` e `unicodeEmoji` são os ícones que o Discord dá ao cargo (ambos podem faltar). */
export type GuildRole = { id: string; name: string; color: string | null; managed: boolean; iconUrl: string | null; unicodeEmoji: string | null };
/** Emoji personalizado do servidor; `url` é a imagem no CDN do Discord (PNG, ou GIF se animado). */
export type GuildEmoji = { id: string; name: string; animated: boolean; url: string };

export type DiscordListResult<T> =
  | { readonly ok: true; readonly items: T[] }
  | { readonly ok: false; readonly reason: 'unavailable' | 'bot_not_in_guild' };

type RawChannel = { id?: unknown; name?: unknown; type?: unknown; parent_id?: unknown; position?: unknown };
type RawRole = { id?: unknown; name?: unknown; color?: unknown; position?: unknown; managed?: unknown; icon?: unknown; unicode_emoji?: unknown };
type RawEmoji = { id?: unknown; name?: unknown; animated?: unknown; available?: unknown };

const discordApi = 'https://discord.com/api/v10';
const CATEGORY = 4;
const channelTypes: Record<number, GuildChannel['type']> = { 0: 'text', 5: 'announcement' };
const voiceChannelTypes: Record<number, GuildVoiceChannel['type']> = { 2: 'voice', 13: 'stage' };
const cacheMs = 30_000;
const maxCachedPaths = 300;
const maxItems = 500;

const position = (value: unknown): number => (typeof value === 'number' && Number.isFinite(value) ? value : 0);

function rawChannels(raw: unknown): RawChannel[] {
  if (!Array.isArray(raw)) return [];
  return (raw as RawChannel[]).slice(0, maxItems).filter((entry) => typeof entry?.id === 'string' && isDiscordSnowflake(entry.id));
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

/** Canais de voz e de palco, na mesma ordem de `toChannels` (sem categoria primeiro, depois por categoria). */
function toVoiceChannels(raw: unknown): GuildVoiceChannel[] {
  const entries = rawChannels(raw);
  const categories = categoriesOf(entries);
  return entries
    .flatMap((entry) => {
      const type = typeof entry.type === 'number' ? voiceChannelTypes[entry.type] : undefined;
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
    .filter((entry) => typeof entry?.id === 'string' && isDiscordSnowflake(entry.id) && entry.id !== guildId && typeof entry.name === 'string')
    .sort((a, b) => position(b.position) - position(a.position))
    .map((entry) => ({
      id: entry.id as string,
      name: (entry.name as string).slice(0, 100),
      color: typeof entry.color === 'number' && entry.color > 0 && entry.color <= 0xffffff ? `#${entry.color.toString(16).padStart(6, '0')}` : null,
      managed: entry.managed === true,
      iconUrl: typeof entry.icon === 'string' && /^[A-Za-z0-9_]+$/u.test(entry.icon)
        ? `https://cdn.discordapp.com/role-icons/${entry.id as string}/${entry.icon}.png`
        : null,
      unicodeEmoji: typeof entry.unicode_emoji === 'string' && entry.unicode_emoji.length > 0 ? entry.unicode_emoji.slice(0, 32) : null,
    }));
}

/** Emojis personalizados do servidor, por nome (sem diferenciar maiúsculas). Emoji indisponível (`available: false`) fica de fora. */
function toEmojis(raw: unknown): GuildEmoji[] {
  if (!Array.isArray(raw)) return [];
  return (raw as RawEmoji[])
    .slice(0, maxItems)
    .filter((entry) => typeof entry?.id === 'string' && isDiscordSnowflake(entry.id) && typeof entry.name === 'string' && entry.available !== false)
    .map((entry) => {
      const id = entry.id as string;
      const animated = entry.animated === true;
      return {
        id,
        name: (entry.name as string).slice(0, 32),
        animated,
        url: `https://cdn.discordapp.com/emojis/${id}.${animated ? 'gif' : 'png'}`,
      };
    })
    .sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()) || a.id.localeCompare(b.id));
}

export function createDiscordBot(config: SiteConfig) {
  const cache = new Map<string, { expires: number; json: unknown }>();

  /** Lê um caminho do Discord com o token do bot. Sem token, sem o bot no servidor ou com o Discord fora do ar, devolve só o motivo. */
  async function read(guildId: string, path: string): Promise<{ ok: true; json: unknown } | { ok: false; reason: 'unavailable' | 'bot_not_in_guild' }> {
    if (!config.botToken || !isDiscordSnowflake(guildId)) return { ok: false, reason: 'unavailable' };
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
    // Categorias e canais (de texto ou de voz) vêm da mesma chamada ao Discord, que o cache compartilha.
    listCategories: (guildId: string) => list(guildId, `/guilds/${guildId}/channels`, toCategories),
    listVoiceChannels: (guildId: string) => list(guildId, `/guilds/${guildId}/channels`, toVoiceChannels),
    listRoles: (guildId: string) => list(guildId, `/guilds/${guildId}/roles`, (json) => toRoles(json, guildId)),
    listEmojis: (guildId: string) => list(guildId, `/guilds/${guildId}/emojis`, toEmojis),
  };
}

export type DiscordBot = ReturnType<typeof createDiscordBot>;
