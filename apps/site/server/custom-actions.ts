/**
 * API de ações personalizadas (`/api/guilds/:guildId/custom-buttons` e `/custom-selects`), consumida só pelo
 * painel do site. Autenticação e autorização por servidor vêm de `auth.ts` (`getAuthorizedGuild`). Uma ação é só
 * um nome do app; a configuração de cada ação (funções do botão; opções e funções do menu) fica em `/:id`, com
 * controle de versão (`expectedVersion`) para não sobrescrever uma edição feita em paralelo. Antes de salvar, as
 * referências das funções (templates, canais, canais de voz e cargos) são conferidas no servidor (`assertReferences`).
 */
import { createDatabase } from '@kuruttina/database';
import { unlinkComponent } from '@kuruttina/message-templates';
import { functionReferences, MAX_OPTIONS, MAX_OPTION_LABEL, validateFunctions } from '@kuruttina/message-templates/custom-functions';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { createAuth } from './auth.js';
import type { readSiteConfig } from './config.js';
import type { DiscordBot, DiscordListResult } from './discord.js';
import { readJsonBody, rejectUnlessGuildAuthorized, requireSameOrigin, sendJson } from './http-utils.js';

type SiteConfig = ReturnType<typeof readSiteConfig>;
type Auth = ReturnType<typeof createAuth>;
type Database = ReturnType<typeof createDatabase>;
type CustomActionKind = 'buttons' | 'selects';
type ValidatedFunctions = Extract<ReturnType<typeof validateFunctions>, { ok: true }>['value'];
type OptionInput = { key: string; label: string; functions: ValidatedFunctions };
type ParseResult<T> = { ok: true; value: T } | { ok: false; error: 'invalid_options' | 'invalid_functions' };

const MAX_BODY_BYTES = 1_000;
const MAX_CONFIG_BODY_BYTES = 256_000;
const MAX_NAME_LENGTH = 50;
const actionPath = /^\/api\/guilds\/([^/]+)\/(custom-buttons|custom-selects)(?:\/([^/]+))?$/u;
const idPattern = /^[1-9][0-9]*$/u;
// Chave estável de uma opção de menu: igual à CHECK do banco (custom_select_options.option_key).
const optionKeyPattern = /^[a-z0-9]{6,12}$/u;

/** Valida o nome enviado (sem espaços nas pontas, 1 a 50 caracteres). Devolve `undefined` quando inválido. */
function parseName(body: unknown): string | undefined {
  if (typeof body !== 'object' || body === null) return undefined;
  const { name } = body as { name?: unknown };
  if (typeof name !== 'string') return undefined;
  const trimmed = name.trim();
  // Conta caracteres (code points), como o `length()` do PostgreSQL, não unidades UTF-16.
  const length = [...trimmed].length;
  return length >= 1 && length <= MAX_NAME_LENGTH ? trimmed : undefined;
}

/** Valida o rótulo de uma opção do menu (sem espaços nas pontas, 1 a MAX_OPTION_LABEL caracteres). */
function parseOptionLabel(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  // Mesma contagem de `parseName`: code points, não unidades UTF-16.
  const length = [...trimmed].length;
  return length >= 1 && length <= MAX_OPTION_LABEL ? trimmed : undefined;
}

/** Lê `expectedVersion` (inteiro >= 1). Devolve `undefined` quando inválido. */
function parseExpectedVersion(body: unknown): number | undefined {
  if (typeof body !== 'object' || body === null) return undefined;
  const { expectedVersion } = body as { expectedVersion?: unknown };
  return typeof expectedVersion === 'number' && Number.isSafeInteger(expectedVersion) && expectedVersion >= 1 ? expectedVersion : undefined;
}

/** Valida as opções do menu: array de até MAX_OPTIONS itens, cada um só com `key`, `label` e `functions`; chaves e rótulos únicos. */
function parseOptions(value: unknown): ParseResult<OptionInput[]> {
  if (!Array.isArray(value) || value.length > MAX_OPTIONS) return { ok: false, error: 'invalid_options' };
  const keys = new Set<string>();
  const labels = new Set<string>();
  const options: OptionInput[] = [];
  for (const item of value) {
    if (typeof item !== 'object' || item === null || Array.isArray(item)) return { ok: false, error: 'invalid_options' };
    const { key, label, functions, ...extra } = item as { key?: unknown; label?: unknown; functions?: unknown };
    if (Object.keys(extra).length > 0) return { ok: false, error: 'invalid_options' };
    // A chave é gerada pelo painel; sem ela, ou com formato diferente, a opção não é aceita.
    if (typeof key !== 'string' || !optionKeyPattern.test(key) || keys.has(key)) return { ok: false, error: 'invalid_options' };
    keys.add(key);
    const parsedLabel = parseOptionLabel(label);
    // Comparação exata depois do trim: "Sim" e "Sim " são o mesmo rótulo.
    if (parsedLabel === undefined || labels.has(parsedLabel)) return { ok: false, error: 'invalid_options' };
    labels.add(parsedLabel);
    const parsedFunctions = validateFunctions(functions);
    if (!parsedFunctions.ok) return { ok: false, error: 'invalid_functions' };
    options.push({ key, label: parsedLabel, functions: parsedFunctions.value });
  }
  return { ok: true, value: options };
}

/** Lê o corpo de uma configuração (até MAX_CONFIG_BODY_BYTES). Responde 413/422 sozinho e devolve `undefined` quando não há o que seguir. */
async function readConfigBody(req: IncomingMessage, res: ServerResponse): Promise<{ body: unknown } | undefined> {
  try { return { body: await readJsonBody(req, MAX_CONFIG_BODY_BYTES) }; } catch (error) {
    if (error instanceof Error && error.message === 'body_too_large') { sendJson(res, 413, { error: 'too_large' }); return undefined; }
    if (error instanceof SyntaxError) { sendJson(res, 422, { error: 'invalid_json' }); return undefined; }
    throw error;
  }
}

export function createCustomActionsApi(config: SiteConfig, auth: Auth, database: Database, discord: DiscordBot) {
  function authorize(req: IncomingMessage, res: ServerResponse, guildId: string): { discordId: string } | undefined {
    return rejectUnlessGuildAuthorized(res, guildId, () => auth.getAuthorizedGuild(req, guildId));
  }

  /** Lista do Discord, só quando há algo a conferir. Falha responde 409 (bot fora do servidor) ou 503 e devolve `undefined`. */
  async function discordItems<T>(res: ServerResponse, read: () => Promise<DiscordListResult<T>>): Promise<T[] | undefined> {
    const result = await read();
    if (result.ok) return result.items;
    sendJson(res, result.reason === 'bot_not_in_guild' ? 409 : 503, { error: result.reason });
    return undefined;
  }

  /**
   * Confere as referências de todas as funções (de um botão ou de todas as opções de um menu): templates no banco;
   * canais, canais de voz e cargos no Discord, e só quando há algo referenciado. Cargo precisa existir e não ser `managed`.
   * Responde o erro e devolve `false` se não passar.
   */
  async function assertReferences(res: ServerResponse, guildId: string, functions: ValidatedFunctions): Promise<boolean> {
    const refs = { templates: new Set<string>(), channels: new Set<string>(), voiceChannels: new Set<string>(), roles: new Set<string>() };
    for (const fn of functions) {
      const found = functionReferences(fn);
      for (const id of found.templates) refs.templates.add(id);
      for (const id of found.channels) refs.channels.add(id);
      for (const id of found.voiceChannels) refs.voiceChannels.add(id);
      for (const id of found.roles) refs.roles.add(id);
    }

    const templateRows = await Promise.all([...refs.templates].map((name) => database.templates.get(guildId, name)));
    if (templateRows.some((row) => row === null)) { sendJson(res, 422, { error: 'invalid_reference' }); return false; }

    if (refs.channels.size > 0) {
      const items = await discordItems(res, () => discord.listChannels(guildId));
      if (items === undefined) return false;
      const known = new Set(items.map((channel) => channel.id));
      if ([...refs.channels].some((id) => !known.has(id))) { sendJson(res, 422, { error: 'invalid_reference' }); return false; }
    }

    if (refs.voiceChannels.size > 0) {
      const items = await discordItems(res, () => discord.listVoiceChannels(guildId));
      if (items === undefined) return false;
      const known = new Set(items.map((channel) => channel.id));
      if ([...refs.voiceChannels].some((id) => !known.has(id))) { sendJson(res, 422, { error: 'invalid_reference' }); return false; }
    }

    if (refs.roles.size > 0) {
      const items = await discordItems(res, () => discord.listRoles(guildId));
      if (items === undefined) return false;
      const assignable = new Set(items.filter((role) => !role.managed).map((role) => role.id));
      if ([...refs.roles].some((id) => !assignable.has(id))) { sendJson(res, 422, { error: 'invalid_reference' }); return false; }
    }

    return true;
  }

  async function handleList(res: ServerResponse, guildId: string, kind: CustomActionKind): Promise<void> {
    const items = await database.customActions.list(kind, guildId);
    sendJson(res, 200, {
      items: items.map((item) => ({
        id: item.id,
        name: item.name,
        version: item.version,
        createdAt: item.createdAt.toISOString(),
        updatedAt: item.updatedAt.toISOString(),
      })),
    });
  }

  async function handleCreate(req: IncomingMessage, res: ServerResponse, guildId: string, kind: CustomActionKind, actorId: string): Promise<void> {
    let body: unknown;
    try { body = await readJsonBody(req, MAX_BODY_BYTES); } catch (error) {
      if (error instanceof Error && error.message === 'body_too_large') { sendJson(res, 413, { error: 'too_large' }); return; }
      if (error instanceof SyntaxError) { sendJson(res, 422, { error: 'invalid_json' }); return; }
      throw error;
    }
    const name = parseName(body);
    if (name === undefined) { sendJson(res, 422, { error: 'invalid_name' }); return; }
    const result = await database.customActions.create({ kind, guildId, name, actorId });
    // Só quota e duplicate chegam aqui como código de negócio; o resto vira 503 pelo catch de `run`.
    if (!result.ok) { sendJson(res, 409, { error: result.code }); return; }
    sendJson(res, 201, { id: result.id, version: result.version });
  }

  // Apaga e desvincula os templates do servidor que referenciam a ação (mesma transação no banco).
  async function handleDelete(res: ServerResponse, guildId: string, kind: CustomActionKind, id: number, actorId: string): Promise<void> {
    const result = await database.customActions.remove(kind, guildId, id, unlinkComponent, actorId);
    if (!result.removed) { sendJson(res, 404, { error: 'not_found' }); return; }
    sendJson(res, 200, { ok: true, unlinked: result.unlinked });
  }

  async function handleGetConfig(res: ServerResponse, guildId: string, kind: CustomActionKind, id: number): Promise<void> {
    if (kind === 'buttons') {
      const item = await database.customActionsConfig.getButton(guildId, id);
      if (item === null) { sendJson(res, 404, { error: 'not_found' }); return; }
      sendJson(res, 200, { id: item.id, name: item.name, version: item.version, functions: item.functions });
      return;
    }
    const item = await database.customActionsConfig.getSelect(guildId, id);
    if (item === null) { sendJson(res, 404, { error: 'not_found' }); return; }
    sendJson(res, 200, { id: item.id, name: item.name, version: item.version, keepSelection: item.keepSelection, options: item.options });
  }

  async function handleSaveConfig(req: IncomingMessage, res: ServerResponse, guildId: string, kind: CustomActionKind, id: number, actorId: string): Promise<void> {
    const read = await readConfigBody(req, res);
    if (read === undefined) return;
    const expectedVersion = parseExpectedVersion(read.body);
    if (expectedVersion === undefined) { sendJson(res, 422, { error: 'invalid_json' }); return; }
    const fields = read.body as { functions?: unknown; keepSelection?: unknown; options?: unknown };

    if (kind === 'buttons') {
      const functions = validateFunctions(fields.functions);
      if (!functions.ok) { sendJson(res, 422, { error: 'invalid_functions' }); return; }
      if (!(await assertReferences(res, guildId, functions.value))) return;
      const result = await database.customActionsConfig.saveButton({ guildId, id, expectedVersion, functions: functions.value, actorId });
      if (!result.ok) { sendJson(res, result.code === 'not_found' ? 404 : 409, { error: result.code }); return; }
      sendJson(res, 200, { id, version: result.version });
      return;
    }

    if (typeof fields.keepSelection !== 'boolean') { sendJson(res, 422, { error: 'invalid_options' }); return; }
    const options = parseOptions(fields.options);
    if (!options.ok) { sendJson(res, 422, { error: options.error }); return; }
    if (!(await assertReferences(res, guildId, options.value.flatMap((option) => option.functions)))) return;
    const result = await database.customActionsConfig.saveSelect({ guildId, id, expectedVersion, keepSelection: fields.keepSelection, options: options.value, actorId });
    if (!result.ok) { sendJson(res, result.code === 'not_found' ? 404 : 409, { error: result.code }); return; }
    sendJson(res, 200, { id, version: result.version });
  }

  // Devolve true quando a rota é de ações personalizadas e já foi (ou será) respondida.
  const handle = function handle(req: IncomingMessage, res: ServerResponse, path: string): boolean {
    const match = actionPath.exec(path);
    if (!match) return false;
    const [, guildId = '', segment = '', id] = match;
    const kind: CustomActionKind = segment === 'custom-buttons' ? 'buttons' : 'selects';
    const run = (work: (discordId: string) => Promise<void>) => {
      const authorization = authorize(req, res, guildId);
      if (authorization === undefined) return;
      void work(authorization.discordId).catch(() => { if (!res.headersSent) sendJson(res, 503, { error: 'unavailable' }); });
    };
    const requireOrigin = (): boolean => requireSameOrigin(req, res, config.siteUrl);

    if (id === undefined) {
      if (req.method === 'GET' || req.method === 'HEAD') { run(() => handleList(res, guildId, kind)); return true; }
      if (req.method === 'POST') {
        if (requireOrigin()) run((discordId) => handleCreate(req, res, guildId, kind, discordId));
        return true;
      }
      res.writeHead(405, { Allow: 'GET, HEAD, POST' }).end();
      return true;
    }

    // Id fora de bigint seguro não existe: responde 404 em vez de estourar a conversão.
    if (!idPattern.test(id) || !Number.isSafeInteger(Number(id))) { sendJson(res, 404, { error: 'not_found' }); return true; }
    const numericId = Number(id);
    if (req.method === 'GET' || req.method === 'HEAD') { run(() => handleGetConfig(res, guildId, kind, numericId)); return true; }
    if (req.method === 'PUT') {
      if (requireOrigin()) run((discordId) => handleSaveConfig(req, res, guildId, kind, numericId, discordId));
      return true;
    }
    if (req.method === 'DELETE') {
      if (requireOrigin()) run((discordId) => handleDelete(res, guildId, kind, numericId, discordId));
      return true;
    }
    res.writeHead(405, { Allow: 'GET, HEAD, PUT, DELETE' }).end();
    return true;
  };

  return { handle };
}
