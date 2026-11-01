import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MessageTemplate } from '@kuruttina/message-templates';
import {
  handleMemberEvent,
  type MemberEventsPort,
} from '../apps/bot/src/events/members/memberEvents.js';
import { log } from '../apps/bot/src/infrastructure/logging/logger.js';

vi.mock('../apps/bot/src/infrastructure/logging/logger.js', () => ({ log: vi.fn() }));

const GUILD_ID = 'guild-1';

type Config = { enabled: boolean; channelId: string | null; ignoreBots: boolean; content: unknown };

const joinConfig: Config = {
  enabled: true,
  channelId: 'channel-1',
  ignoreBots: true,
  content: { content: 'Bem-vindo {user.name}, somos {guild.membercount}!', embeds: [], components: [] } satisfies MessageTemplate,
};

const leaveConfig: Config = {
  enabled: true,
  channelId: 'channel-1',
  ignoreBots: true,
  content: { content: 'Tchau {user.name}', embeds: [], components: [] } satisfies MessageTemplate,
};

function makeDatabase(configs: Partial<Record<'join' | 'leave', Config | null>> = {}): MemberEventsPort {
  return {
    memberEvents: {
      get: vi.fn(async (_guildId: string, event: 'join' | 'leave') => configs[event] ?? null),
    },
  } as MemberEventsPort;
}

function makeGuild(channels: Record<string, unknown> = {}) {
  return {
    id: GUILD_ID,
    name: 'Casa',
    memberCount: 6,
    iconURL: () => null,
    bannerURL: () => null,
    channels: {
      cache: new Map(Object.entries(channels)),
      fetch: vi.fn().mockResolvedValue(null),
    },
  };
}

function makeMember(guild: ReturnType<typeof makeGuild>, bot = false) {
  return {
    guild,
    user: {
      id: '111111111111111111',
      bot,
      displayName: 'Ana',
      displayAvatarURL: () => 'https://cdn.discordapp.com/avatars/1/a.png?size=256',
    },
  } as never;
}

function makeChannel(guildId: string, send = vi.fn().mockResolvedValue(undefined)) {
  return { id: 'channel-1', guildId, isTextBased: () => true, send };
}

describe('member events', () => {
  beforeEach(() => {
    vi.mocked(log).mockClear();
  });

  it('sends the join embed rendered with the member name and the guild member count', async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const guild = makeGuild({ 'channel-1': makeChannel(GUILD_ID, send) });
    const database = makeDatabase({
      join: {
        ...joinConfig,
        content: { embeds: [{ title: 'Oi {user.name}', description: 'Agora somos {guild.membercount}' }], components: [] },
      },
    });

    await handleMemberEvent('join', makeMember(guild), database);

    expect(database.memberEvents.get).toHaveBeenCalledWith(GUILD_ID, 'join');
    expect(send).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
      embeds: [expect.objectContaining({ title: 'Oi Ana', description: 'Agora somos 6' })],
    }));
  });

  it('uses the leave configuration when a member leaves', async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const guild = makeGuild({ 'channel-1': makeChannel(GUILD_ID, send) });
    const database = makeDatabase({ join: joinConfig, leave: leaveConfig });

    await handleMemberEvent('leave', makeMember(guild), database);

    expect(database.memberEvents.get).toHaveBeenCalledWith(GUILD_ID, 'leave');
    expect(database.memberEvents.get).not.toHaveBeenCalledWith(GUILD_ID, 'join');
    expect(send).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ content: 'Tchau Ana' }));
  });

  it('does not send when the event is disabled', async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const guild = makeGuild({ 'channel-1': makeChannel(GUILD_ID, send) });
    const database = makeDatabase({ join: { ...joinConfig, enabled: false } });

    await handleMemberEvent('join', makeMember(guild), database);

    expect(send).not.toHaveBeenCalled();
  });

  it('does not send when there is no configuration or no channel', async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const guild = makeGuild({ 'channel-1': makeChannel(GUILD_ID, send) });

    await handleMemberEvent('join', makeMember(guild), makeDatabase());
    await handleMemberEvent('join', makeMember(guild), makeDatabase({ join: { ...joinConfig, channelId: null } }));

    expect(send).not.toHaveBeenCalled();
  });

  it('does not send when the configured channel cannot be found', async () => {
    const guild = makeGuild();

    await handleMemberEvent('join', makeMember(guild), makeDatabase({ join: joinConfig }));

    expect(guild.channels.fetch).toHaveBeenCalledWith('channel-1');
  });

  it('does not send a bot join when ignoreBots is enabled', async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const guild = makeGuild({ 'channel-1': makeChannel(GUILD_ID, send) });

    await handleMemberEvent('join', makeMember(guild, true), makeDatabase({ join: joinConfig }));

    expect(send).not.toHaveBeenCalled();
  });

  it('sends a bot join when ignoreBots is disabled', async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const guild = makeGuild({ 'channel-1': makeChannel(GUILD_ID, send) });

    await handleMemberEvent('join', makeMember(guild, true), makeDatabase({ join: { ...joinConfig, ignoreBots: false } }));

    expect(send).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ content: 'Bem-vindo Ana, somos 6!' }));
  });

  it('does not send to a channel that belongs to another server', async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const guild = makeGuild({ 'channel-1': makeChannel('guild-other', send) });

    await handleMemberEvent('join', makeMember(guild), makeDatabase({ join: joinConfig }));

    expect(send).not.toHaveBeenCalled();
  });

  it('does not throw when the send fails, and logs only the event, guild and error name', async () => {
    const send = vi.fn().mockRejectedValue(new Error('Missing Permissions'));
    const guild = makeGuild({ 'channel-1': makeChannel(GUILD_ID, send) });

    await expect(handleMemberEvent('join', makeMember(guild), makeDatabase({ join: joinConfig }))).resolves.toBeUndefined();

    expect(log).toHaveBeenCalledExactlyOnceWith('error', 'member_event_failed', {
      event: 'join',
      guildId: GUILD_ID,
      errorName: 'Error',
    });
  });

  it('does not throw when reading the configuration fails', async () => {
    const database = {
      memberEvents: { get: vi.fn().mockRejectedValue(new TypeError('connection lost')) },
    } as unknown as MemberEventsPort;

    await expect(handleMemberEvent('leave', makeMember(makeGuild()), database)).resolves.toBeUndefined();

    expect(log).toHaveBeenCalledExactlyOnceWith('error', 'member_event_failed', {
      event: 'leave',
      guildId: GUILD_ID,
      errorName: 'TypeError',
    });
  });

  it('sends with allowed mentions parse set to empty', async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const guild = makeGuild({ 'channel-1': makeChannel(GUILD_ID, send) });

    await handleMemberEvent('join', makeMember(guild), makeDatabase({ join: joinConfig }));

    expect(send).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ allowedMentions: { parse: [] } }));
  });
});
