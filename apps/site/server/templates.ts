/**
 * API de templates de mensagem (`/api/guilds/:guildId/templates`), consumida só
 * pelo painel do site. Autenticação e autorização por servidor vêm de `auth.ts`
 * (`getAuthorizedGuild`); a validação de regra de negócio vem do motor
 * compartilhado `@kuruttina/message-templates`. O site nunca importa nada de
 * `apps/bot` (fronteira entre apps).
 */
import { createDatabase } from '@kuruttina/database';
import { createTemplateAdminService, TemplateAdminError, type TemplateRepositoryPort } from '@kuruttina/message-templates';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { createAuth } from './auth.js';
import type { readSiteConfig } from './config.js';
import { isDiscordSnowflake, readJsonBody, sendJson } from './http-utils.js';

type SiteConfig = ReturnType<typeof readSiteConfig>;
type Auth = ReturnType<typeof createAuth>;

const namePattern = /^[a-z0-9_-]{1,32}$/u;
const folderIdPattern = /^[1-9][0-9]*$/u;
const LIST_PAGE_SIZE = 25;

/** Adapta `database.templates` (datas como `Date`, pacote JS) ao port do caso de uso (datas como ISO string). */
function toIso(value: unknown): string {
  return value instanceof Date ? value.toISOString() : String(value);
}

function createTemplateRepository(
  db: ReturnType<typeof createDatabase>['templates'],
  folders: ReturnType<typeof createDatabase>['folders'],
): TemplateRepositoryPort {
  return {
    list: async (guildId, options) => (await db.list(guildId, options)).map((row) => ({ ...row, updatedAt: toIso(row.updatedAt) })),
    get: async (guildId, name) => {
      const row = await db.get(guildId, name);
      return row === null ? null : { ...row, createdAt: toIso(row.createdAt), updatedAt: toIso(row.updatedAt) };
    },
    usage: (guildId) => db.usage(guildId),
    create: (input) => db.create(input),
    update: (input) => db.update(input),
    remove: (guildId, name) => db.remove(guildId, name),
    move: (guildId, name, folderId) => db.move(guildId, name, folderId),
    listFolders: async (guildId) => (await folders.list(guildId)).map((row) => ({ ...row, createdAt: toIso(row.createdAt) })),
    createFolder: (guildId, name) => folders.create({ guildId, name }),
    renameFolder: (guildId, id, name) => folders.rename({ guildId, id, name }),
    removeFolder: (guildId, id) => folders.remove(guildId, id),
  };
}

/** Status HTTP e corpo de erro para cada código de `TemplateAdminError`. */
function adminErrorResponse(error: TemplateAdminError): { status: number; body: Record<string, unknown> } {
  switch (error.code) {
    case 'invalid_name': return { status: 422, body: { error: 'invalid_name' } };
    case 'too_large': return { status: 413, body: { error: 'too_large' } };
    case 'validation': return { status: 422, body: { error: 'validation', details: (error.details ?? []).slice(0, 5) } };
    case 'duplicate': return { status: 409, body: { error: 'duplicate' } };
    case 'quota': return { status: 409, body: { error: 'quota' } };
    case 'not_found': return { status: 404, body: { error: 'not_found' } };
    case 'conflict': return { status: 409, body: { error: 'conflict' } };
    case 'invalid_folder': return { status: 422, body: { error: 'invalid_folder' } };
    case 'invalid_folder_name': return { status: 422, body: { error: 'invalid_folder_name' } };
    case 'folder_not_found': return { status: 404, body: { error: 'folder_not_found' } };
    case 'duplicate_folder': return { status: 409, body: { error: 'duplicate_folder' } };
    default: return { status: 503, body: { error: 'unavailable' } };
  }
}

export function createTemplatesApi(config: SiteConfig, auth: Auth, database: ReturnType<typeof createDatabase>) {
  const service = createTemplateAdminService(createTemplateRepository(database.templates, database.folders));

  function authorize(req: IncomingMessage, res: ServerResponse, guildId: string): { discordId: string } | undefined {
    if (!isDiscordSnowflake(guildId)) { sendJson(res, 404, { error: 'not_found' }); return undefined; }
    const authorization = auth.getAuthorizedGuild(req, guildId);
    if (authorization.status === 'unauthenticated') { sendJson(res, 401, { error: 'unauthenticated' }); return undefined; }
    if (authorization.status === 'forbidden') { sendJson(res, 404, { error: 'not_found' }); return undefined; }
    return { discordId: authorization.discordId };
  }

  async function handleList(req: IncomingMessage, res: ServerResponse, guildId: string, search: string): Promise<void> {
    const after = new URLSearchParams(search).get('after') ?? undefined;
    if (after !== undefined && !namePattern.test(after)) { sendJson(res, 404, { error: 'not_found' }); return; }
    const items = await service.listTemplates(guildId, after === undefined ? { limit: LIST_PAGE_SIZE } : { limit: LIST_PAGE_SIZE, after });
    const nextCursor = items.length === LIST_PAGE_SIZE ? items[items.length - 1]?.name ?? null : null;
    sendJson(res, 200, { items, nextCursor });
  }

  async function handleGet(res: ServerResponse, guildId: string, name: string): Promise<void> {
    const record = await service.getTemplate(guildId, name);
    if (record === null) { sendJson(res, 404, { error: 'not_found' }); return; }
    sendJson(res, 200, record);
  }

  async function handleCreate(req: IncomingMessage, res: ServerResponse, guildId: string, actorId: string): Promise<void> {
    let body: unknown;
    try { body = await readJsonBody(req, 40_000); } catch { sendJson(res, 413, { error: 'too_large' }); return; }
    if (typeof body !== 'object' || body === null) { sendJson(res, 422, { error: 'invalid_json' }); return; }
    const { name, contentJson, folderId } = body as { name?: unknown; contentJson?: unknown; folderId?: unknown };
    if (typeof name !== 'string' || typeof contentJson !== 'string') { sendJson(res, 422, { error: 'invalid_json' }); return; }
    if (folderId !== undefined && folderId !== null && (typeof folderId !== 'number' || !Number.isInteger(folderId) || folderId <= 0)) {
      sendJson(res, 422, { error: 'invalid_folder' });
      return;
    }
    try {
      const record = await service.createTemplate({ guildId, name, contentJson, actorId, folderId: folderId ?? null });
      sendJson(res, 201, { name: record.name, version: record.version });
    } catch (error: unknown) {
      if (error instanceof TemplateAdminError) { const mapped = adminErrorResponse(error); sendJson(res, mapped.status, mapped.body); return; }
      throw error;
    }
  }

  async function handleUpdate(req: IncomingMessage, res: ServerResponse, guildId: string, name: string, actorId: string): Promise<void> {
    let body: unknown;
    try { body = await readJsonBody(req, 40_000); } catch { sendJson(res, 413, { error: 'too_large' }); return; }
    if (typeof body !== 'object' || body === null) { sendJson(res, 422, { error: 'invalid_json' }); return; }
    const { expectedVersion, contentJson, folderId } = body as { expectedVersion?: unknown; contentJson?: unknown; folderId?: unknown };
    if (typeof expectedVersion !== 'number' || !Number.isInteger(expectedVersion) || typeof contentJson !== 'string') {
      sendJson(res, 422, { error: 'invalid_json' });
      return;
    }
    if (folderId !== undefined && folderId !== null && (typeof folderId !== 'number' || !Number.isInteger(folderId) || folderId <= 0)) {
      sendJson(res, 422, { error: 'invalid_folder' });
      return;
    }
    try {
      const record = await service.updateTemplate({ guildId, name, expectedVersion, contentJson, actorId, folderId: folderId ?? null });
      sendJson(res, 200, { name: record.name, version: record.version });
    } catch (error: unknown) {
      if (error instanceof TemplateAdminError) { const mapped = adminErrorResponse(error); sendJson(res, mapped.status, mapped.body); return; }
      throw error;
    }
  }

  async function handleMoveTemplate(req: IncomingMessage, res: ServerResponse, guildId: string, name: string): Promise<void> {
    let body: unknown;
    try { body = await readJsonBody(req, 2_000); } catch { sendJson(res, 413, { error: 'too_large' }); return; }
    if (typeof body !== 'object' || body === null) { sendJson(res, 422, { error: 'invalid_json' }); return; }
    const { folderId } = body as { folderId?: unknown };
    if (folderId !== null && (typeof folderId !== 'number' || !Number.isInteger(folderId) || folderId <= 0)) {
      sendJson(res, 422, { error: 'invalid_folder' });
      return;
    }
    try {
      await service.moveTemplate(guildId, name, folderId);
      sendJson(res, 200, { ok: true });
    } catch (error: unknown) {
      if (error instanceof TemplateAdminError) { const mapped = adminErrorResponse(error); sendJson(res, mapped.status, mapped.body); return; }
      throw error;
    }
  }

  async function handleDelete(res: ServerResponse, guildId: string, name: string): Promise<void> {
    const record = await service.getTemplate(guildId, name);
    if (record === null) { sendJson(res, 404, { error: 'not_found' }); return; }
    await service.removeTemplate(guildId, name);
    sendJson(res, 200, { ok: true });
  }

  async function handleRequestDelivery(req: IncomingMessage, res: ServerResponse, guildId: string, name: string, actorId: string): Promise<void> {
    let body: unknown;
    try { body = await readJsonBody(req, 2_000); } catch { sendJson(res, 413, { error: 'too_large' }); return; }
    if (typeof body !== 'object' || body === null) { sendJson(res, 422, { error: 'invalid_json' }); return; }
    const { channelId } = body as { channelId?: unknown };
    if (!isDiscordSnowflake(channelId)) { sendJson(res, 422, { error: 'invalid_channel_id' }); return; }
    const record = await service.getTemplate(guildId, name);
    if (record === null) { sendJson(res, 404, { error: 'not_found' }); return; }
    const result = await database.deliveries.create({ guildId, channelId, templateName: name, requestedBy: actorId });
    if (!result.ok) { sendJson(res, 409, { error: result.code }); return; }
    sendJson(res, 202, { ok: true });
  }

  async function handleListFolders(res: ServerResponse, guildId: string): Promise<void> {
    const items = await service.listFolders(guildId);
    sendJson(res, 200, { items });
  }

  async function handleCreateFolder(req: IncomingMessage, res: ServerResponse, guildId: string): Promise<void> {
    let body: unknown;
    try { body = await readJsonBody(req, 2_000); } catch { sendJson(res, 413, { error: 'too_large' }); return; }
    if (typeof body !== 'object' || body === null) { sendJson(res, 422, { error: 'invalid_json' }); return; }
    const { name } = body as { name?: unknown };
    if (typeof name !== 'string') { sendJson(res, 422, { error: 'invalid_json' }); return; }
    try {
      const folder = await service.createFolder(guildId, name);
      sendJson(res, 201, folder);
    } catch (error: unknown) {
      if (error instanceof TemplateAdminError) { const mapped = adminErrorResponse(error); sendJson(res, mapped.status, mapped.body); return; }
      throw error;
    }
  }

  async function handleRenameFolder(req: IncomingMessage, res: ServerResponse, guildId: string, id: number): Promise<void> {
    let body: unknown;
    try { body = await readJsonBody(req, 2_000); } catch { sendJson(res, 413, { error: 'too_large' }); return; }
    if (typeof body !== 'object' || body === null) { sendJson(res, 422, { error: 'invalid_json' }); return; }
    const { name } = body as { name?: unknown };
    if (typeof name !== 'string') { sendJson(res, 422, { error: 'invalid_json' }); return; }
    try {
      await service.renameFolder(guildId, id, name);
      sendJson(res, 200, { id, name });
    } catch (error: unknown) {
      if (error instanceof TemplateAdminError) { const mapped = adminErrorResponse(error); sendJson(res, mapped.status, mapped.body); return; }
      throw error;
    }
  }

  async function handleRemoveFolder(res: ServerResponse, guildId: string, id: number): Promise<void> {
    await service.removeFolder(guildId, id);
    sendJson(res, 200, { ok: true });
  }

  // Devolve true quando a rota é de templates ou pastas e já foi respondida.
  const handle = function handle(req: IncomingMessage, res: ServerResponse, path: string, search: string): boolean {
    const folderMatch = /^\/api\/guilds\/([^/]+)\/folders(?:\/([^/]+))?$/u.exec(path);
    if (folderMatch) {
      const [, guildId = '', id] = folderMatch;

      void (async () => {
        const authorized = authorize(req, res, guildId);
        if (!authorized) return;

        try {
          if (id === undefined) {
            if (req.method === 'GET' || req.method === 'HEAD') { await handleListFolders(res, guildId); return; }
            if (req.method === 'POST') {
              if (req.headers.origin !== config.siteUrl) { sendJson(res, 403, { error: 'forbidden' }); return; }
              await handleCreateFolder(req, res, guildId);
              return;
            }
            res.writeHead(405, { Allow: 'GET, HEAD, POST' }).end();
            return;
          }
          if (!folderIdPattern.test(id)) { sendJson(res, 404, { error: 'not_found' }); return; }
          const folderId = Number(id);
          if (req.method === 'PUT') {
            if (req.headers.origin !== config.siteUrl) { sendJson(res, 403, { error: 'forbidden' }); return; }
            await handleRenameFolder(req, res, guildId, folderId);
            return;
          }
          if (req.method === 'DELETE') {
            if (req.headers.origin !== config.siteUrl) { sendJson(res, 403, { error: 'forbidden' }); return; }
            await handleRemoveFolder(res, guildId, folderId);
            return;
          }
          res.writeHead(405, { Allow: 'PUT, DELETE' }).end();
        } catch {
          sendJson(res, 503, { error: 'unavailable' });
        }
      })();
      return true;
    }

    const match = /^\/api\/guilds\/([^/]+)\/templates(?:\/([^/]+)(?:\/(deliveries|folder))?)?$/u.exec(path);
    if (!match) return false;
    const [, guildId = '', name, subresource] = match;

    void (async () => {
      const authorized = authorize(req, res, guildId);
      if (!authorized) return;

      try {
        if (name === undefined) {
          if (req.method === 'GET' || req.method === 'HEAD') { await handleList(req, res, guildId, search); return; }
          if (req.method === 'POST') {
            if (req.headers.origin !== config.siteUrl) { sendJson(res, 403, { error: 'forbidden' }); return; }
            await handleCreate(req, res, guildId, authorized.discordId);
            return;
          }
          res.writeHead(405, { Allow: 'GET, HEAD, POST' }).end();
          return;
        }
        if (!namePattern.test(name)) { sendJson(res, 404, { error: 'not_found' }); return; }
        if (subresource === 'deliveries') {
          if (req.method === 'POST') {
            if (req.headers.origin !== config.siteUrl) { sendJson(res, 403, { error: 'forbidden' }); return; }
            await handleRequestDelivery(req, res, guildId, name, authorized.discordId);
            return;
          }
          res.writeHead(405, { Allow: 'POST' }).end();
          return;
        }
        if (subresource === 'folder') {
          if (req.method === 'PATCH') {
            if (req.headers.origin !== config.siteUrl) { sendJson(res, 403, { error: 'forbidden' }); return; }
            await handleMoveTemplate(req, res, guildId, name);
            return;
          }
          res.writeHead(405, { Allow: 'PATCH' }).end();
          return;
        }
        if (req.method === 'GET' || req.method === 'HEAD') { await handleGet(res, guildId, name); return; }
        if (req.method === 'PUT') {
          if (req.headers.origin !== config.siteUrl) { sendJson(res, 403, { error: 'forbidden' }); return; }
          await handleUpdate(req, res, guildId, name, authorized.discordId);
          return;
        }
        if (req.method === 'DELETE') {
          if (req.headers.origin !== config.siteUrl) { sendJson(res, 403, { error: 'forbidden' }); return; }
          await handleDelete(res, guildId, name);
          return;
        }
        res.writeHead(405, { Allow: 'GET, HEAD, PUT, DELETE' }).end();
      } catch {
        sendJson(res, 503, { error: 'unavailable' });
      }
    })();
    return true;
  };

  return { handle, close: () => database.close() };
}
