import { PermissionFlagsBits, PermissionsBitField, SlashCommandBuilder, type GuildTextBasedChannel } from 'discord.js';
import { describe, expect, it, vi } from 'vitest';
import { readDatabaseConfig, type StaffRole } from '@kuruttina/database';
import type { EmojiImportService, EmojiImportRequest } from '../apps/bot/src/application/emojis/importEmoji.js';
import {
  emojiError,
  type EmojiAttachment,
  type EmojiImportErrorCode,
  type PreparedEmojiImage,
} from '../apps/bot/src/application/emojis/types.js';
import { createEmojiAddExecutor } from '../apps/bot/src/commands/emojiAdd.js';
import { command as devCommand } from '../apps/bot/src/commands/dev/emoji.js';
import { command as emojiCommand } from '../apps/bot/src/commands/mod/emoji.js';
import { loadCommands } from '../apps/bot/src/commands/loadCommands.js';
import type { CommandContext } from '../apps/bot/src/commands/types.js';
import { createCentralDeployment } from '../apps/bot/src/deployments/central.js';
import { createGuildDeployment } from '../apps/bot/src/deployments/guild.js';
import { handleChatInputCommand, type InteractionCommandPort } from '../apps/bot/src/events/interactions/interactionCreate.js';
import { handleMessageCreate } from '../apps/bot/src/events/messages/messageCreate.js';
import { CommandsHandler } from '../apps/bot/src/handlers/CommandsHandler.js';
import { DeploymentsHandler } from '../apps/bot/src/handlers/DeploymentsHandler.js';
import type { CommandClientPort } from '../apps/bot/src/infrastructure/discord/commandContext.js';

const discord = vi.hoisted(() => ({ deployGuildCommands: vi.fn(), deployGlobalCommands: vi.fn() }));
vi.mock('../apps/bot/src/infrastructure/discord/commands.js', () => discord);

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

function channel(guildId: string, appPermissions: PermissionsBitField = full): GuildTextBasedChannel {
  return {
    id: '910000000000000099',
    guild: { id: guildId, members: { me: { id: 'bot' } } },
    isDMBased: () => false,
    isThread: () => false,
    permissionsFor: () => appPermissions,
    bulkDelete: vi.fn(),
    messages: { fetch: vi.fn(), delete: vi.fn() },
    send: vi.fn(),
  } as unknown as GuildTextBasedChannel;
}

interface TransportSpec {
  readonly userId?: string;
  /** `null` simula uma conversa direta com o bot. */
  readonly guildId?: string | null;
  readonly memberPermissions?: PermissionsBitField;
  readonly appPermissions?: PermissionsBitField;
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
    channel: spec.guildId ? channel(spec.guildId, spec.appPermissions) : null,
    memberPermissions: spec.memberPermissions ?? full,
    appPermissions: spec.appPermissions ?? full,
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
    ...(spec.guildId ? { channel: channel(spec.guildId, spec.appPermissions) } : {}),
    member: { permissionsIn: () => spec.memberPermissions ?? full } as unknown as NonNullable<
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
      source: { kind: 'attachment', url: ATTACHMENT.url, filename: 'party_cat.png', size: 1024 },
      destination: { kind: 'guild', guildId: OTHER_GUILD },
      name: undefined,
    });
    expect(texts(ports.reply)).toEqual(['➕ Emoji **derived** adicionado a este servidor. ✅']);
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
        `➕ Emoji **${created}** adicionado a este servidor. ✅`,
      ]);
      expect(message.client.application.emojis.fetch).toHaveBeenCalledOnce();
    },
  );

  it('sends /dev emoji add to the Application Emojis of the active bot', async () => {
    const { importEmoji, service } = importService();
    const staff = staffPort('creator');
    const ports = slash('dev', ['emoji', 'add'], { guildId: DEV_GUILD, attachments: [ATTACHMENT] });

    await runSlash(ports, new CommandsHandler([devCommand], staff, service));

    expect(importEmoji).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
      destination: { kind: 'application' },
    }));
    expect(texts(ports.reply)).toEqual(['🧑‍💻 Emoji **derived** adicionado aos Application Emojis do bot. ✅']);
    expect(ports.port.client.application.emojis.fetch).toHaveBeenCalledOnce();
  });

  it.each(['k!dev-emoji-add', 'K!dev-emoji-add'])('routes prefix %s to the shared application executor', async (content) => {
    const { importEmoji, service } = importService();
    const { message } = prefix(content, { guildId: DEV_GUILD, attachments: [ATTACHMENT] });

    await runPrefix(message, new CommandsHandler([devCommand], staffPort('dev'), service));

    expect(importEmoji).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
      destination: { kind: 'application' },
    }));
    expect(texts(message.reply as unknown as ReturnType<typeof vi.fn>)).toEqual([
      '🧑‍💻 Emoji **derived** adicionado aos Application Emojis do bot. ✅',
    ]);
  });

  it.each(['k!emoji', 'K!emoji', 'k!dev'])('answers %s with its usage instead of importing', async (content) => {
    const { importEmoji, service } = importService();
    const { message } = prefix(content, { guildId: DEV_GUILD, attachments: [ATTACHMENT] });

    const replies = await runPrefix(message, new CommandsHandler([emojiCommand, devCommand], staffPort('creator'), service));

    expect(importEmoji).not.toHaveBeenCalled();
    const alias = content === 'k!dev' ? 'dev-emoji-add' : 'emoji-add';
    expect(replies).toEqual([`📖 Este comando exige um subcomando. Use \`k!${alias}\`.`]);
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
    expect(replies).toEqual(['📖 Este comando exige um subcomando. Use `k!emoji-add`.']);
  });

  it('keeps the import service optional so a missing composition fails closed', async () => {
    const ports = slash('emoji', ['add'], { guildId: DEV_GUILD, attachments: [ATTACHMENT] });

    const replies = await runSlash(ports, new CommandsHandler([emojiCommand]));

    expect(replies).toEqual(['😅 A importação de emojis não está disponível no momento.']);
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

      if (transport === 'slash') {
        await runSlash(slash('dev', ['emoji', 'add'], spec), handler);
      } else {
        await runPrefix(prefix(transport + 'dev-emoji-add', spec).message, handler);
      }

      expect(importEmoji).toHaveBeenCalledTimes(expected ? 1 : 0);
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
      expect(replies).toEqual(['😅 Não consegui verificar o acesso agora. Tente novamente mais tarde.']);
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
    expect(replies).toEqual(['🏘️ Vamos adicionar emojis em um canal de texto de servidor!']);
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
      expected: '⚠️ Entrada inválida: envie uma imagem anexada ou um emoji personalizado, com no máximo um nome opcional.',
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
    importEmoji.mockRejectedValueOnce(emojiError('queue_full', 'Muitas importações em andamento; tente novamente em instantes.'));
    const ports = slash('emoji', ['add'], { guildId: OTHER_GUILD, attachments: [ATTACHMENT] });

    const replies = await runSlash(ports, new CommandsHandler([emojiCommand], undefined, service));

    expect(replies).toEqual(['☕ Muitas importações em andamento; tente novamente em instantes.']);
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

    expect(replies).toEqual(['<:add:1> Emoji **derived** adicionado a este servidor. <:sucess:2>']);
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
      credentials: {
        development: { token: 'fake-token', expectedBotId: CREATOR },
        production: { token: 'fake-prod-token', expectedBotId: DEV },
      },
      activeCredential: { token: 'fake-token', expectedBotId: CREATOR },
      autoSyncCommands: false,
      database: readDatabaseConfig(
        { DATABASE_URL_DEVELOPMENT: 'postgres://kuruttina_bot:test@localhost/postgres' },
        'development',
      ),
    };
  }

  it('publishes /emoji add globally and /dev emoji add only in the configured guild', async () => {
    vi.clearAllMocks();
    const handler = new CommandsHandler(await loadCommands());
    const context = { config: config(), applicationId: CREATOR, correlationId: 'test' };

    await createCentralDeployment(handler).run(context);
    await createGuildDeployment(handler, async () => ({ environment: 'development', devGuildId: DEV_GUILD })).run(context);

    const globalNames = discord.deployGlobalCommands.mock.calls[0]?.[2].map(({ name }: { name: string }) => name);
    const guildNames = discord.deployGuildCommands.mock.calls[0]?.[3].map(({ name }: { name: string }) => name);
    expect(globalNames).toEqual(['clear', 'emoji', 'ping']);
    expect(guildNames).toEqual(['dev']);
    expect(discord.deployGuildCommands).toHaveBeenCalledExactlyOnceWith('fake-token', CREATOR, DEV_GUILD, expect.any(Array));
    expect(globalNames).not.toContain('dev');
    expect(guildNames).not.toContain('emoji');
  });

  it('runs both deployments sequentially, global first', async () => {
    vi.clearAllMocks();
    const handler = new CommandsHandler(await loadCommands());
    const context = { config: config(), applicationId: CREATOR, correlationId: 'test' };

    await new DeploymentsHandler([
      createCentralDeployment(handler),
      createGuildDeployment(handler, async () => ({ environment: 'development', devGuildId: DEV_GUILD })),
    ]).run(context);

    expect(discord.deployGlobalCommands).toHaveBeenCalledOnce();
    expect(discord.deployGuildCommands).toHaveBeenCalledOnce();
    expect(discord.deployGlobalCommands.mock.invocationCallOrder[0]).toBeLessThan(
      discord.deployGuildCommands.mock.invocationCallOrder[0]!,
    );
  });
});
