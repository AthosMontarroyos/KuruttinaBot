/**
 * API de grupos de cargos (`/api/guilds/:guildId/role-groups`), consumida só pelo painel do site.
 * Autenticação e autorização por servidor vêm de `auth.ts` (`getAuthorizedGuild`). Cada cargo
 * enviado precisa existir no servidor e não ser gerenciado (bots e integrações) — conferido no
 * Discord com a mesma lista do seletor de cargos, não confiando no navegador.
 */
import { createDatabase } from '@kuruttina/database';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { createAuth } from './auth.js';
import type { readSiteConfig } from './config.js';
import type { DiscordBot } from './discord.js';
import { isDiscordSnowflake, readJsonBody, rejectUnlessGuildAuthorized, requireSameOrigin, sendJson } from './http-utils.js';

type SiteConfig = ReturnType<typeof readSiteConfig>;
type Auth = ReturnType<typeof createAuth>;
type Database = ReturnType<typeof createDatabase>;

const MAX_ROLES_PER_GROUP = 25;
const MAX_NAME_LENGTH = 50;
const groupPath = /^\/api\/guilds\/([^/]+)\/role-groups(?:\/([^/]+))?$/u;
const idPattern = /^[1-9][0-9]*$/u;

type ValidBody = { name: string; roleIds: string[] };

/** Valida nome e cargos enviados. Devolve `null` quando o corpo é inválido. */
function parseBody(body: unknown): { ok: true; value: ValidBody } | { ok: false; error: string } {
  if (typeof body !== 'object' || body === null) return { ok: false, error: 'invalid_json' };
  const { name, roleIds } = body as { name?: unknown; roleIds?: unknown };
  if (typeof name !== 'string') return { ok: false, error: 'invalid_group_name' };
  const trimmed = name.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_NAME_LENGTH) return { ok: false, error: 'invalid_group_name' };
  if (!Array.isArray(roleIds) || roleIds.length > MAX_ROLES_PER_GROUP || !roleIds.every(isDiscordSnowflake)) {
    return { ok: false, error: 'invalid_roles' };
  }
  if (new Set(roleIds).size !== roleIds.length) return { ok: false, error: 'duplicate_role' };
  return { ok: true, value: { name: trimmed, roleIds: roleIds as string[] } };
}

export function createRoleGroupsApi(config: SiteConfig, auth: Auth, database: Database, discord: DiscordBot) {
  function authorize(req: IncomingMessage, res: ServerResponse, guildId: string): { discordId: string } | undefined {
    return rejectUnlessGuildAuthorized(res, guildId, () => auth.getAuthorizedGuild(req, guildId));
  }

  /** Confere que todos os cargos existem no servidor e podem ser dados à mão. Responde o erro e devolve `false` se não. */
  async function assertAssignableRoles(res: ServerResponse, guildId: string, roleIds: readonly string[]): Promise<boolean> {
    if (roleIds.length === 0) return true;
    const result = await discord.listRoles(guildId);
    if (!result.ok) { sendJson(res, result.reason === 'bot_not_in_guild' ? 409 : 503, { error: result.reason }); return false; }
    const assignable = new Set(result.items.filter((role) => !role.managed).map((role) => role.id));
    if (roleIds.some((roleId) => !assignable.has(roleId))) { sendJson(res, 422, { error: 'invalid_roles' }); return false; }
    return true;
  }

  async function readBody(req: IncomingMessage, res: ServerResponse): Promise<ValidBody | undefined> {
    let body: unknown;
    try { body = await readJsonBody(req, 4_000); } catch { sendJson(res, 413, { error: 'too_large' }); return undefined; }
    const parsed = parseBody(body);
    if (!parsed.ok) { sendJson(res, 422, { error: parsed.error }); return undefined; }
    return parsed.value;
  }

  /** Códigos de conflito do banco e de regra, conforme `database.roleGroups`. */
  function writeError(res: ServerResponse, code: string): void {
    const map: Record<string, [number, string]> = {
      quota: [409, 'quota'],
      duplicate: [409, 'duplicate'],
      duplicate_role: [422, 'duplicate_role'],
      conflict: [409, 'conflict'],
      not_found: [404, 'not_found'],
    };
    const [status, error] = map[code] ?? [503, 'unavailable'];
    sendJson(res, status, { error });
  }

  async function handleList(res: ServerResponse, guildId: string): Promise<void> {
    const items = await database.roleGroups.list(guildId);
    sendJson(res, 200, {
      items: items.map((group) => ({ ...group, createdAt: group.createdAt.toISOString(), updatedAt: group.updatedAt.toISOString() })),
    });
  }

  async function handleCreate(req: IncomingMessage, res: ServerResponse, guildId: string, actorId: string): Promise<void> {
    const body = await readBody(req, res);
    if (body === undefined) return;
    if (!(await assertAssignableRoles(res, guildId, body.roleIds))) return;
    const result = await database.roleGroups.create({ guildId, name: body.name, roleIds: body.roleIds, actorId });
    if (!result.ok) { writeError(res, result.code); return; }
    sendJson(res, 201, { id: result.id, version: 1 });
  }

  async function handleUpdate(req: IncomingMessage, res: ServerResponse, guildId: string, id: number, actorId: string): Promise<void> {
    let body: unknown;
    try { body = await readJsonBody(req, 4_000); } catch { sendJson(res, 413, { error: 'too_large' }); return; }
    const expectedVersion = (body as { expectedVersion?: unknown } | null)?.expectedVersion;
    if (typeof expectedVersion !== 'number' || !Number.isInteger(expectedVersion) || expectedVersion < 1) {
      sendJson(res, 422, { error: 'invalid_json' });
      return;
    }
    const parsed = parseBody(body);
    if (!parsed.ok) { sendJson(res, 422, { error: parsed.error }); return; }
    if (!(await assertAssignableRoles(res, guildId, parsed.value.roleIds))) return;
    const result = await database.roleGroups.update({
      guildId, id, expectedVersion, name: parsed.value.name, roleIds: parsed.value.roleIds, actorId,
    });
    if (!result.ok) { writeError(res, result.code); return; }
    sendJson(res, 200, { id, version: result.version });
  }

  async function handleDelete(res: ServerResponse, guildId: string, id: number): Promise<void> {
    const removed = await database.roleGroups.remove(guildId, id);
    if (!removed) { sendJson(res, 404, { error: 'not_found' }); return; }
    sendJson(res, 200, { ok: true });
  }

  // Devolve true quando a rota é de grupos de cargos e já foi (ou será) respondida.
  const handle = function handle(req: IncomingMessage, res: ServerResponse, path: string): boolean {
    const match = groupPath.exec(path);
    if (!match) return false;
    const [, guildId = '', id] = match;
    const run = (work: (discordId: string) => Promise<void>) => {
      const authorization = authorize(req, res, guildId);
      if (authorization === undefined) return;
      void work(authorization.discordId).catch(() => { if (!res.headersSent) sendJson(res, 503, { error: 'unavailable' }); });
    };
    const requireOrigin = (): boolean => requireSameOrigin(req, res, config.siteUrl);

    if (id === undefined) {
      if (req.method === 'GET' || req.method === 'HEAD') { run(() => handleList(res, guildId)); return true; }
      if (req.method === 'POST') {
        if (requireOrigin()) run((discordId) => handleCreate(req, res, guildId, discordId));
        return true;
      }
      res.writeHead(405, { Allow: 'GET, HEAD, POST' }).end();
      return true;
    }

    if (!idPattern.test(id)) { sendJson(res, 404, { error: 'not_found' }); return true; }
    const numericId = Number(id);
    if (req.method === 'PUT') {
      if (requireOrigin()) run((discordId) => handleUpdate(req, res, guildId, numericId, discordId));
      return true;
    }
    if (req.method === 'DELETE') {
      if (requireOrigin()) run(() => handleDelete(res, guildId, numericId));
      return true;
    }
    res.writeHead(405, { Allow: 'PUT, DELETE' }).end();
    return true;
  };

  return { handle };
}
