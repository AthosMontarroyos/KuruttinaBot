/**
 * API das mensagens de entrada e saída de membros (`/api/guilds/:guildId/member-events`), consumida só pelo
 * painel do site. Autenticação e autorização por servidor vêm de `auth.ts` (`getAuthorizedGuild`). O conteúdo
 * passa pelo mesmo motor de validação dos templates (`validateTemplate` com `ACTION_VARIABLES`). O canal é
 * conferido no Discord com a mesma lista do seletor de canais, não confiando no navegador. Botões e menus
 * ainda não são permitidos nessas mensagens.
 */
import { createDatabase } from '@kuruttina/database';
import { ACTION_VARIABLES, validateTemplate, type MessageTemplate } from '@kuruttina/message-templates';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { createAuth } from './auth.js';
import type { readSiteConfig } from './config.js';
import type { DiscordBot } from './discord.js';
import { isDiscordSnowflake, readJsonBody, rejectUnlessGuildAuthorized, requireSameOrigin, sendJson } from './http-utils.js';

type SiteConfig = ReturnType<typeof readSiteConfig>;
type Auth = ReturnType<typeof createAuth>;
type Database = ReturnType<typeof createDatabase>;
type Detail = { code: string; path: string; message: string };

const MEMBER_EVENTS = ['join', 'leave'] as const;
type MemberEvent = (typeof MEMBER_EVENTS)[number];

const MAX_BODY_BYTES = 40_000;
const MAX_CONTENT_BYTES = 32_768;
const memberEventPath = /^\/api\/guilds\/([^/]+)\/member-events(?:\/([^/]+))?$/u;

const INVALID_JSON_DETAIL: Detail = { code: 'invalid_json', path: '', message: 'O JSON da mensagem é inválido.' };
const COMPONENTS_NOT_ALLOWED_DETAIL: Detail = {
  code: 'components_not_allowed',
  path: 'components',
  message: 'Botões e menus não estão disponíveis nesta mensagem.',
};

/** Envelope do corpo do PUT com os tipos conferidos. As regras de negócio são validadas depois. */
type Envelope = {
  expectedVersion: number | null;
  enabled: boolean;
  channelId: string | null;
  ignoreBots: boolean;
  contentJson: string;
};

function isMemberEvent(value: string): value is MemberEvent {
  return (MEMBER_EVENTS as readonly string[]).includes(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Confere os tipos do envelope. Devolve `undefined` quando algum campo tem tipo errado. */
function parseEnvelope(body: unknown): Envelope | undefined {
  if (!isRecord(body)) return undefined;
  const { expectedVersion, enabled, channelId, ignoreBots, contentJson } = body;
  const versionOk = expectedVersion === null || (typeof expectedVersion === 'number' && Number.isInteger(expectedVersion) && expectedVersion >= 1);
  const channelOk = channelId === null || typeof channelId === 'string';
  if (!versionOk || typeof enabled !== 'boolean' || !channelOk || typeof ignoreBots !== 'boolean' || typeof contentJson !== 'string') return undefined;
  return {
    expectedVersion: expectedVersion as number | null,
    enabled,
    channelId: channelId as string | null,
    ignoreBots,
    contentJson,
  };
}

/** Forma mínima que o motor de validação exige para não quebrar: `embeds` e `components` em lista, e `content` texto quando existe. */
function hasTemplateShape(value: unknown): value is MessageTemplate {
  return isRecord(value)
    && Array.isArray(value.embeds)
    && Array.isArray(value.components)
    && (value.content === undefined || typeof value.content === 'string');
}

export function createMemberEventsApi(config: SiteConfig, auth: Auth, database: Database, discord: DiscordBot) {
  function authorize(req: IncomingMessage, res: ServerResponse, guildId: string): { discordId: string } | undefined {
    return rejectUnlessGuildAuthorized(res, guildId, () => auth.getAuthorizedGuild(req, guildId));
  }

  function sendValidation(res: ServerResponse, details: Detail[]): void {
    sendJson(res, 422, { error: 'validation', details: details.slice(0, 5) });
  }

  /** Lê e confere o envelope do PUT. Responde o erro e devolve `undefined` se o corpo não serve. */
  async function readEnvelope(req: IncomingMessage, res: ServerResponse): Promise<Envelope | undefined> {
    let body: unknown;
    try { body = await readJsonBody(req, MAX_BODY_BYTES); } catch (error: unknown) {
      if (error instanceof Error && error.message === 'body_too_large') sendJson(res, 413, { error: 'too_large' });
      else sendJson(res, 422, { error: 'invalid_json' });
      return undefined;
    }
    const envelope = parseEnvelope(body);
    if (envelope === undefined) { sendJson(res, 422, { error: 'invalid_json' }); return undefined; }
    return envelope;
  }

  /** Confere que o canal existe no servidor, na mesma lista do seletor. Falha do Discord responde 409 ou 503. */
  async function assertChannelExists(res: ServerResponse, guildId: string, channelId: string): Promise<boolean> {
    const result = await discord.listChannels(guildId);
    if (!result.ok) { sendJson(res, result.reason === 'bot_not_in_guild' ? 409 : 503, { error: result.reason }); return false; }
    if (!result.items.some((channel) => channel.id === channelId)) { sendJson(res, 422, { error: 'invalid_channel' }); return false; }
    return true;
  }

  async function handleList(res: ServerResponse, guildId: string): Promise<void> {
    const rows = await database.memberEvents.list(guildId);
    // O conteúdo vai como texto JSON, como o painel o edita.
    sendJson(res, 200, {
      items: rows.map((row) => ({
        event: row.event,
        enabled: row.enabled,
        channelId: row.channelId,
        ignoreBots: row.ignoreBots,
        contentJson: JSON.stringify(row.content),
        version: row.version,
        updatedAt: row.updatedAt.toISOString(),
      })),
    });
  }

  async function handleUpdate(req: IncomingMessage, res: ServerResponse, guildId: string, event: MemberEvent, actorId: string): Promise<void> {
    const envelope = await readEnvelope(req, res);
    if (envelope === undefined) return;
    if (Buffer.byteLength(envelope.contentJson, 'utf8') > MAX_CONTENT_BYTES) { sendJson(res, 413, { error: 'too_large' }); return; }

    let parsed: unknown;
    try { parsed = JSON.parse(envelope.contentJson); } catch { sendValidation(res, [INVALID_JSON_DETAIL]); return; }
    if (!hasTemplateShape(parsed)) { sendValidation(res, [INVALID_JSON_DETAIL]); return; }
    const errors = validateTemplate(parsed, ACTION_VARIABLES);
    if (errors.length > 0) {
      sendValidation(res, errors.map((error) => ({ code: error.code, path: error.path, message: error.message })));
      return;
    }
    if (parsed.components.length > 0) { sendValidation(res, [COMPONENTS_NOT_ALLOWED_DETAIL]); return; }

    if (envelope.enabled && envelope.channelId === null) { sendJson(res, 422, { error: 'channel_required' }); return; }
    if (envelope.channelId !== null) {
      if (!isDiscordSnowflake(envelope.channelId)) { sendJson(res, 422, { error: 'invalid_channel' }); return; }
      if (!(await assertChannelExists(res, guildId, envelope.channelId))) return;
    }

    const result = await database.memberEvents.save({
      guildId,
      event,
      expectedVersion: envelope.expectedVersion,
      enabled: envelope.enabled,
      channelId: envelope.channelId,
      ignoreBots: envelope.ignoreBots,
      content: parsed,
      actorId,
    });
    // Versão diferente da esperada: outra edição gravou antes. O painel recarrega e tenta de novo.
    if (!result.ok) { sendJson(res, 409, { error: 'conflict' }); return; }
    sendJson(res, 200, { event, version: result.version });
  }

  // Devolve true quando a rota é de mensagens de entrada e saída e já foi (ou será) respondida.
  const handle = function handle(req: IncomingMessage, res: ServerResponse, path: string): boolean {
    const match = memberEventPath.exec(path);
    if (!match) return false;
    const [, guildId = '', event] = match;
    const run = (work: (discordId: string) => Promise<void>) => {
      const authorization = authorize(req, res, guildId);
      if (authorization === undefined) return;
      void work(authorization.discordId).catch(() => { if (!res.headersSent) sendJson(res, 503, { error: 'unavailable' }); });
    };
    const requireOrigin = (): boolean => requireSameOrigin(req, res, config.siteUrl);

    if (event === undefined) {
      if (req.method === 'GET' || req.method === 'HEAD') { run(() => handleList(res, guildId)); return true; }
      res.writeHead(405, { Allow: 'GET, HEAD' }).end();
      return true;
    }

    if (!isMemberEvent(event)) { sendJson(res, 404, { error: 'not_found' }); return true; }
    if (req.method === 'PUT') {
      if (requireOrigin()) run((discordId) => handleUpdate(req, res, guildId, event, discordId));
      return true;
    }
    res.writeHead(405, { Allow: 'PUT' }).end();
    return true;
  };

  return { handle };
}
