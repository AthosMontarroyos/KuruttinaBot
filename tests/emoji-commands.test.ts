import { MessageFlags, PermissionFlagsBits, PermissionsBitField, SlashCommandBuilder, type APIEmbed, type GuildTextBasedChannel } from 'discord.js';
import { describe, expect, it, vi } from 'vitest';
import { readDatabaseConfig, type StaffRole } from '@kuruttina/database';
import type { EmojiImportService, EmojiImportRequest } from '../apps/bot/src/application/emojis/importEmoji.js';
import {
  emojiError,
  type EmojiAttachment,
  type EmojiImportErrorCode,
  type PreparedEmojiImage,
} from '../apps/bot/src/application/emojis/types.js';
import { createEmojiAddExecutor } from '../apps/bot/src/infrastructure/discord/emojis/emojiAdd.js';
import { command as devCommand } from '../apps/bot/src/commands/dev/emoji.js';
import { command as emojiCommand } from '../apps/bot/src/commands/mod/emoji.js';
import { loadCommands } from '../apps/bot/src/command-system/loadCommands.js';
import type { ChatInputCommand, CommandContext, EmojiInfoLookup } from '../apps/bot/src/command-system/types.js';
import { createCentralDeployment } from '../apps/bot/src/deployments/central.js';
import { createGuildDeployment } from '../apps/bot/src/deployments/guild.js';
import { handleChatInputCommand, type InteractionCommandPort } from '../apps/bot/src/events/interactions/interactionCreate.js';
import { handleMessageCreate } from '../apps/bot/src/events/messages/messageCreate.js';
import { CommandsHandler } from '../apps/bot/src/command-system/CommandsHandler.js';
import { DeploymentsHandler } from '../apps/bot/src/handlers/DeploymentsHandler.js';
import type { CommandClientPort } from '../apps/bot/src/infrastructure/discord/commands/commandContext.js';
import { createRenderer } from '../apps/bot/src/infrastructure/discord/commands/commandContext.js';

const discord = vi.hoisted(() => ({ deployGuildCommands: vi.fn(), deployGlobalCommands: vi.fn() }));
vi.mock('../apps/bot/src/infrastructure/discord/commands/deployCommands.js', () => discord);

/** Identidades e guildas sintéticas: os cadastros reais não pertencem aos testes. */
const DEV_GUILD = '910000000000000001';
const CREATOR = '910000000000000002';
const DEV = '910000000000000003';
const OUTSIDER = '910000000000000004';
const OTHER_GUILD = '910000000000000005';

const full = new PermissionsBitField(PermissionFlagsBits.Administrator);
const ATTACHMENT: EmojiAttachment = {
  url: 'https://cdn.discordapp.com/attachments/1/2/party_cat.png',
  name: 'party_cat.png',
  size: 1024,
  contentType: 'image/png',
};
const EMOJI_REF = '<a:festinha:41771983429993937>';

const IMAGE: PreparedEmojiImage = {
  bytes: Uint8Array.from([1]),
  contentType: 'image/png',
  animated: false,
  width: 1,
  height: 1,
  sourceBytes: 1,
  transformations: [],
};

function client(): CommandClientPort {
  return { application: { emojis: { fetch: vi.fn(async () => ({ find: () => undefined })) } }, ws: { ping: 0 } };
}

function permissionsOf(value: PermissionsBitField | null | undefined): PermissionsBitField | undefined {
  if (value === null) return undefined;
  return value ?? full;
}

function channel(
  guildId: string,
  appPermissions: PermissionsBitField | null | undefined = full,
  isThread = false,
): GuildTextBasedChannel {
  const resolved = permissionsOf(appPermissions);
  return {
    id: '910000000000000099',
    guild: { id: guildId, members: { me: { id: 'bot' } } },
    isDMBased: () => false,
    isThread: () => isThread,
    permissionsFor: () => resolved,
    bulkDelete: vi.fn(),
    messages: { fetch: vi.fn(), delete: vi.fn() },
    send: vi.fn(),
  } as unknown as GuildTextBasedChannel;
}

interface TransportSpec {
  readonly userId?: string;
  /** `null` simula uma conversa direta com o bot. */
  readonly guildId?: string | null;
  /** `null` omite o contexto de permissão, para a política falhar fechada. */
  readonly memberPermissions?: PermissionsBitField | null;
  readonly appPermissions?: PermissionsBitField | null;
  readonly isThread?: boolean;
  readonly options?: NonNullable<CommandContext['options']>;
  readonly attachments?: readonly EmojiAttachment[];
  readonly rawArgs?: string;
}

interface Ports {
  readonly port: InteractionCommandPort;
  readonly deferReply: ReturnType<typeof vi.fn>;
  readonly reply: ReturnType<typeof vi.fn>;
}

function slash(commandName: string, routePath: readonly string[], spec: TransportSpec = {}): Ports {
  const reply = vi.fn().mockResolvedValue(undefined);
  const deferReply = vi.fn().mockImplementation(async () => undefined);
  let deferred = false;
  const port: InteractionCommandPort = {
    client: client(),
    commandName,
    createdTimestamp: Date.now(),
    id: 'interaction-id',
    userId: spec.userId ?? CREATOR,
    channel: spec.guildId ? channel(spec.guildId, spec.appPermissions, spec.isThread) : null,
    memberPermissions: permissionsOf(spec.memberPermissions),
    appPermissions: permissionsOf(spec.appPermissions),
    isDeferred: () => deferred,
    isReplied: () => false,
    deferReply: deferReply.mockImplementation(async () => { deferred = true; }),
    deleteReply: reply,
    editReply: reply,
    followUp: reply,
    reply,
    optionsData: () => spec.options ?? [],
    routePath,
    attachments: spec.attachments ?? [],
  };
  return { port, deferReply, reply };
}

function prefix(content: string, spec: TransportSpec = {}) {
  const reply = vi.fn().mockResolvedValue(undefined);
  const message = {
    client: client(),
    content,
    id: 'message-id',
    createdTimestamp: Date.now(),
    author: { bot: false, id: spec.userId ?? CREATOR },
    system: false,
    webhookId: null,
    attachments: new Map((spec.attachments ?? []).map((attachment, index) => [String(index), attachment])),
    ...(spec.guildId ? { channel: channel(spec.guildId, spec.appPermissions, spec.isThread) } : {}),
    member: { permissionsIn: () => permissionsOf(spec.memberPermissions) } as unknown as NonNullable<
      Parameters<typeof handleMessageCreate>[0]['member']
    >,
    reply,
  };
  return { message, reply };
}

function importService() {
  const importEmoji = vi.fn<EmojiImportService['importEmoji']>(async (request: EmojiImportRequest) => ({
    created: { id: '41771983429993937', name: request.name ?? 'derived' },
    image: IMAGE,
  }));
  return { importEmoji, service: { importEmoji } satisfies EmojiImportService };
}

function staffPort(role: StaffRole | null, options: { fail?: boolean } = {}) {
  const getStaffRole = vi.fn(async (_userId: string, guildId: string) => {
    if (options.fail) throw new Error('private SQL and connection details');
    // Emula a API real: a consulta só encontra cadastro na guilda registrada.
    return guildId === DEV_GUILD ? role : null;
  });
  return { getStaffRole };
}

function texts(reply: ReturnType<typeof vi.fn>): string[] {
  return reply.mock.calls.map((call: unknown[]) => {
    const [content] = call;
    return typeof content === 'string' ? content : (content as { content: string }).content;
  });
}

async function runSlash(ports: Ports, handler: CommandsHandler): Promise<string[]> {
  await handleChatInputCommand(ports.port, handler);
  return texts(ports.reply);
}

async function runPrefix(message: ReturnType<typeof prefix>['message'], handler: CommandsHandler): Promise<string[]> {
  await handleMessageCreate(message, handler);
  return texts(message.reply as unknown as ReturnType<typeof vi.fn>);
}

const transports = ['slash', 'k!', 'K!'] as const;

describe('emoji add command routing', () => {
  it('sends /emoji add to the guild where it was executed', async () => {
    const { importEmoji, service } = importService();
    const ports = slash('emoji', ['add'], { guildId: OTHER_GUILD, attachments: [ATTACHMENT] });

    await runSlash(ports, new CommandsHandler([emojiCommand], undefined, service));

    expect(importEmoji).toHaveBeenCalledExactlyOnceWith({
      source: {
        kind: 'attachment',
        url: ATTACHMENT.url,
        filename: 'party_cat.png',
        size: 1024,
        contentType: 'image/png',
      },
      destination: { kind: 'guild', guildId: OTHER_GUILD },
      name: undefined,
    });
    expect(texts(ports.reply)).toEqual(['➕ Pronto. O emoji **derived** agora está neste servidor. ✅']);
    expect(ports.port.client.application.emojis.fetch).toHaveBeenCalledOnce();
  });

  it.each(['k!emoji-add', 'K!emoji-add', 'k!emoji-add ', 'K!emoji-add meu_nome'])(
    'routes prefix %s to the shared guild executor',
    async (content) => {
      const { importEmoji, service } = importService();
      const { message } = prefix(content, { guildId: DEV_GUILD, attachments: [ATTACHMENT] });

      await runPrefix(message, new CommandsHandler([emojiCommand], undefined, service));

      expect(importEmoji).toHaveBeenCalledOnce();
      expect(importEmoji.mock.calls[0]?.[0].destination).toEqual({ kind: 'guild', guildId: DEV_GUILD });
      const created = importEmoji.mock.calls[0]?.[0].name ?? 'derived';
      expect(texts(message.reply as unknown as ReturnType<typeof vi.fn>)).toEqual([
        `➕ Pronto. O emoji **${created}** agora está neste servidor. ✅`,
      ]);
      expect(message.client.application.emojis.fetch).toHaveBeenCalledOnce();
    },
  );

  it('points /dev emoji add at the production workflow and does not import', async () => {
    const { importEmoji, service } = importService();
    const staff = staffPort('creator');
    const ports = slash('dev', ['emoji', 'add'], { guildId: DEV_GUILD, attachments: [ATTACHMENT] });

    await runSlash(ports, new CommandsHandler([devCommand], staff, service));

    expect(importEmoji).not.toHaveBeenCalled();
    expect(texts(ports.reply)).toEqual([
      '📖 Eu não adiciono Application Emojis ao bot de produção por aqui. Use o workflow **Adicionar emoji de produção** no GitHub com a origem: um ID de emoji, uma marcação ou a URL HTTPS da imagem. O nome é opcional. Se ele já existir, uso o próximo número livre. A criação espera aprovação.',
    ]);
    expect(ports.port.client.application.emojis.fetch).toHaveBeenCalledOnce();
  });

  it.each(['k!dev-emoji-add', 'K!dev-emoji-add'])('routes prefix %s to the production workflow notice', async (content) => {
    const { importEmoji, service } = importService();
    const { message } = prefix(content, { guildId: DEV_GUILD, attachments: [ATTACHMENT] });

    await runPrefix(message, new CommandsHandler([devCommand], staffPort('dev'), service));

    expect(importEmoji).not.toHaveBeenCalled();
    expect(texts(message.reply as unknown as ReturnType<typeof vi.fn>)).toEqual([
      '📖 Eu não adiciono Application Emojis ao bot de produção por aqui. Use o workflow **Adicionar emoji de produção** no GitHub com a origem: um ID de emoji, uma marcação ou a URL HTTPS da imagem. O nome é opcional. Se ele já existir, uso o próximo número livre. A criação espera aprovação.',
    ]);
  });

  it.each(['k!emoji', 'K!emoji', 'k!dev'])('answers %s with its usage instead of importing', async (content) => {
    const { importEmoji, service } = importService();
    const { message } = prefix(content, { guildId: DEV_GUILD, attachments: [ATTACHMENT] });

    const replies = await runPrefix(message, new CommandsHandler([emojiCommand, devCommand], staffPort('creator'), service));

    expect(importEmoji).not.toHaveBeenCalled();
    const usage = content === 'k!dev'
      ? '📖 Este comando exige um subcomando. Use `k!dev-emoji-add`.'
      : '📖 Este comando exige um subcomando. Use `k!emoji-add` ou `k!emoji-info`.';
    expect(replies).toEqual([usage]);
  });

  it('rejects a prefix alias that collides with another command', () => {
    const clone = { ...emojiCommand, data: new SlashCommandBuilder().setName('outro').setDescription('Outro') };
    expect(() => new CommandsHandler([emojiCommand, clone])).toThrow('Duplicate command alias: emoji-add');
  });

  it('ignores an unknown subcommand path from slash', async () => {
    const { importEmoji, service } = importService();
    const ports = slash('emoji', ['inexistente'], { guildId: DEV_GUILD, attachments: [ATTACHMENT] });

    const replies = await runSlash(ports, new CommandsHandler([emojiCommand], undefined, service));

    expect(importEmoji).not.toHaveBeenCalled();
    expect(replies).toEqual(['📖 Este comando exige um subcomando. Use `k!emoji-add` ou `k!emoji-info`.']);
  });

  it('keeps the import service optional so a missing composition fails closed', async () => {
    const ports = slash('emoji', ['add'], { guildId: DEV_GUILD, attachments: [ATTACHMENT] });

    const replies = await runSlash(ports, new CommandsHandler([emojiCommand]));

    expect(replies).toEqual(['😅 Não consigo importar emojis agora. Tente de novo daqui a pouco.']);
  });
});

describe('dev emoji authorization in both transports', () => {
  const cases = [
    { user: CREATOR, role: 'creator' as const, location: DEV_GUILD, expected: true },
    { user: DEV, role: 'dev' as const, location: DEV_GUILD, expected: true },
    { user: OUTSIDER, role: null, location: DEV_GUILD, expected: false },
    { user: CREATOR, role: 'creator' as const, location: OTHER_GUILD, expected: false },
    { user: CREATOR, role: 'creator' as const, location: null, expected: false },
  ];

  for (const transport of transports) {
    it.each(cases)(`${transport}: $user / $role / $location -> $expected`, async ({ user, role, location, expected }) => {
      const { importEmoji, service } = importService();
      const staff = staffPort(role);
      const handler = new CommandsHandler([devCommand], staff, service);
      const spec: TransportSpec = { userId: user, guildId: location, attachments: [ATTACHMENT] };

      const replies = transport === 'slash'
        ? await runSlash(slash('dev', ['emoji', 'add'], spec), handler)
        : await runPrefix(prefix(transport + 'dev-emoji-add', spec).message, handler);

      expect(importEmoji).not.toHaveBeenCalled();
      if (expected) expect(replies).toEqual([
        '📖 Eu não adiciono Application Emojis ao bot de produção por aqui. Use o workflow **Adicionar emoji de produção** no GitHub com a origem: um ID de emoji, uma marcação ou a URL HTTPS da imagem. O nome é opcional. Se ele já existir, uso o próximo número livre. A criação espera aprovação.',
      ]);
      else expect(replies.join('\n')).not.toContain('Adicionar emoji de produção');
      if (location) expect(staff.getStaffRole).toHaveBeenCalledWith(user, location);
      else expect(staff.getStaffRole).not.toHaveBeenCalled();
    });

    it(`${transport}: an administrator without a staff record is denied`, async () => {
      const { importEmoji, service } = importService();
      const handler = new CommandsHandler([devCommand], staffPort(null), service);
      const spec: TransportSpec = {
        userId: OUTSIDER,
        guildId: DEV_GUILD,
        attachments: [ATTACHMENT],
        memberPermissions: full,
      };

      const replies = transport === 'slash'
        ? await runSlash(slash('dev', ['emoji', 'add'], spec), handler)
        : await runPrefix(prefix(transport + 'dev-emoji-add', spec).message, handler);

      expect(importEmoji).not.toHaveBeenCalled();
      expect(replies).toEqual(['🔒 Você não tem acesso a este comando neste servidor.']);
    });

    it(`${transport}: a staff lookup failure denies without leaking the error`, async () => {
      const { importEmoji, service } = importService();
      const staff = staffPort('creator', { fail: true });
      const handler = new CommandsHandler([devCommand], staff, service);
      const spec: TransportSpec = { userId: CREATOR, guildId: DEV_GUILD, attachments: [ATTACHMENT] };

      const replies = transport === 'slash'
        ? await runSlash(slash('dev', ['emoji', 'add'], spec), handler)
        : await runPrefix(prefix(transport + 'dev-emoji-add', spec).message, handler);

      expect(importEmoji).not.toHaveBeenCalled();
      expect(replies).toEqual(['😅 Não consegui verificar o acesso agora. Tente de novo mais tarde.']);
      expect(JSON.stringify(replies)).not.toContain('private SQL');
    });

    it(`${transport}: recognizes the interaction before querying the staff table`, async () => {
      const { service } = importService();
      const staff = staffPort('creator');
      const handler = new CommandsHandler([devCommand], staff, service);
      const spec: TransportSpec = { userId: CREATOR, guildId: DEV_GUILD, attachments: [ATTACHMENT] };

      if (transport === 'slash') {
        const ports = slash('dev', ['emoji', 'add'], spec);
        await runSlash(ports, handler);
        expect(ports.deferReply).toHaveBeenCalledOnce();
        expect(ports.deferReply.mock.invocationCallOrder[0]).toBeLessThan(staff.getStaffRole.mock.invocationCallOrder[0]!);
      } else {
        const { message } = prefix(transport + 'dev-emoji-add', spec);
        await runPrefix(message, handler);
        expect(staff.getStaffRole).toHaveBeenCalledOnce();
      }
    });

    it(`${transport}: Creator still needs the channel permissions declared by the policy`, async () => {
      const { importEmoji, service } = importService();
      const handler = new CommandsHandler([devCommand], staffPort('creator'), service);
      const spec: TransportSpec = {
        userId: CREATOR,
        guildId: DEV_GUILD,
        attachments: [ATTACHMENT],
        appPermissions: new PermissionsBitField(),
      };

      const replies = transport === 'slash'
        ? await runSlash(slash('dev', ['emoji', 'add'], spec), handler)
        : await runPrefix(prefix(transport + 'dev-emoji-add', spec).message, handler);

      expect(importEmoji).not.toHaveBeenCalled();
      expect(replies[0]).toMatch(/^😠 Preciso destas permissões/);
    });
  }
});

describe('guild emoji authorization', () => {
  it.each(transports)('%s: runs in any guild without consulting the staff table', async (transport) => {
    const { importEmoji, service } = importService();
    const staff = { getStaffRole: vi.fn(async () => 'creator' as StaffRole) };
    const handler = new CommandsHandler([emojiCommand], staff, service);
    const spec: TransportSpec = { userId: OUTSIDER, guildId: OTHER_GUILD, attachments: [ATTACHMENT] };

    if (transport === 'slash') await runSlash(slash('emoji', ['add'], spec), handler);
    else await runPrefix(prefix(transport + 'emoji-add', spec).message, handler);

    expect(importEmoji).toHaveBeenCalledOnce();
    expect(staff.getStaffRole).not.toHaveBeenCalled();
  });

  it.each(transports)('%s: denies a member without the emoji management permission', async (transport) => {
    const { importEmoji, service } = importService();
    const handler = new CommandsHandler([emojiCommand], undefined, service);
    const spec: TransportSpec = {
      userId: OUTSIDER,
      guildId: OTHER_GUILD,
      attachments: [ATTACHMENT],
      memberPermissions: new PermissionsBitField(),
    };

    const replies = transport === 'slash'
      ? await runSlash(slash('emoji', ['add'], spec), handler)
      : await runPrefix(prefix(transport + 'emoji-add', spec).message, handler);

    expect(importEmoji).not.toHaveBeenCalled();
    expect(replies).toEqual(['😞 Você precisa da permissão **Gerenciar emojis** para adicionar emojis.']);
  });

  it.each(transports)('%s: denies when the bot cannot create emojis', async (transport) => {
    const { importEmoji, service } = importService();
    const handler = new CommandsHandler([emojiCommand], undefined, service);
    const spec: TransportSpec = {
      userId: OUTSIDER,
      guildId: OTHER_GUILD,
      attachments: [ATTACHMENT],
      // ViewChannel e SendMessages sim, CreateGuildExpressions não.
      appPermissions: new PermissionsBitField(
        PermissionFlagsBits.ViewChannel | PermissionFlagsBits.SendMessages,
      ),
    };

    const replies = transport === 'slash'
      ? await runSlash(slash('emoji', ['add'], spec), handler)
      : await runPrefix(prefix(transport + 'emoji-add', spec).message, handler);

    expect(importEmoji).not.toHaveBeenCalled();
    expect(replies).toEqual(['😠 Preciso destas permissões para adicionar o emoji: **Criar emojis**.']);
  });

  it('denies outside of a text channel', async () => {
    const { importEmoji, service } = importService();
    const ports = slash('emoji', ['add'], { guildId: null, attachments: [ATTACHMENT] });

    const replies = await runSlash(ports, new CommandsHandler([emojiCommand], undefined, service));

    expect(importEmoji).not.toHaveBeenCalled();
    expect(replies).toEqual(['🏘️ Use um canal de texto de servidor para adicionar emojis.']);
  });
});

describe('emoji add inputs', () => {
  it.each(transports)('%s: derives the source name from the attachment file name', async (transport) => {
    const { importEmoji, service } = importService();
    const handler = new CommandsHandler([emojiCommand], undefined, service);
    const spec: TransportSpec = { guildId: OTHER_GUILD, attachments: [ATTACHMENT] };

    if (transport === 'slash') await runSlash(slash('emoji', ['add'], spec), handler);
    else await runPrefix(prefix(transport + 'emoji-add', spec).message, handler);

    expect(importEmoji.mock.calls[0]?.[0].source).toEqual({
      kind: 'attachment',
      url: ATTACHMENT.url,
      filename: 'party_cat.png',
      size: 1024,
      contentType: 'image/png',
    });
    expect(importEmoji.mock.calls[0]?.[0].name).toBeUndefined();
  });

  it.each([
    {
      label: 'slash nome',
      run: (service: EmojiImportService) =>
        runSlash(
          slash('emoji', ['add'], {
            guildId: OTHER_GUILD,
            attachments: [ATTACHMENT],
            options: [{ name: 'nome', value: 'meu_emoji' }],
          }),
          new CommandsHandler([emojiCommand], undefined, service),
        ),
      expected: 'meu_emoji',
    },
    {
      label: 'prefixo nome',
      run: (service: EmojiImportService) =>
        runPrefix(
          prefix('k!emoji-add meu_emoji', { guildId: OTHER_GUILD, attachments: [ATTACHMENT] }).message,
          new CommandsHandler([emojiCommand], undefined, service),
        ),
      expected: 'meu_emoji',
    },
  ])('uses the explicit name from %s', async ({ run, expected }) => {
    const { importEmoji, service } = importService();
    await run(service);
    expect(importEmoji.mock.calls[0]?.[0].name).toBe(expected);
  });

  it.each([
    {
      label: 'slash',
      run: (service: EmojiImportService) =>
        runSlash(
          slash('emoji', ['add'], { guildId: OTHER_GUILD, options: [{ name: 'emoji', value: EMOJI_REF }] }),
          new CommandsHandler([emojiCommand], undefined, service),
        ),
    },
    {
      label: 'prefixo',
      run: (service: EmojiImportService) =>
        runPrefix(
          prefix('k!emoji-add ' + EMOJI_REF, { guildId: OTHER_GUILD }).message,
          new CommandsHandler([emojiCommand], undefined, service),
        ),
    },
    {
      label: 'prefixo com nome',
      run: (service: EmojiImportService) =>
        runPrefix(
          prefix('k!emoji-add copiado ' + EMOJI_REF, { guildId: OTHER_GUILD }).message,
          new CommandsHandler([emojiCommand], undefined, service),
        ),
    },
  ])('imports a pasted custom emoji from %s', async ({ run }) => {
    const { importEmoji, service } = importService();
    await run(service);
    expect(importEmoji.mock.calls[0]?.[0].source).toEqual({ kind: 'guild-emoji', ref: EMOJI_REF });
  });

  it('gives the attachment priority when both an attachment and an emoji are provided', async () => {
    const { importEmoji, service } = importService();
    const ports = slash('emoji', ['add'], {
      guildId: OTHER_GUILD,
      attachments: [ATTACHMENT],
      options: [{ name: 'emoji', value: EMOJI_REF }],
    });

    await runSlash(ports, new CommandsHandler([emojiCommand], undefined, service));

    expect(importEmoji.mock.calls[0]?.[0].source.kind).toBe('attachment');
    expect(importEmoji.mock.calls[0]?.[0].name).toBeUndefined();
  });

  it('gives the attachment priority over a pasted emoji in prefix too', async () => {
    const { importEmoji, service } = importService();
    const { message } = prefix('k!emoji-add ' + EMOJI_REF, { guildId: OTHER_GUILD, attachments: [ATTACHMENT] });

    await runPrefix(message, new CommandsHandler([emojiCommand], undefined, service));

    expect(importEmoji.mock.calls[0]?.[0].source.kind).toBe('attachment');
  });

  it.each([
    {
      label: 'nenhuma origem',
      spec: { guildId: OTHER_GUILD } as TransportSpec,
      content: 'k!emoji-add',
      expected: '🖼️ Envie uma imagem anexada ou informe um emoji personalizado de outro servidor.',
    },
    {
      label: 'só um nome',
      spec: { guildId: OTHER_GUILD } as TransportSpec,
      content: 'k!emoji-add so_nome',
      expected: '🖼️ Envie uma imagem anexada ou informe um emoji personalizado de outro servidor.',
    },
    {
      label: 'argumentos excedentes',
      spec: { guildId: OTHER_GUILD } as TransportSpec,
      content: 'k!emoji-add a b c',
      expected: '⚠️ Envie uma imagem anexada ou um emoji personalizado. O nome é opcional e só pode haver um.',
    },
    {
      label: 'dois anexos',
      spec: { guildId: OTHER_GUILD, attachments: [ATTACHMENT, { ...ATTACHMENT, url: ATTACHMENT.url + 'x' }] } as TransportSpec,
      content: 'k!emoji-add',
      expected: '⚠️ Envie apenas uma imagem por comando.',
    },
  ])('rejects %s before importing', async ({ spec, content, expected }) => {
    const { importEmoji, service } = importService();
    const { message } = prefix(content, spec);

    const replies = await runPrefix(message, new CommandsHandler([emojiCommand], undefined, service));

    expect(importEmoji).not.toHaveBeenCalled();
    expect(replies).toEqual([expected]);
  });

  it('rejects a slash invocation without any source', async () => {
    const { importEmoji, service } = importService();
    const ports = slash('emoji', ['add'], { guildId: OTHER_GUILD, options: [{ name: 'nome', value: 'meu_emoji' }] });

    const replies = await runSlash(ports, new CommandsHandler([emojiCommand], undefined, service));

    expect(importEmoji).not.toHaveBeenCalled();
    expect(replies).toEqual(['🖼️ Envie uma imagem anexada ou informe um emoji personalizado de outro servidor.']);
    expect(ports.deferReply).toHaveBeenCalledOnce();
    expect(ports.deferReply.mock.invocationCallOrder[0]).toBeLessThan(importEmoji.mock.invocationCallOrder[0] ?? Infinity);
  });

  it('surfaces a domain failure instead of the generic error reply', async () => {
    const { importEmoji, service } = importService();
    importEmoji.mockRejectedValueOnce(emojiError('queue_full', 'A fila de importação está cheia. Tente de novo em instantes.'));
    const ports = slash('emoji', ['add'], { guildId: OTHER_GUILD, attachments: [ATTACHMENT] });

    const replies = await runSlash(ports, new CommandsHandler([emojiCommand], undefined, service));

    expect(replies).toEqual(['☕ A fila de importação está cheia. Tente de novo em instantes.']);
  });

  it('logs the failure code without echoing user input', async () => {
    const { importEmoji, service } = importService();
    importEmoji.mockRejectedValueOnce(emojiError('create_failed', 'O Discord recusou a criação do emoji.'));
    const { message } = prefix('k!emoji-add nome_invalido!', { guildId: OTHER_GUILD, attachments: [ATTACHMENT] });

    await runPrefix(message, new CommandsHandler([emojiCommand], undefined, service));

    expect(importEmoji).toHaveBeenCalledOnce();
    expect(message.reply).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ content: '❌ O Discord recusou a criação do emoji.' }),
    );
  });

  it.each(['k!emoji-add', 'K!emoji-add'])('reports a domain failure once on %s', async (content) => {
    const { importEmoji, service } = importService();
    importEmoji.mockRejectedValueOnce(emojiError('download_blocked', 'A URL de origem não pertence ao CDN do Discord.'));
    const { message } = prefix(content, { guildId: OTHER_GUILD, attachments: [ATTACHMENT] });

    const replies = await runPrefix(message, new CommandsHandler([emojiCommand], undefined, service));

    expect(replies).toEqual(['🛡️ A URL de origem não pertence ao CDN do Discord.']);
    expect(message.client.application.emojis.fetch).toHaveBeenCalledOnce();
  });

  it('uses the application emoji when it is available', async () => {
    const { service } = importService();
    const ports = slash('emoji', ['add'], { guildId: OTHER_GUILD, attachments: [ATTACHMENT] });
    vi.mocked(ports.port.client.application.emojis.fetch).mockResolvedValue({
      find: (predicate: (emoji: { name: string | null }) => boolean) =>
        [
          { name: 'add', toString: () => '<:add:1>' },
          { name: 'sucess', toString: () => '<:sucess:2>' },
        ].find(predicate),
    });

    const replies = await runSlash(ports, new CommandsHandler([emojiCommand], undefined, service));

    expect(replies).toEqual(['<:add:1> Pronto. O emoji **derived** agora está neste servidor. <:sucess:2>']);
    expect(ports.port.client.application.emojis.fetch).toHaveBeenCalledOnce();
  });

  it('keeps the message when the emoji lookup fails', async () => {
    const { importEmoji, service } = importService();
    const ports = slash('emoji', ['add'], { guildId: OTHER_GUILD });
    vi.mocked(ports.port.client.application.emojis.fetch).mockRejectedValue(new Error('Unavailable'));

    const replies = await runSlash(ports, new CommandsHandler([emojiCommand], undefined, service));

    expect(importEmoji).not.toHaveBeenCalled();
    expect(replies).toEqual(['🖼️ Envie uma imagem anexada ou informe um emoji personalizado de outro servidor.']);
    expect(ports.port.client.application.emojis.fetch).toHaveBeenCalledOnce();
  });

  const importErrorMarks = {
    missing_source: '🖼️',
    empty_input: '🖼️',
    unsupported_format: '🖼️',
    invalid_name: '🏷️',
    invalid_source: '⚠️',
    invalid_input: '⚠️',
    input_too_large: '⚠️',
    too_many_pixels: '⚠️',
    too_many_frames: '⚠️',
    duration_exceeded: '⚠️',
    capacity_reached: '⚠️',
    download_blocked: '🛡️',
    source_missing: '🔎',
    queue_full: '☕',
    destination_unavailable: '😅',
    download_failed: '❌',
    corrupt_image: '❌',
    processing_timeout: '❌',
    size_unreachable: '❌',
    animation_lost: '❌',
    create_failed: '❌',
  } as const satisfies Record<EmojiImportErrorCode, string>;

  it.each(Object.entries(importErrorMarks))(
    'maps %s to its catalog emoji without repeating the message',
    async (code, mark) => {
      const { importEmoji, service } = importService();
      const message = `único ${code}`;
      importEmoji.mockRejectedValueOnce(emojiError(code as EmojiImportErrorCode, message));
      const ports = slash('emoji', ['add'], { guildId: OTHER_GUILD, attachments: [ATTACHMENT] });

      const replies = await runSlash(ports, new CommandsHandler([emojiCommand], undefined, service));

      expect(replies).toEqual([`${mark} ${message}`]);
      expect(ports.port.client.application.emojis.fetch).toHaveBeenCalledOnce();
    },
  );

  it('uses the guild emoji when the guild executor has no server', async () => {
    const { importEmoji, service } = importService();
    const names: string[] = [];
    const reply = vi.fn(async () => undefined);
    await createEmojiAddExecutor('guild')({
      apiPing: 0,
      gatewayPing: 0,
      render: createRenderer(async () => ''),
      acknowledge: async () => undefined,
      emoji: async (name) => {
        names.push(name);
        return name === 'guild' ? '<:guild:1>' : '';
      },
      reply,
      attachments: [ATTACHMENT],
      options: [],
      emojiImport: service,
    });

    expect(importEmoji).not.toHaveBeenCalled();
    expect(names).toEqual(['guild']);
    expect(reply).toHaveBeenCalledExactlyOnceWith('<:guild:1> Este comando só pode ser usado em um servidor.');
  });
});

describe('emoji command deployment scopes', () => {
  function config() {
    return {
      target: 'development' as const,
      activeCredential: { token: 'fake-token', expectedBotId: CREATOR },
      database: readDatabaseConfig(
        { DATABASE_URL: 'postgres://kuruttina_bot:test@localhost/postgres' },
        'development',
      ),
    };
  }

  it('publishes /emoji add globally and /dev emoji add only in the configured guild', async () => {
    vi.clearAllMocks();
    const handler = new CommandsHandler(await loadCommands());
    const context = { config: config(), applicationId: CREATOR, correlationId: 'test' };

    await createCentralDeployment(handler).run(context);
    await createGuildDeployment(handler, async () => ({ environment: 'development', devGuildIds: [DEV_GUILD] })).run(context);

    const globalNames = discord.deployGlobalCommands.mock.calls[0]?.[2].map(({ name }: { name: string }) => name);
    const guildNames = discord.deployGuildCommands.mock.calls[0]?.[3].map(({ name }: { name: string }) => name);
    expect(globalNames).toEqual(['ban', 'clear', 'emoji', 'kick', 'timeout', 'unban', 'untimeout', 'help', 'ping']);
    expect(guildNames).toEqual(['dev']);
    expect(discord.deployGuildCommands).toHaveBeenCalledExactlyOnceWith('fake-token', CREATOR, DEV_GUILD, expect.any(Array), { correlationId: 'test' });
    expect(globalNames).not.toContain('dev');
    expect(guildNames).not.toContain('emoji');
  });

  it('runs both deployments sequentially, global first', async () => {
    vi.clearAllMocks();
    const handler = new CommandsHandler(await loadCommands());
    const context = { config: config(), applicationId: CREATOR, correlationId: 'test' };

    await new DeploymentsHandler([
      createCentralDeployment(handler),
      createGuildDeployment(handler, async () => ({ environment: 'development', devGuildIds: [DEV_GUILD] })),
    ]).run(context);

    expect(discord.deployGlobalCommands).toHaveBeenCalledOnce();
    expect(discord.deployGuildCommands).toHaveBeenCalledOnce();
    expect(discord.deployGlobalCommands.mock.invocationCallOrder[0]).toBeLessThan(
      discord.deployGuildCommands.mock.invocationCallOrder[0]!,
    );
  });

  it('publishes /emoji without a default member gate and leaves /dev unchanged', () => {
    const emoji = emojiCommand.data.toJSON();
    const dev = devCommand.data.toJSON();
    expect(emoji.default_member_permissions ?? null).toBeNull();
    expect(emoji.options?.map((option) => option.name)).toEqual(['add', 'info']);
    const info = emoji.options?.find((option) => option.name === 'info');
    expect(info && 'options' in info ? info.options : []).toEqual([
      expect.objectContaining({ name: 'emoji', type: 3, required: true }),
    ]);
    expect(dev.default_member_permissions ?? null).toBeNull();
    expect(dev.options?.map((option) => option.name)).toEqual(['emoji']);
    const group = dev.options?.[0];
    expect(group && 'options' in group ? group.options?.map((option) => option.name) : []).toEqual(['add']);
    const add = group && 'options' in group ? group.options?.find((option) => option.name === 'add') : undefined;
    expect(add && 'options' in add ? add.options : []).toEqual([
      expect.objectContaining({ name: 'nome', required: false }),
      expect.objectContaining({ name: 'origem', required: false }),
      expect.objectContaining({ name: 'arquivo', required: false }),
    ]);
    expect(devCommand.access).toEqual({
      kind: 'staff',
      minimumRole: 'dev',
      userPermissions: [],
      botPermissions: [PermissionFlagsBits.ViewChannel],
      requireChannelSend: true,
      messages: {
        guildOnly: 'Use um canal de texto de servidor para os comandos de equipe.',
        botMissing: 'Preciso destas permissões para executar este comando: **{permissions}**.',
      },
    });
    const devRoutes: ChatInputCommand['routes'] = devCommand.routes;
    expect(devRoutes?.map((route) => ({ path: [...route.path], aliases: [...route.aliases], access: route.access }))).toEqual([
      { path: ['emoji', 'add'], aliases: ['dev-emoji-add'], access: undefined },
    ]);
  });
});

const STATIC_ID = '90071992547409921';
const STATIC_MARKUP = `<:wave:${STATIC_ID}>`;
const ANIMATED_MARKUP = '<a:festinha:41771983429993937>';
const INFO_BOT = new PermissionsBitField([
  PermissionFlagsBits.ViewChannel,
  PermissionFlagsBits.SendMessages,
  PermissionFlagsBits.EmbedLinks,
]);

function confirmed(animated: boolean, name = 'wave', guildName = 'Atual'): EmojiInfoLookup {
  return { status: 'confirmed', name, animated, guildName };
}

interface ReplyPayload {
  readonly content?: string;
  readonly embeds?: APIEmbed[];
  readonly components?: readonly { readonly components: readonly { readonly label?: string; readonly url?: string; readonly style?: number }[] }[];
  readonly allowedMentions?: unknown;
}

function embedOf(payload: ReplyPayload | undefined): APIEmbed {
  const embed = payload?.embeds?.[0];
  if (embed === undefined) throw new Error('expected an embed');
  return embed;
}

describe('emoji info', () => {
  const openMember = new PermissionsBitField();
  const usage = '⚠️ Envie somente a marcação de um emoji personalizado, como `<:nome:id>` ou `<a:nome:id>`.';

  function handlerFor(result: EmojiInfoLookup | 'missing' = confirmed(false)) {
    const lookup = vi.fn(async (): Promise<EmojiInfoLookup> => (
      result === 'missing' ? { status: 'unconfirmed' } : result
    ));
    return { lookup, handler: new CommandsHandler([emojiCommand], undefined, undefined, { lookup }) };
  }

  async function runInfo(
    transport: (typeof transports)[number],
    markup: string,
    spec: TransportSpec,
    result: EmojiInfoLookup | 'missing' = confirmed(false),
  ) {
    const { lookup, handler } = handlerFor(result);
    if (transport === 'slash') {
      const ports = slash('emoji', ['info'], { ...spec, options: spec.options ?? [{ name: 'emoji', value: markup }] });
      const replies = await runSlash(ports, handler);
      return { replies, payload: ports.reply.mock.calls[0]?.[0] as ReplyPayload | undefined, deferReply: ports.deferReply, lookup };
    }
    const content = markup === '' ? `${transport}emoji-info` : `${transport}emoji-info ${markup}`;
    const { message, reply } = prefix(content, spec);
    const replies = await runPrefix(message, handler);
    return { replies, payload: reply.mock.calls[0]?.[0] as ReplyPayload | undefined, deferReply: undefined, lookup };
  }

  function openSpec(overrides: TransportSpec = {}): TransportSpec {
    return { guildId: OTHER_GUILD, memberPermissions: openMember, appPermissions: INFO_BOT, ...overrides };
  }

  it.each(transports)('%s: shows confirmed static data and the original markup', async (transport) => {
    const markup = transport === 'slash' ? `  ${STATIC_MARKUP}  ` : STATIC_MARKUP;
    const { replies, payload, deferReply, lookup } = await runInfo(transport, markup, openSpec());
    if (transport === 'slash') expect(deferReply).toHaveBeenCalledWith({ flags: MessageFlags.Ephemeral });
    expect(lookup).toHaveBeenCalledExactlyOnceWith(OTHER_GUILD, STATIC_ID);
    expect(replies).toEqual([undefined]);
    expect(payload?.content).toBeUndefined();
    expect(payload?.allowedMentions).toBeUndefined();
    const embed = embedOf(payload);
    expect(embed.description).toBeUndefined();
    expect(embed).toMatchObject({
      color: 0xf08db4,
      thumbnail: { url: `https://cdn.discordapp.com/emojis/${STATIC_ID}.png` },
    });
    expect(embed.image).toBeUndefined();
    expect(embed.fields).toEqual([
      { name: '🪪 Identidade', value: `\`${STATIC_ID}\``, inline: true },
      { name: '🖼️ Menção', value: `\`\`\`\n${STATIC_MARKUP}\n\`\`\``, inline: true },
    ]);
    expect(payload?.components?.[0]?.components[0]).toMatchObject({
      label: 'Abrir no navegador',
      url: `https://cdn.discordapp.com/emojis/${STATIC_ID}.png`,
    });
  });

  it.each(transports)('%s: prefers the confirmed animated emoji and keeps the sent markup', async (transport) => {
    const { payload, lookup } = await runInfo(
      transport,
      STATIC_MARKUP,
      openSpec(),
      confirmed(true, 'nova_festa', 'Guilda *externa*'),
    );
    expect(lookup).toHaveBeenCalledWith(OTHER_GUILD, STATIC_ID);
    const embed = embedOf(payload);
    expect(embed.description).toBeUndefined();
    expect(embed.thumbnail).toEqual({ url: `https://cdn.discordapp.com/emojis/${STATIC_ID}.gif` });
    expect(embed.fields).toEqual([
      { name: '🪪 Identidade', value: `\`${STATIC_ID}\``, inline: true },
      { name: '🖼️ Menção', value: `\`\`\`\n${STATIC_MARKUP}\n\`\`\``, inline: true },
    ]);
    expect(payload?.components?.[0]?.components[0]?.url).toBe(`https://cdn.discordapp.com/emojis/${STATIC_ID}.gif`);
  });

  it.each(transports)('%s: reports an unconfirmed animated emoji without treating it as deleted', async (transport) => {
    const { replies, payload } = await runInfo(transport, ANIMATED_MARKUP, openSpec(), { status: 'unconfirmed' });
    expect(replies).toEqual([undefined]);
    const embed = embedOf(payload);
    expect(embed.description).toBeUndefined();
    expect(embed.thumbnail).toEqual({ url: 'https://cdn.discordapp.com/emojis/41771983429993937.gif' });
    expect(embed.fields).toEqual([
      { name: '🪪 Identidade', value: '`41771983429993937`', inline: true },
      { name: '🖼️ Menção', value: `\`\`\`\n${ANIMATED_MARKUP}\n\`\`\``, inline: true },
    ]);
    expect(payload?.components?.[0]?.components[0]?.url).toBe('https://cdn.discordapp.com/emojis/41771983429993937.gif');
  });

  it.each(transports)('%s: rejects empty, unicode, bare id, url, malformed, markdown and extra input', async (transport) => {
    const cases = ['', '😀', '90071992547409921', 'https://cdn.discordapp.com/emojis/1.png', '<:a:1>', '<:na*me:90071992547409921>', `${STATIC_MARKUP} ${STATIC_MARKUP}`, `${STATIC_MARKUP} extra`];
    for (const markup of cases) {
      const { replies, lookup } = await runInfo(transport, markup, openSpec());
      expect(replies).toEqual([usage]);
      expect(lookup).not.toHaveBeenCalled();
    }
  });

  it.each(transports)('%s: rejects an attachment even when the markup is valid', async (transport) => {
    const { replies, lookup } = await runInfo(transport, STATIC_MARKUP, openSpec({ attachments: [ATTACHMENT] }));
    expect(replies).toEqual([usage]);
    expect(lookup).not.toHaveBeenCalled();
  });

  it.each(transports)('%s: reports a lookup failure once', async (transport) => {
    const { replies, lookup } = await runInfo(transport, STATIC_MARKUP, openSpec(), { status: 'unavailable' });
    expect(lookup).toHaveBeenCalledOnce();
    expect(replies).toEqual(['😅 Não consegui consultar este emoji agora. Tente de novo daqui a pouco.']);
  });

  it.each(transports)('%s: lets a member without emoji management consult, and still blocks add', async (transport) => {
    const { lookup, handler } = handlerFor(confirmed(false));
    const spec = openSpec();
    if (transport === 'slash') await runSlash(slash('emoji', ['info'], { ...spec, options: [{ name: 'emoji', value: STATIC_MARKUP }] }), handler);
    else await runPrefix(prefix(`${transport}emoji-info ${STATIC_MARKUP}`, spec).message, handler);
    expect(lookup).toHaveBeenCalledOnce();

    const { importEmoji, service } = importService();
    const addReplies = transport === 'slash'
      ? await runSlash(slash('emoji', ['add'], { ...spec, attachments: [ATTACHMENT] }), new CommandsHandler([emojiCommand], undefined, service))
      : await runPrefix(prefix(`${transport}emoji-add`, { ...spec, attachments: [ATTACHMENT] }).message, new CommandsHandler([emojiCommand], undefined, service));
    expect(importEmoji).not.toHaveBeenCalled();
    expect(addReplies).toEqual(['😞 Você precisa da permissão **Gerenciar emojis** para adicionar emojis.']);
  });

  it.each(transports)('%s: requires Embed Links only for info', async (transport) => {
    const spec = openSpec({
      memberPermissions: new PermissionsBitField(PermissionFlagsBits.ManageGuildExpressions),
      appPermissions: new PermissionsBitField([
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.CreateGuildExpressions,
      ]),
    });
    const { replies, lookup } = await runInfo(transport, STATIC_MARKUP, spec);
    expect(lookup).not.toHaveBeenCalled();
    expect(replies).toEqual(['😠 Preciso destas permissões para executar este comando: **Inserir links**.']);

    const { importEmoji, service } = importService();
    const addHandler = new CommandsHandler([emojiCommand], undefined, service);
    if (transport === 'slash') await runSlash(slash('emoji', ['add'], { ...spec, attachments: [ATTACHMENT] }), addHandler);
    else await runPrefix(prefix(`${transport}emoji-add`, { ...spec, attachments: [ATTACHMENT] }).message, addHandler);
    expect(importEmoji).toHaveBeenCalledOnce();
  });

  it.each(transports)('%s: fails closed when permission context is missing', async (transport) => {
    for (const missing of ['member', 'app'] as const) {
      const spec = openSpec(missing === 'member' ? { memberPermissions: null } : { appPermissions: null });
      const { replies, lookup } = await runInfo(transport, STATIC_MARKUP, spec);
      expect(lookup).not.toHaveBeenCalled();
      expect(replies[0]).toMatch(missing === 'member' ? /^😅 Não consegui conferir suas permissões/ : /^😅 Não consegui conferir minhas permissões/);
    }
  });

  it.each(transports)('%s: refuses info in a direct message', async (transport) => {
    const { replies, lookup } = await runInfo(transport, STATIC_MARKUP, openSpec({ guildId: null }));
    expect(lookup).not.toHaveBeenCalled();
    expect(replies).toEqual(['🏘️ Use um canal de texto de servidor para consultar emojis.']);
  });

  it.each(transports)('%s: accepts info in a thread when the bot can send there and embed links', async (transport) => {
    const spec = openSpec({
      isThread: true,
      appPermissions: new PermissionsBitField([
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessagesInThreads,
        PermissionFlagsBits.EmbedLinks,
      ]),
    });
    const { lookup } = await runInfo(transport, STATIC_MARKUP, spec);
    expect(lookup).toHaveBeenCalledOnce();
  });

  it.each(transports)('%s: refuses a thread when the bot can only send in regular channels', async (transport) => {
    const { replies, lookup } = await runInfo(transport, STATIC_MARKUP, openSpec({ isThread: true }));
    expect(lookup).not.toHaveBeenCalled();
    expect(replies).toEqual(['😠 Preciso destas permissões para executar este comando: **Enviar mensagens**.']);
  });

  it('keeps an emoji in the reply when the resolver fails', async () => {
    const { handler } = handlerFor({ status: 'unconfirmed' });
    const ports = slash('emoji', ['info'], {
      ...openSpec(),
      options: [{ name: 'emoji', value: STATIC_MARKUP }],
    });
    vi.mocked(ports.port.client.application.emojis.fetch).mockRejectedValue(new Error('emoji catalog down'));
    const replies = await runSlash(ports, handler);
    expect(replies).toEqual([undefined]);
    const payload = ports.reply.mock.calls[0]?.[0] as ReplyPayload | undefined;
    expect(embedOf(payload).fields?.map((field) => field.name)).toEqual(['🪪 Identidade', '🖼️ Menção']);
  });
});
