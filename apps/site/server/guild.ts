/**
 * API de leituras do servidor (`GET /api/guilds/:guildId/channels|categories|roles`), consumida só pelo
 * painel do site, nos seletores de canal, categoria e cargo. Autorização por servidor vem de `auth.ts`
 * (`getAuthorizedGuild`); a leitura no Discord, de `discord.ts`.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { createAuth } from './auth.js';
import type { DiscordBot, DiscordListResult } from './discord.js';

type Auth = ReturnType<typeof createAuth>;
type Lists = 'channels' | 'categories' | 'roles';

const guildIdPattern = /^[1-9][0-9]{16,19}$/u;
const listPath = /^\/api\/guilds\/([^/]+)\/(channels|categories|roles)$/u;

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }).end(JSON.stringify(body));
}

export function createGuildApi(auth: Auth, discord: DiscordBot) {
  const readers: Record<Lists, (guildId: string) => Promise<DiscordListResult<unknown>>> = {
    channels: (guildId) => discord.listChannels(guildId),
    categories: (guildId) => discord.listCategories(guildId),
    roles: (guildId) => discord.listRoles(guildId),
  };

  async function respond(req: IncomingMessage, res: ServerResponse, guildId: string, list: Lists): Promise<void> {
    if (!guildIdPattern.test(guildId)) { sendJson(res, 404, { error: 'not_found' }); return; }
    const authorization = auth.getAuthorizedGuild(req, guildId);
    if (authorization.status === 'unauthenticated') { sendJson(res, 401, { error: 'unauthenticated' }); return; }
    if (authorization.status === 'forbidden') { sendJson(res, 404, { error: 'not_found' }); return; }
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
