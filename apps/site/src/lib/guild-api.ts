/**
 * Listas do servidor lidas de `GET /api/guilds/:guildId/(channels|categories|roles|voice-channels|emojis)`. O servidor do site
 * consulta o Discord com o token do bot; o navegador só recebe nomes e IDs.
 */
type Channel = { id: string; name: string; type: 'text' | 'announcement'; category: string | null };
type VoiceChannel = { id: string; name: string; type: 'voice' | 'stage'; category: string | null };
type Category = { id: string; name: string };
type Role = { id: string; name: string; color: string | null; managed: boolean; iconUrl: string | null; unicodeEmoji: string | null };
type GuildEmoji = { id: string; name: string; animated: boolean; url: string };

type GuildListError = 'unauthenticated' | 'not_found' | 'bot_not_in_guild' | 'unavailable';
type GuildListResult<T> = { ok: true; items: T[] } | { ok: false; error: GuildListError };

const knownErrors: GuildListError[] = ['unauthenticated', 'not_found', 'bot_not_in_guild', 'unavailable'];

async function readList<T>(guildId: string, list: 'channels' | 'categories' | 'roles' | 'voice-channels' | 'emojis'): Promise<GuildListResult<T>> {
  let response: Response;
  try {
    response = await fetch(`/api/guilds/${encodeURIComponent(guildId)}/${list}`, { method: 'GET', credentials: 'same-origin' });
  } catch {
    return { ok: false, error: 'unavailable' };
  }
  try {
    const body = (await response.json()) as { items?: unknown; error?: unknown };
    if (response.ok && Array.isArray(body.items)) return { ok: true, items: body.items as T[] };
    return { ok: false, error: knownErrors.find((known) => known === body.error) ?? 'unavailable' };
  } catch {
    return { ok: false, error: 'unavailable' };
  }
}

const listChannels = (guildId: string) => readList<Channel>(guildId, 'channels');
const listCategories = (guildId: string) => readList<Category>(guildId, 'categories');
const listRoles = (guildId: string) => readList<Role>(guildId, 'roles');
const listVoiceChannels = (guildId: string) => readList<VoiceChannel>(guildId, 'voice-channels');
const listEmojis = (guildId: string) => readList<GuildEmoji>(guildId, 'emojis');

export { listChannels, listCategories, listRoles, listVoiceChannels, listEmojis };
export type { Channel, VoiceChannel, Category, Role, GuildEmoji, GuildListError, GuildListResult };
