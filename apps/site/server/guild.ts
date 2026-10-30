/**
 * API de leituras do servidor (`GET /api/guilds/:guildId/channels|categories|roles`), consumida só pelo
 * painel do site, nos seletores de canal, categoria e cargo. Autorização por servidor vem de `auth.ts`
 * (`getAuthorizedGuild`); a leitura no Discord, de `discord.ts`.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { createAuth } from './auth.js';
import type { DiscordBot, DiscordListResult } from './discord.js';
import { rejectUnlessGuildAuthorized, sendJson } from './http-utils.js';

type Auth = ReturnType<typeof createAuth>;
type Lists = 'channels' | 'categories' | 'roles';

const listPath = /^\/api\/guilds\/([^/]+)\/(channels|categories|roles)$/u;

export function createGuildApi(auth: Auth, discord: DiscordBot) {
  const readers: Record<Lists, (guildId: string) => Promise<DiscordListResult<unknown>>> = {
    channels: (guildId) => discord.listChannels(guildId),
    categories: (guildId) => discord.listCategories(guildId),
    roles: (guildId) => discord.listRoles(guildId),
  };

  async function respond(req: IncomingMessage, res: ServerResponse, guildId: string, list: Lists): Promise<void> {
    if (!rejectUnlessGuildAuthorized(res, guildId, () => auth.getAuthorizedGuild(req, guildId))) return;
    const result = await readers[list](guildId);
    if (result.ok) { sendJson(res, 200, { items: result.items }); return; }
    sendJson(res, result.reason === 'bot_not_in_guild' ? 409 : 503, { error: result.reason });
  }

  // Devolve true quando a rota é de uma dessas listas e já foi (ou será) respondida.
  const handle = function handle(req: IncomingMessage, res: ServerResponse, path: string): boolean {
    const match = listPath.exec(path);
    if (!match) return false;
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405, { Allow: 'GET, HEAD' }).end(); return true; }
    void respond(req, res, match[1] ?? '', match[2] as Lists).catch(() => { if (!res.headersSent) sendJson(res, 503, { error: 'unavailable' }); });
    return true;
  };

  return { handle };
}
