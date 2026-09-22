import { PermissionFlagsBits, PermissionsBitField, type GuildTextBasedChannel } from 'discord.js';
import { describe, expect, it, vi } from 'vitest';
import { createChannelContext, createEmojiResolver } from '../apps/bot/src/infrastructure/discord/commandContext.js';
import { createClearChannelAdapter } from '../apps/bot/src/infrastructure/discord/clearAdapter.js';
import { command as clear } from '../apps/bot/src/commands/mod/clear.js';
import { CommandsHandler } from '../apps/bot/src/handlers/CommandsHandler.js';
import { handleMessageCreate } from '../apps/bot/src/events/messages/messageCreate.js';
import { handleChatInputCommand, type InteractionCommandPort } from '../apps/bot/src/events/interactions/interactionCreate.js';

function channelFixture() {
  const bot = { id: 'bot' };
  const source = {
    id: 'channel', guild: { id: 'guild', members: { me: bot } },
    isDMBased: () => false,
    isThread: () => false,
    permissionsFor: vi.fn(() => new PermissionsBitField(PermissionFlagsBits.Administrator)),
    messages: { fetch: vi.fn(async () => new Map()), delete: vi.fn(async () => undefined) },
    bulkDelete: vi.fn(async (ids: string[]) => ({ size: ids.length })),
    send: vi.fn(async () => undefined),
  };
  // This double implements the members used by the adapters; it does not open a Gateway connection.
  return { source, channel: source as unknown as GuildTextBasedChannel };
}

describe('shared command adapters', () => {
  it('shares one emoji request across concurrent lookups and preserves animated formatting', async () => {
    const fetch = vi.fn(async () => ({ find: () => ({ toString: () => '<a:dancing:123>' }) }));
    const emoji = createEmojiResolver({ emojis: { fetch } });
    expect(await Promise.all([emoji('dancing'), emoji('dancing')])).toEqual(['<a:dancing:123>', '<a:dancing:123>']);
    expect(fetch).toHaveBeenCalledOnce();
  });

  it.each(['missing', 'failed'])('uses fallbacks for %s emojis without repeated requests', async (mode) => {
    const fetch = vi.fn(async () => {
      if (mode === 'failed') throw new Error('Discord unavailable');
      return { find: () => undefined };
    });
    const emoji = createEmojiResolver({ emojis: { fetch } });
    expect(await Promise.all([emoji('cleaning'), emoji('slap')])).toEqual(['🧹', '👋']);
    expect(await emoji('unknown')).toBe('');
    expect(fetch).toHaveBeenCalledOnce();
  });

  it('uses effective bot permissions and preserves an explicitly denied permission set', () => {
    const { channel, source } = channelFixture();
    expect(createChannelContext(channel).appPermissions?.has(PermissionFlagsBits.ManageMessages)).toBe(true);
    expect(source.permissionsFor).toHaveBeenCalledWith(source.guild.members.me);
    const denied = new PermissionsBitField();
    expect(createChannelContext(channel, denied, denied).appPermissions).toBe(denied);
    expect(createChannelContext(null)).toEqual({});
  });

  it.each(['slash', 'prefix'])('rejects clear with channel permission denied through %s', async (transport) => {
    const { channel, source } = channelFixture();
    const denied = new PermissionsBitField();
    const client = { application: { emojis: { fetch: vi.fn(async () => ({ find: () => undefined })) } }, ws: { ping: 0 } };
    const reply = vi.fn(async () => undefined);
    const handler = new CommandsHandler([clear]);
    if (transport === 'slash') {
      let deferred = false;
      const interaction: InteractionCommandPort = {
        client, channel, commandName: 'clear', createdTimestamp: Date.now(), id: 'interaction',
        memberPermissions: denied, appPermissions: new PermissionsBitField(PermissionFlagsBits.Administrator),
        isDeferred: () => deferred, isReplied: () => false,
        deferReply: vi.fn(async () => { deferred = true; }), deleteReply: reply, editReply: reply, followUp: reply, reply,
        optionsData: () => [{ name: 'quantidade', value: 1 }],
      };
      await handleChatInputCommand(interaction, handler);
    } else {
      await handleMessageCreate({
        client, channel, id: 'message', content: 'k!clear 1', createdTimestamp: Date.now(),
        author: { bot: false, id: 'user' }, system: false, webhookId: null,
        // Guild-wide permission is intentionally allowed while the channel overwrite denies it.
        member: { permissions: new PermissionsBitField(PermissionFlagsBits.ManageMessages), permissionsIn: () => denied } as unknown as NonNullable<Parameters<typeof handleMessageCreate>[0]['member']>,
        reply: vi.fn().mockResolvedValue(undefined),
      }, handler);
    }
    expect(source.messages.fetch).not.toHaveBeenCalled();
    expect(source.bulkDelete).not.toHaveBeenCalled();
    // The denial reply now resolves a bot emoji, so a lookup happens before the block.
  });
});

describe('Discord deletion adapter', () => {
  it.each([0, 1, 100, 101, 200])('deletes %s messages with Discord-sized batches', async (count) => {
    const { channel, source } = channelFixture();
    const messages = Array.from({ length: count }, (_, i) => ({ id: String(i) }));
    expect(await createClearChannelAdapter(channel).bulkDelete(messages)).toBe(count);
    if (count === 1) {
      expect(source.messages.delete).toHaveBeenCalledExactlyOnceWith('0');
      expect(source.bulkDelete).not.toHaveBeenCalled();
    } else {
      expect(source.bulkDelete.mock.calls.map(([ids]) => ids.length)).toEqual(count === 0 ? [] : count <= 100 ? [count] : [100, count - 100]);
      expect(source.bulkDelete.mock.calls.flatMap(([ids]) => ids)).toEqual(messages.map(({ id }) => id));
      expect(source.messages.delete).not.toHaveBeenCalled();
    }
  });

  it('does not report a successful single deletion when Discord rejects it', async () => {
    const { channel, source } = channelFixture();
    source.messages.delete.mockRejectedValue(new Error('Forbidden'));
    expect(await createClearChannelAdapter(channel).bulkDelete([{ id: 'message' }])).toBe(0);
  });
});
