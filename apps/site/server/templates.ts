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
import type { DiscordBot } from './discord.js';
import { isDiscordSnowflake, readJsonBody, rejectUnlessGuildAuthorized, requireSameOrigin, sendJson } from './http-utils.js';

type SiteConfig = ReturnType<typeof readSiteConfig>;
type Auth = ReturnType<typeof createAuth>;
type Database = ReturnType<typeof createDatabase>;

const namePattern = /^[a-z0-9_-]{1,32}$/u;
const folderIdPattern = /^[1-9][0-9]*$/u;
const LIST_PAGE_SIZE = 25;
const UNKNOWN_COMPONENT_MESSAGE = 'O botão aponta para um Component que não existe neste servidor.';
const UNKNOWN_EMOJI_MESSAGE = 'O botão usa um emoji que não existe neste servidor.';
const UNKNOWN_MENU_COMPONENT_MESSAGE = 'O menu aponta para um Component que não existe neste servidor.';
const UNKNOWN_COMPONENT_OPTION_MESSAGE = 'A opção aponta para uma ação do menu que não existe mais.';
const UNKNOWN_MENU_EMOJI_MESSAGE = 'A opção do menu usa um emoji que não existe neste servidor.';
/** Mesmo formato de `componentOption` aceito pelo motor de templates (`template.js`). */
const COMPONENT_OPTION_KEY_PATTERN = /^[a-z0-9]{6,12}$/u;

/** Botão do template que aponta para um Component de botão, com o path real dele no template. */
type ButtonComponentRef = { path: string; id: number };
/** Menu do template que aponta para um Component de menu (`menu.component`), com o path real dele no template. */
type MenuComponentRef = { path: string; id: number };
/** Opção de menu que aponta para uma opção (`componentOption`) do Component de menu `componentId`. */
type MenuOptionKeyRef = { path: string; componentId: number; key: string };
/** Emoji personalizado (`emoji.id`) de botão ou de opção de menu, com o path e a mensagem reais dele. */
type EmojiRef = { path: string; id: string; message: string };

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;
}

/** Ids de `component` dos botões coloridos do JSON do template. JSON inválido, ou valor que não é inteiro
 * positivo seguro, fica de fora: o motor de validação já recusa esses casos com `invalid_action`. */
function collectButtonComponentRefs(contentJson: string): ButtonComponentRef[] {
  let parsed: unknown;
  try { parsed = JSON.parse(contentJson); } catch { return []; }
  const rows = asRecord(parsed)?.components;
  if (!Array.isArray(rows)) return [];
  const refs: ButtonComponentRef[] = [];
  rows.forEach((row: unknown, r: number) => {
    const record = asRecord(row);
    if (record?.kind !== 'buttons' || !Array.isArray(record.buttons)) return;
    const buttons: unknown[] = record.buttons;
    buttons.forEach((button: unknown, b: number) => {
      const id = asRecord(button)?.component;
      if (typeof id === 'number' && Number.isSafeInteger(id) && id >= 1) {
        refs.push({ path: `components[${r}].buttons[${b}].component`, id });
      }
    });
  });
  return refs;
}

/** Id de Component (botão ou menu) do JSON: inteiro seguro maior ou igual a 1; o resto fica de fora. */
function asComponentId(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 1 ? value : undefined;
}

/** Menus do JSON do template: `menu.component` e as `componentOption` das opções, cada uma com o id do menu.
 * Valor fora do formato fica de fora: o motor de validação já recusa esses casos com `invalid_action`. */
function collectMenuRefs(contentJson: string): { components: MenuComponentRef[]; optionKeys: MenuOptionKeyRef[] } {
  const result: { components: MenuComponentRef[]; optionKeys: MenuOptionKeyRef[] } = { components: [], optionKeys: [] };
  let parsed: unknown;
  try { parsed = JSON.parse(contentJson); } catch { return result; }
  const rows = asRecord(parsed)?.components;
  if (!Array.isArray(rows)) return result;
  rows.forEach((row: unknown, r: number) => {
    const record = asRecord(row);
    const menu = asRecord(record?.menu);
    if (record?.kind !== 'select' || menu === undefined) return;
    const componentId = asComponentId(menu.component);
    if (componentId !== undefined) result.components.push({ path: `components[${r}].menu.component`, id: componentId });
    if (componentId === undefined || !Array.isArray(menu.options)) return;
    const options: unknown[] = menu.options;
    options.forEach((option: unknown, o: number) => {
      const key = asRecord(option)?.componentOption;
      if (typeof key === 'string' && COMPONENT_OPTION_KEY_PATTERN.test(key)) {
        result.optionKeys.push({ path: `components[${r}].menu.options[${o}].componentOption`, componentId, key });
      }
    });
  });
  return result;
}

/** Erros para as referências de Component: botão (`component`) que o servidor não tem; menu (`menu.component`) que o
 * servidor não tem; e `componentOption` que não existe mais no Component do menu. Só consulta o banco quando há
 * referência: uma leitura da lista por tipo e uma leitura por Component de menu distinto. Opção de menu cujo
 * Component já é inexistente não é conferida de novo (o erro do menu já cobre). */
async function findUnknownComponents(database: Database, guildId: string, contentJson: string) {
  const buttonRefs = collectButtonComponentRefs(contentJson);
  const menuRefs = collectMenuRefs(contentJson);
  const errors: Array<{ code: string; path: string; message: string }> = [];
  if (buttonRefs.length > 0) {
    const known = new Set((await database.customActions.list('buttons', guildId)).map((action) => action.id));
    errors.push(...buttonRefs
      .filter((ref) => !known.has(ref.id))
      .map((ref) => ({ code: 'unknown_component', path: ref.path, message: UNKNOWN_COMPONENT_MESSAGE })));
  }
  if (menuRefs.components.length > 0) {
    const knownMenus = new Set((await database.customActions.list('selects', guildId)).map((action) => action.id));
    errors.push(...menuRefs.components
      .filter((ref) => !knownMenus.has(ref.id))
      .map((ref) => ({ code: 'unknown_component', path: ref.path, message: UNKNOWN_MENU_COMPONENT_MESSAGE })));
    const liveOptionRefs = menuRefs.optionKeys.filter((ref) => knownMenus.has(ref.componentId));
    const keysByComponent = new Map<number, Set<string>>();
    for (const componentId of [...new Set(liveOptionRefs.map((ref) => ref.componentId))]) {
      const config = await database.customActionsConfig.getSelect(guildId, componentId);
      keysByComponent.set(componentId, new Set((config?.options ?? []).map((option) => option.key)));
    }
    errors.push(...liveOptionRefs
      .filter((ref) => !keysByComponent.get(ref.componentId)?.has(ref.key))
      .map((ref) => ({ code: 'unknown_component_option', path: ref.path, message: UNKNOWN_COMPONENT_OPTION_MESSAGE })));
  }
  return errors;
}

/** Ids dos emojis personalizados (`emoji.id`) dos botões e das opções de menu do JSON do template. Valor que não é snowflake fica de fora. */
function collectEmojiRefs(contentJson: string): EmojiRef[] {
  let parsed: unknown;
  try { parsed = JSON.parse(contentJson); } catch { return []; }
  const rows = asRecord(parsed)?.components;
  if (!Array.isArray(rows)) return [];
  const refs: EmojiRef[] = [];
  rows.forEach((row: unknown, r: number) => {
    const record = asRecord(row);
    if (record?.kind === 'buttons' && Array.isArray(record.buttons)) {
      const buttons: unknown[] = record.buttons;
      buttons.forEach((button: unknown, b: number) => {
        const id = asRecord(asRecord(button)?.emoji)?.id;
        if (isDiscordSnowflake(id)) refs.push({ path: `components[${r}].buttons[${b}].emoji`, id, message: UNKNOWN_EMOJI_MESSAGE });
      });
      return;
    }
    const menu = asRecord(record?.menu);
    if (record?.kind !== 'select' || menu === undefined || !Array.isArray(menu.options)) return;
    const options: unknown[] = menu.options;
    options.forEach((option: unknown, o: number) => {
      const id = asRecord(asRecord(option)?.emoji)?.id;
      if (isDiscordSnowflake(id)) refs.push({ path: `components[${r}].menu.options[${o}].emoji`, id, message: UNKNOWN_MENU_EMOJI_MESSAGE });
    });
  });
  return refs;
}

/** Erros `unknown_guild_emoji` para os botões e as opções de menu com emoji personalizado que o servidor não tem. Só consulta o Discord
 * quando há algum `emoji.id`. Falha do Discord responde 409 (bot fora do servidor) ou 503 e devolve `undefined`. */
async function findUnknownEmojis(res: ServerResponse, discord: DiscordBot, guildId: string, contentJson: string) {
  const refs = collectEmojiRefs(contentJson);
  if (refs.length === 0) return [];
  const result = await discord.listEmojis(guildId);
  if (!result.ok) { sendJson(res, result.reason === 'bot_not_in_guild' ? 409 : 503, { error: result.reason }); return undefined; }
  const known = new Set(result.items.map((emoji) => emoji.id));
  return refs
    .filter((ref) => !known.has(ref.id))
    .map((ref) => ({ code: 'unknown_guild_emoji' as const, path: ref.path, message: ref.message }));
}

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

export function createTemplatesApi(config: SiteConfig, auth: Auth, database: ReturnType<typeof createDatabase>, discord: DiscordBot) {
  const service = createTemplateAdminService(createTemplateRepository(database.templates, database.folders));

  function authorize(req: IncomingMessage, res: ServerResponse, guildId: string): { discordId: string } | undefined {
    return rejectUnlessGuildAuthorized(res, guildId, () => auth.getAuthorizedGuild(req, guildId));
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
    const unknownComponents = await findUnknownComponents(database, guildId, contentJson);
    if (unknownComponents.length > 0) { sendJson(res, 422, { error: 'validation', details: unknownComponents.slice(0, 5) }); return; }
    const unknownEmojis = await findUnknownEmojis(res, discord, guildId, contentJson);
    if (unknownEmojis === undefined) return;
    if (unknownEmojis.length > 0) { sendJson(res, 422, { error: 'validation', details: unknownEmojis.slice(0, 5) }); return; }
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
    const unknownComponents = await findUnknownComponents(database, guildId, contentJson);
    if (unknownComponents.length > 0) { sendJson(res, 422, { error: 'validation', details: unknownComponents.slice(0, 5) }); return; }
    const unknownEmojis = await findUnknownEmojis(res, discord, guildId, contentJson);
    if (unknownEmojis === undefined) return;
    if (unknownEmojis.length > 0) { sendJson(res, 422, { error: 'validation', details: unknownEmojis.slice(0, 5) }); return; }
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
              if (!requireSameOrigin(req, res, config.siteUrl)) return;
              await handleCreateFolder(req, res, guildId);
              return;
            }
            res.writeHead(405, { Allow: 'GET, HEAD, POST' }).end();
            return;
          }
          if (!folderIdPattern.test(id)) { sendJson(res, 404, { error: 'not_found' }); return; }
          const folderId = Number(id);
          if (req.method === 'PUT') {
            if (!requireSameOrigin(req, res, config.siteUrl)) return;
            await handleRenameFolder(req, res, guildId, folderId);
            return;
          }
          if (req.method === 'DELETE') {
            if (!requireSameOrigin(req, res, config.siteUrl)) return;
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
            if (!requireSameOrigin(req, res, config.siteUrl)) return;
            await handleCreate(req, res, guildId, authorized.discordId);
            return;
          }
          res.writeHead(405, { Allow: 'GET, HEAD, POST' }).end();
          return;
        }
        if (!namePattern.test(name)) { sendJson(res, 404, { error: 'not_found' }); return; }
        if (subresource === 'deliveries') {
          if (req.method === 'POST') {
            if (!requireSameOrigin(req, res, config.siteUrl)) return;
            await handleRequestDelivery(req, res, guildId, name, authorized.discordId);
            return;
          }
          res.writeHead(405, { Allow: 'POST' }).end();
          return;
        }
        if (subresource === 'folder') {
          if (req.method === 'PATCH') {
            if (!requireSameOrigin(req, res, config.siteUrl)) return;
            await handleMoveTemplate(req, res, guildId, name);
            return;
          }
          res.writeHead(405, { Allow: 'PATCH' }).end();
          return;
        }
        if (req.method === 'GET' || req.method === 'HEAD') { await handleGet(res, guildId, name); return; }
        if (req.method === 'PUT') {
          if (!requireSameOrigin(req, res, config.siteUrl)) return;
          await handleUpdate(req, res, guildId, name, authorized.discordId);
          return;
        }
        if (req.method === 'DELETE') {
          if (!requireSameOrigin(req, res, config.siteUrl)) return;
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
