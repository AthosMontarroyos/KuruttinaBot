import { PermissionFlagsBits, PermissionsBitField, type GuildTextBasedChannel } from 'discord.js';
import { describe, expect, it, vi } from 'vitest';
import type { StaffRole } from '@kuruttina/database';
import type { EmojiAttachment } from '../apps/bot/src/application/emojis/types.js';
import { command as devCommand } from '../apps/bot/src/commands/dev/emoji.js';
import { CommandsHandler } from '../apps/bot/src/command-system/CommandsHandler.js';
import type { CommandContext } from '../apps/bot/src/command-system/types.js';
import { handleChatInputCommand, type InteractionCommandPort } from '../apps/bot/src/events/interactions/interactionCreate.js';
import { handleMessageCreate } from '../apps/bot/src/events/messages/messageCreate.js';
import type { CommandClientPort } from '../apps/bot/src/infrastructure/discord/commands/commandContext.js';
import { parseProductionEmojiInputs } from '../apps/bot/src/infrastructure/discord/emojis/productionEmojiAdd.js';
import {
  createProductionEmojiDispatch,
  PRODUCTION_EMOJI_RUNS_URL,
  ProductionEmojiDispatchError,
} from '../apps/bot/src/infrastructure/github/dispatchProductionEmoji.js';
import { normalizeDiscordCdnImageUrl } from '../apps/bot/src/infrastructure/images/downloadDiscordImage.js';

const TOKEN = 'fake-github-workflow-token';
const DEV_GUILD = '910000000000000001';
const CREATOR = '910000000000000002';
const OUTSIDER = '910000000000000004';
const NAME = 'festa';
const ID = '123456789012345678';
const OTHER_ID = '223456789012345678';
const MENTION = `<:nome:${ID}>`;
const ANIMATED = `<a:festinha:${ID}>`;
const CDN_URL = `https://cdn.discordapp.com/emojis/${ID}.png?size=128&quality=lossless`;
const ATTACHMENT: EmojiAttachment = {
  url: 'https://cdn.discordapp.com/attachments/1/2/party_cat.png',
  name: 'party_cat.png',
  size: 1024,
  contentType: 'image/png',
};
const DISPATCH_URL =
  'https://api.github.com/repos/AthosMontarroyos/KuruttinaBot/actions/workflows/emoji-prod.yml/dispatches';

const full = new PermissionsBitField(PermissionFlagsBits.Administrator);

function client(): CommandClientPort {
  return { application: { emojis: { fetch: vi.fn(async () => ({ find: () => undefined })) } }, ws: { ping: 0 } };
}

function channel(guildId: string): GuildTextBasedChannel {
  return {
    id: '910000000000000099',
    guild: { id: guildId, members: { me: { id: 'bot' } } },
    isDMBased: () => false,
    isThread: () => false,
    permissionsFor: () => full,
    bulkDelete: vi.fn(),
    messages: { fetch: vi.fn(), delete: vi.fn() },
    send: vi.fn(),
  } as unknown as GuildTextBasedChannel;
}

function staffPort(role: StaffRole | null) {
  return {
    getStaffRole: vi.fn(async (_userId: string, guildId: string) => (guildId === DEV_GUILD ? role : null)),
  };
}

function texts(reply: ReturnType<typeof vi.fn>): string[] {
  return reply.mock.calls.map((call: unknown[]) => {
    const [content] = call;
    return typeof content === 'string' ? content : (content as { content: string }).content;
  });
}

interface FetchCall {
  readonly url: string;
  readonly init: RequestInit;
}

function githubFetch(status = 204, body = '') {
  const calls: FetchCall[] = [];
  const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), init: init ?? {} });
    // 204 não aceita corpo; um corpo vazio faz o construtor lançar.
    return new Response(status === 204 ? null : body, { status });
  });
  return { calls, fetchImpl };
}

function dispatchOf(fetchImpl: typeof fetch) {
  return createProductionEmojiDispatch({ token: TOKEN, fetchImpl });
}

async function runSlash(
  options: NonNullable<CommandContext['options']>,
  attachments: readonly EmojiAttachment[],
  fetchImpl: typeof fetch,
  role: StaffRole | null = 'creator',
): Promise<string[]> {
  const reply = vi.fn().mockResolvedValue(undefined);
  const deferReply = vi.fn(async () => undefined);
  let deferred = false;
  const port: InteractionCommandPort = {
    client: client(),
    commandName: 'dev',
    createdTimestamp: Date.now(),
    id: 'interaction-id',
    userId: role === null ? OUTSIDER : CREATOR,
    channel: channel(DEV_GUILD),
    memberPermissions: full,
    appPermissions: full,
    isDeferred: () => deferred,
    isReplied: () => false,
    deferReply: deferReply.mockImplementation(async () => { deferred = true; }),
    deleteReply: reply,
    editReply: reply,
    followUp: reply,
    reply,
    optionsData: () => options,
    routePath: ['emoji', 'add'],
    attachments,
  };
  const handler = new CommandsHandler([devCommand], staffPort(role), undefined, undefined, dispatchOf(fetchImpl));
  await handleChatInputCommand(port, handler);
  return texts(reply);
}

async function runPrefix(
  content: string,
  attachments: readonly EmojiAttachment[],
  fetchImpl: typeof fetch,
  role: StaffRole | null = 'creator',
): Promise<string[]> {
  const reply = vi.fn().mockResolvedValue(undefined);
  const message = {
    client: client(),
    content,
    id: 'message-id',
    createdTimestamp: Date.now(),
    author: { bot: false, id: role === null ? OUTSIDER : CREATOR },
    system: false,
    webhookId: null,
    attachments: new Map(attachments.map((attachment, index) => [String(index), attachment])),
    channel: channel(DEV_GUILD),
    member: { permissionsIn: () => full } as unknown as NonNullable<Parameters<typeof handleMessageCreate>[0]['member']>,
    reply,
  };
  const handler = new CommandsHandler([devCommand], staffPort(role), undefined, undefined, dispatchOf(fetchImpl));
  await handleMessageCreate(message, handler);
  return texts(reply);
}

function requested(calls: readonly FetchCall[]): { name: string; source: string } {
  expect(calls).toHaveLength(1);
  const call = calls[0];
  expect(call).toBeDefined();
  expect(call?.url).toBe(DISPATCH_URL);
  expect(call?.url).not.toContain(TOKEN);
  expect(call?.init.method).toBe('POST');
  expect(call?.init.redirect).toBe('error');
  const headers = new Headers(call?.init.headers);
  expect(headers.get('authorization')).toBe(`Bearer ${TOKEN}`);
  expect(headers.get('accept')).toBe('application/vnd.github+json');
  expect(headers.get('x-github-api-version')).toBe('2022-11-28');
  const body = JSON.parse(String(call?.init.body)) as { ref: string; inputs: { name: string; source: string } };
  expect(body.ref).toBe('main');
  expect(Object.keys(body.inputs).sort()).toEqual(['name', 'source']);
  return body.inputs;
}

function successText(name: string): string {
  return `🧑‍💻 Pedi a criação do emoji **${name}**. ⏳ Ela espera aprovação: ${PRODUCTION_EMOJI_RUNS_URL}. Se esse nome já existir, uso o próximo número livre.`;
}

describe('GitHub workflow_dispatch', () => {
  it('dispatches emoji-prod.yml on main and returns the runs page', async () => {
    const { calls, fetchImpl } = githubFetch();
    const result = await dispatchOf(fetchImpl).request({ name: NAME, source: ID });
    expect(result).toEqual({ runsUrl: PRODUCTION_EMOJI_RUNS_URL });
    expect(requested(calls)).toEqual({ name: NAME, source: ID });
  });

  it('hides the token when the request fails', async () => {
    const stderr: string[] = [];
    const spy = vi.spyOn(process.stderr, 'write').mockImplementation((chunk) => {
      stderr.push(String(chunk));
      return true;
    });
    try {
      const leaking = vi.fn(async () => {
        throw new Error(`Authorization: Bearer ${TOKEN}`);
      });
      const error = await dispatchOf(leaking as unknown as typeof fetch).request({ name: NAME, source: ID }).then(
        () => undefined,
        (caught: unknown) => caught,
      );
      expect(error).toBeInstanceOf(ProductionEmojiDispatchError);
      expect(error).toMatchObject({ status: undefined });
      expect(JSON.stringify(error)).not.toContain(TOKEN);
      expect(String(error)).not.toContain(TOKEN);
      expect((error as Error).stack ?? '').not.toContain(TOKEN);
      expect(stderr.join('')).not.toContain(TOKEN);

      const { calls, fetchImpl } = githubFetch(401, TOKEN);
      await expect(dispatchOf(fetchImpl).request({ name: NAME, source: CDN_URL })).rejects.toMatchObject({ status: 401 });
      expect(calls[0]?.init.body).not.toContain(TOKEN);
    } finally {
      spy.mockRestore();
    }
  });
});

describe('dev emoji add dispatches the production workflow', () => {
  it.each([
    ['mention', [{ name: 'nome', value: NAME }, { name: 'origem', value: MENTION }], ID],
    ['animated mention', [{ name: 'nome', value: NAME }, { name: 'origem', value: ANIMATED }], ID],
    ['bare id', [{ name: 'nome', value: NAME }, { name: 'origem', value: ID }], ID],
    ['compact ref', [{ name: 'nome', value: NAME }, { name: 'origem', value: `festinha:${ID}` }], ID],
    ['cdn url', [{ name: 'nome', value: NAME }, { name: 'origem', value: CDN_URL }], normalizeDiscordCdnImageUrl(CDN_URL)],
  ])('slash maps %s onto the workflow inputs', async (_label, options, source) => {
    const { calls, fetchImpl } = githubFetch();
    const replies = await runSlash(options, [], fetchImpl);
    expect(requested(calls)).toEqual({ name: NAME, source });
    expect(replies).toEqual([successText(NAME)]);
  });

  it('slash maps an attachment URL and ignores a missing custom emoji', async () => {
    const { calls, fetchImpl } = githubFetch();
    const replies = await runSlash([{ name: 'nome', value: NAME }], [ATTACHMENT], fetchImpl);
    expect(requested(calls)).toEqual({ name: NAME, source: normalizeDiscordCdnImageUrl(ATTACHMENT.url) });
    expect(replies).toEqual([successText(NAME)]);
  });

  it.each([
    ['mention', [{ name: 'origem', value: MENTION }], 'nome', ID],
    ['animated mention', [{ name: 'origem', value: ANIMATED }], 'festinha', ID],
    ['compact ref', [{ name: 'origem', value: `festinha:${ID}` }], 'festinha', ID],
    [
      'hyphenated url',
      [{ name: 'origem', value: 'https://cdn.discordapp.com/attachments/1/2/party-cat.png' }],
      'party_cat',
      normalizeDiscordCdnImageUrl('https://cdn.discordapp.com/attachments/1/2/party-cat.png'),
    ],
  ])('slash derives the name from %s', async (_label, options, name, source) => {
    const { calls, fetchImpl } = githubFetch();
    const replies = await runSlash(options, [], fetchImpl);
    expect(requested(calls)).toEqual({ name, source });
    expect(replies).toEqual([successText(name)]);
  });

  it('slash derives the attachment file name when nome is omitted', async () => {
    const { calls, fetchImpl } = githubFetch();
    const file = { ...ATTACHMENT, name: 'coração.png', url: 'https://cdn.discordapp.com/attachments/1/2/cora%C3%A7%C3%A3o.png' };
    const replies = await runSlash([], [file], fetchImpl);
    expect(requested(calls)).toEqual({ name: 'coracao', source: normalizeDiscordCdnImageUrl(file.url) });
    expect(replies).toEqual([successText('coracao')]);
  });

  it('slash asks for a name when the origin is only an id', async () => {
    const { calls, fetchImpl } = githubFetch();
    const replies = await runSlash([{ name: 'origem', value: ID }], [], fetchImpl);
    expect(calls).toEqual([]);
    expect(replies).toEqual(['❓ Essa origem não traz um nome. Informe um nome de 2 a 32 caracteres.']);
  });

  it.each([
    [`k!dev-emoji-add ${NAME} ${MENTION}`, ID],
    [`K!dev-emoji-add ${NAME} ${ID}`, ID],
    [`k!dev-emoji-add ${CDN_URL} ${NAME}`, normalizeDiscordCdnImageUrl(CDN_URL)],
    [`k!dev-emoji-add ${OTHER_ID} ${ID}`, ID],
  ])('prefix %s dispatches source %s', async (content, source) => {
    const { calls, fetchImpl } = githubFetch();
    const replies = await runPrefix(content, [], fetchImpl);
    const expectedName = content.includes(OTHER_ID) ? OTHER_ID : NAME;
    expect(requested(calls)).toEqual({ name: expectedName, source });
    expect(replies).toEqual([successText(expectedName)]);
  });

  it('prefix uses the attachment when the name is the only argument', async () => {
    const { calls, fetchImpl } = githubFetch();
    const replies = await runPrefix(`k!dev-emoji-add ${NAME}`, [ATTACHMENT], fetchImpl);
    expect(requested(calls)).toEqual({ name: NAME, source: normalizeDiscordCdnImageUrl(ATTACHMENT.url) });
    expect(replies).toEqual([successText(NAME)]);
  });

  it.each([
    [`k!dev-emoji-add ${MENTION}`, 'nome', ID],
    [`k!dev-emoji-add ${ANIMATED}`, 'festinha', ID],
    [`k!dev-emoji-add festinha:${ID}`, 'festinha', ID],
    [
      'k!dev-emoji-add https://cdn.discordapp.com/attachments/1/2/my%20emoji.png',
      'my_emoji',
      normalizeDiscordCdnImageUrl('https://cdn.discordapp.com/attachments/1/2/my%20emoji.png'),
    ],
  ])('prefix %s derives %s', async (content, name, source) => {
    const { calls, fetchImpl } = githubFetch();
    const replies = await runPrefix(content, [], fetchImpl);
    expect(requested(calls)).toEqual({ name, source });
    expect(replies).toEqual([successText(name)]);
  });

  it('prefix derives the attachment file name when no name is given', async () => {
    const { calls, fetchImpl } = githubFetch();
    const file = { ...ATTACHMENT, name: 'party-cat.png' };
    const replies = await runPrefix('k!dev-emoji-add', [file], fetchImpl);
    expect(requested(calls)).toEqual({ name: 'party_cat', source: normalizeDiscordCdnImageUrl(file.url) });
    expect(replies).toEqual([successText('party_cat')]);
  });

  it('keeps the manual reply and does not call GitHub when the token is absent', async () => {
    const { calls, fetchImpl } = githubFetch();
    const reply = vi.fn().mockResolvedValue(undefined);
    const message = {
      client: client(),
      content: `k!dev-emoji-add ${NAME} ${ID}`,
      id: 'message-id',
      createdTimestamp: Date.now(),
      author: { bot: false, id: CREATOR },
      system: false,
      webhookId: null,
      attachments: new Map<string, EmojiAttachment>(),
      channel: channel(DEV_GUILD),
      member: { permissionsIn: () => full } as unknown as NonNullable<Parameters<typeof handleMessageCreate>[0]['member']>,
      reply,
    };
    await handleMessageCreate(message, new CommandsHandler([devCommand], staffPort('dev')));
    expect(calls).toEqual([]);
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(texts(reply)).toEqual([
      '📖 Eu não adiciono Application Emojis ao bot de produção por aqui. Use o workflow **Adicionar emoji de produção** no GitHub com a origem: um ID de emoji, uma marcação ou a URL HTTPS da imagem. O nome é opcional. Se ele já existir, uso o próximo número livre. A criação espera aprovação.',
    ]);
  });

  it('does not dispatch for an outsider in the dev guild', async () => {
    const { calls, fetchImpl } = githubFetch();
    const replies = await runPrefix(`k!dev-emoji-add ${NAME} ${ID}`, [], fetchImpl, null);
    expect(calls).toEqual([]);
    expect(replies).toEqual(['🔒 Você não tem acesso a este comando neste servidor.']);
  });

  it('rejects invalid input before calling GitHub', async () => {
    const cases: Array<{ content: string; attachments?: readonly EmojiAttachment[]; text: string }> = [
      { content: 'k!dev-emoji-add', text: '❓ Informe uma origem: um ID, uma marcação, uma URL HTTPS do CDN ou um anexo. O nome é opcional.' },
      { content: `k!dev-emoji-add ${NAME}`, text: '❓ Envie um anexo ou informe um ID, uma marcação ou uma URL HTTPS do CDN.' },
      { content: `k!dev-emoji-add ${ID}`, text: '❓ Essa origem não traz um nome. Informe um nome de 2 a 32 caracteres.' },
      { content: `k!dev-emoji-add a ${ID}`, text: '🏷️ O nome precisa ter de 2 a 32 caracteres, entre A–Z, a–z, 0–9 ou _.' },
      { content: `k!dev-emoji-add ação ${ID}`, text: '🏷️ O nome precisa ter de 2 a 32 caracteres, entre A–Z, a–z, 0–9 ou _.' },
      { content: `k!dev-emoji-add https://cdn.discordapp.com/attachments/1/2/a.png`, text: '🏷️ Não consegui formar um nome válido com essa origem. Informe um nome de 2 a 32 caracteres, entre A–Z, a–z, 0–9 ou _.' },
      { content: `k!dev-emoji-add ${NAME} http://cdn.discordapp.com/emojis/${ID}.png`, text: '⚠️ A origem precisa ser um ID, uma marcação <:nome:id> ou uma URL HTTPS do CDN.' },
      { content: `k!dev-emoji-add ${NAME} https://example.com/emojis/${ID}.png`, text: '🛡️ A URL de origem não pertence ao CDN do Discord.' },
      { content: `k!dev-emoji-add ${NAME} https://user:pass@cdn.discordapp.com/emojis/${ID}.png`, text: '🛡️ A URL de origem não pertence ao CDN do Discord.' },
      { content: `k!dev-emoji-add ${NAME} ${MENTION}`, attachments: [ATTACHMENT], text: '⚠️ Informe uma só origem.' },
      {
        content: 'k!dev-emoji-add',
        attachments: [{ ...ATTACHMENT, name: 'a.png', url: 'https://cdn.discordapp.com/attachments/1/2/a.png' }],
        text: '🏷️ Não consegui formar um nome válido com essa origem. Informe um nome de 2 a 32 caracteres, entre A–Z, a–z, 0–9 ou _.',
      },
      {
        content: `k!dev-emoji-add ${NAME}`,
        attachments: [{ ...ATTACHMENT, contentType: 'text/plain' }],
        text: '🖼️ Envie uma imagem anexada.',
      },
    ];
    for (const spec of cases) {
      const { calls, fetchImpl } = githubFetch();
      const replies = await runPrefix(spec.content, spec.attachments ?? [], fetchImpl);
      expect(calls, spec.content).toEqual([]);
      expect(replies, spec.content).toEqual([spec.text]);
    }
  });

  it('replies without the token when GitHub refuses the dispatch', async () => {
    const stderr: string[] = [];
    const spy = vi.spyOn(process.stderr, 'write').mockImplementation((chunk) => {
      stderr.push(String(chunk));
      return true;
    });
    try {
      const { calls, fetchImpl } = githubFetch(500, TOKEN);
      const replies = await runSlash([{ name: 'nome', value: NAME }, { name: 'origem', value: ID }], [], fetchImpl);
      expect(calls).toHaveLength(1);
      expect(replies).toEqual(['😅 Não consegui pedir a criação agora. Tente de novo daqui a pouco.']);
      expect(replies.join('')).not.toContain(TOKEN);
      expect(stderr.join('')).not.toContain(TOKEN);
      expect(stderr.join('')).toContain('status=500');
    } finally {
      spy.mockRestore();
    }
  });
});

describe('parseProductionEmojiInputs', () => {
  it('reads a slash URL and a prefix attachment without calling the network', () => {
    expect(parseProductionEmojiInputs({
      options: [{ name: 'nome', value: `  ${NAME}  ` }, { name: 'origem', value: `  ${CDN_URL}  ` }],
      attachments: [],
    } as unknown as CommandContext)).toEqual({ name: NAME, source: normalizeDiscordCdnImageUrl(CDN_URL) });
    expect(parseProductionEmojiInputs({
      rawArgs: NAME,
      attachments: [ATTACHMENT],
    } as unknown as CommandContext)).toEqual({ name: NAME, source: normalizeDiscordCdnImageUrl(ATTACHMENT.url) });
  });
});
