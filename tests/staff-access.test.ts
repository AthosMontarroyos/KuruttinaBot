import { PermissionFlagsBits, PermissionsBitField, SlashCommandBuilder, type GuildTextBasedChannel } from 'discord.js';
import { describe, expect, it, vi } from 'vitest';
import type { StaffRole } from '@kuruttina/database';
import type { EmojiAttachment } from '../apps/bot/src/application/emojis/types.js';
import type { ChatInputCommand, CommandContext } from '../apps/bot/src/command-system/types.js';
import { CommandsHandler } from '../apps/bot/src/command-system/CommandsHandler.js';
import { handleChatInputCommand, type InteractionCommandPort } from '../apps/bot/src/events/interactions/interactionCreate.js';
import { handleMessageCreate } from '../apps/bot/src/events/messages/messageCreate.js';
import { createGuildDeployment } from '../apps/bot/src/deployments/guild.js';
import { createCentralDeployment } from '../apps/bot/src/deployments/central.js';
import { readDatabaseConfig } from '@kuruttina/database';
import { loadCommands } from '../apps/bot/src/command-system/loadCommands.js';
import { createRenderer } from '../apps/bot/src/infrastructure/discord/commands/commandContext.js';

const discord = vi.hoisted(() => ({ deployGuildCommands: vi.fn(), deployGlobalCommands: vi.fn() }));
vi.mock('../apps/bot/src/infrastructure/discord/commands/deployCommands.js', () => discord);
const guildId = '1422623678205657160';
const creatorId = '666948364507545600';
const devId = '1509331533348212808';
const allowed = new PermissionsBitField(PermissionFlagsBits.Administrator);
function command(minimumRole: StaffRole = 'dev'): ChatInputCommand {
  return {
    data: new SlashCommandBuilder().setName('restricted').setDescription('Test fixture'),
    access: { kind: 'staff', minimumRole, userPermissions: [PermissionFlagsBits.ManageGuild], botPermissions: [PermissionFlagsBits.SendMessages] },
    scope: 'dev-guild',
    execute: vi.fn(async () => {}),
  };
}
function context(): CommandContext {
  return {
    apiPing: 0, gatewayPing: 0, userId: creatorId, guildId,
    render: createRenderer(async () => ''), acknowledge: vi.fn(async () => {}), reply: vi.fn(async () => {}), emoji: async () => '',
    memberPermissions: allowed, appPermissions: allowed,
    textChannel: { isThread: false, fetchMessages: async () => [], bulkDelete: async () => 0, deleteMessage: async () => true },
  };
}
function channel(id: string, appPermissions = allowed): GuildTextBasedChannel {
  return {
    id: '123456789012345678', guild: { id, members: { me: { id: 'bot' } } },
    isDMBased: () => false, isThread: () => false, permissionsFor: () => appPermissions,
    bulkDelete: vi.fn(), messages: { fetch: vi.fn(), delete: vi.fn() }, send: vi.fn(),
  } as unknown as GuildTextBasedChannel;
}
function transports(userId: string, location: string | null, memberPermissions = allowed, appPermissions = allowed) {
  const client = { application: { emojis: { fetch: vi.fn(async () => ({ find: () => undefined })) } }, ws: { ping: 0 } };
  const reply = vi.fn(async () => {});
  let deferred = false;
  const slash: InteractionCommandPort = {
    client, commandName: 'restricted', createdTimestamp: Date.now(), id: 'interaction', userId,
    channel: location ? channel(location, appPermissions) : null, memberPermissions, appPermissions,
    isDeferred: () => deferred, isReplied: () => false,
    deferReply: vi.fn(async () => { deferred = true; }), deleteReply: reply, editReply: reply, followUp: reply, reply,
    optionsData: () => [],
    routePath: [],
    attachments: [],
  };
  const prefix = {
    client, content: 'k!restricted', createdTimestamp: Date.now(), id: 'message',
    author: { bot: false, id: userId }, system: false, webhookId: null,
    attachments: new Map<string, EmojiAttachment>(),
    ...(location ? { channel: channel(location, appPermissions) } : {}),
    member: { permissionsIn: () => memberPermissions } as unknown as NonNullable<Parameters<typeof handleMessageCreate>[0]['member']>,
    reply: vi.fn().mockResolvedValue(undefined),
  };
  return { slash, prefix };
}

describe('staff authorization in both transports', () => {
  for (const transport of ['slash', 'k!', 'K!']) {
    it.each([
      { user: creatorId, location: guildId, minimum: 'creator', expected: true },
      { user: creatorId, location: guildId, minimum: 'dev', expected: true },
      { user: devId, location: guildId, minimum: 'creator', expected: false },
      { user: devId, location: guildId, minimum: 'dev', expected: true },
      { user: '123456789012345678', location: guildId, minimum: 'dev', expected: false },
      { user: creatorId, location: '123456789012345678', minimum: 'dev', expected: false },
      { user: creatorId, location: null, minimum: 'dev', expected: false },
    ])(`${transport}: $user / $minimum / $location`, async ({ user, location, minimum, expected }) => {
      const cmd = command(minimum as StaffRole);
      const ports = transports(user, location);
      const staff = { getStaffRole: vi.fn(async (id: string, guild: string): Promise<StaffRole | null> => {
        if (transport === 'slash') expect(ports.slash.deferReply).toHaveBeenCalledOnce();
        if (guild !== guildId) return null;
        return id === creatorId ? 'creator' : id === devId ? 'dev' : null;
      }) };
      const handler = new CommandsHandler([cmd], staff);
      if (transport === 'slash') await handleChatInputCommand(ports.slash, handler);
      else await handleMessageCreate({ ...ports.prefix, content: transport + 'restricted' }, handler);
      expect(cmd.execute).toHaveBeenCalledTimes(expected ? 1 : 0);
      if (location) expect(staff.getStaffRole).toHaveBeenCalledWith(user, location);
      else expect(staff.getStaffRole).not.toHaveBeenCalled();
    });
    it(`${transport}: denies database failure and revoked access, then observes reactivation`, async () => {
      const cmd = command();
      const ports = transports(creatorId, guildId);
      const staff = { getStaffRole: vi.fn<() => Promise<StaffRole | null>>()
        .mockRejectedValueOnce(new Error('private SQL and connection details'))
        .mockResolvedValueOnce(null).mockResolvedValueOnce('creator') };
      const handler = new CommandsHandler([cmd], staff);
      for (let attempt = 0; attempt < 3; attempt++) {
        if (transport === 'slash') await handleChatInputCommand(ports.slash, handler);
        else await handleMessageCreate({ ...ports.prefix, content: transport + 'restricted' }, handler);
        expect(cmd.execute).toHaveBeenCalledTimes(attempt === 2 ? 1 : 0);
      }
      const output = JSON.stringify(transport === 'slash' ? [vi.mocked(ports.slash.editReply).mock.calls] : ports.prefix.reply.mock.calls);
      expect(output).not.toContain('private SQL');
    });
    it(`${transport}: Creator still requires member and bot permissions`, async () => {
      for (const missing of ['member', 'app']) {
        const cmd = command();
        const ports = transports(creatorId, guildId, missing === 'member' ? new PermissionsBitField() : allowed, missing === 'app' ? new PermissionsBitField() : allowed);
        const handler = new CommandsHandler([cmd], { getStaffRole: async () => 'creator' });
        if (transport === 'slash') await handleChatInputCommand(ports.slash, handler);
        else await handleMessageCreate({ ...ports.prefix, content: transport + 'restricted' }, handler);
        expect(cmd.execute).not.toHaveBeenCalled();
      }
    });
  }
  it('denies missing identity/provider and drains accepted executions at shutdown', async () => {
    const cmd = command();
    const handler = new CommandsHandler([cmd]);
    await handler.execute('restricted', context());
    expect(cmd.execute).not.toHaveBeenCalled();
    await handler.stop();
    await handler.execute('restricted', context());
    expect(cmd.execute).not.toHaveBeenCalled();
  });
  it('rejects malformed staff policies in the loader', async () => {
    await expect(loadCommands(new URL('./fixtures/invalid-staff/', import.meta.url))).rejects.toMatchObject({ name: 'CommandLoadError' });
  });
  it('publishes staff commands only to the current configured guild', async () => {
    const publicCommand: ChatInputCommand = { ...command(), data: new SlashCommandBuilder().setName('public').setDescription('Public'), access: { kind: 'public' }, scope: 'global' };
    const handler = new CommandsHandler([publicCommand, command()]);
    const cfg = {
      target: 'development' as const,
      activeCredential: { token: 'fake', expectedBotId: creatorId }, autoSyncCommands: false,
      database: readDatabaseConfig({ DATABASE_URL: 'postgres://kuruttina_bot:test@localhost/postgres' }, 'development'),
    };
    const ctx = { config: cfg, applicationId: creatorId, correlationId: 'test' };
    const settings = vi.fn(async () => ({ environment: 'development' as const, devGuildId: guildId }));
    await createCentralDeployment(handler).run(ctx);
    await createGuildDeployment(handler, settings).run(ctx);
    expect(discord.deployGlobalCommands).toHaveBeenLastCalledWith('fake', creatorId, [publicCommand.data.toJSON()]);
    expect(discord.deployGuildCommands).toHaveBeenLastCalledWith('fake', creatorId, guildId, [command().data.toJSON()]);
    settings.mockResolvedValueOnce({ environment: 'development', devGuildId: '123456789012345678' });
    await createGuildDeployment(handler, settings).run(ctx);
    expect(discord.deployGuildCommands).toHaveBeenLastCalledWith('fake', creatorId, '123456789012345678', [command().data.toJSON()]);
  });
});
