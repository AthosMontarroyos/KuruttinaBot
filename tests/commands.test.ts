import { SlashCommandBuilder } from 'discord.js';
import { describe, expect, it, vi } from 'vitest';
import { loadCommands } from '../apps/bot/src/commands/loadCommands.js';
import { command as pingCommand } from '../apps/bot/src/commands/public/ping.js';
import type { CommandContext } from '../apps/bot/src/commands/types.js';
import { handleMessageCreate } from '../apps/bot/src/events/messages/messageCreate.js';
import { CommandsHandler } from '../apps/bot/src/handlers/CommandsHandler.js';

function commandContext(reply = vi.fn().mockResolvedValue(undefined)): CommandContext {
  return {
    apiPing: 42,
    gatewayPing: 84,
    acknowledge: vi.fn().mockResolvedValue(undefined),
    emoji: vi.fn(async (name: string) => `<:${name}:${name}-id>`),
    reply,
  };
}

function message(content: string, reply = vi.fn().mockResolvedValue(undefined)) {
  return {
    content,
    id: 'message-id',
    author: { bot: false },
    client: {
      application: {
        emojis: {
          fetch: vi.fn(async () => ({
            find: (predicate: (emoji: { name: string }) => boolean) => [
              { name: 'dancing', toString: () => '<a:dancing:dancing-id>' },
              { name: 'stats', toString: () => '<:stats:stats-id>' },
              { name: 'gateway', toString: () => '<:gateway:gateway-id>' },
            ].find(predicate),
          })),
        },
      },
      ws: { ping: 84 },
    },
    createdTimestamp: Date.now() - 42,
    webhookId: null,
    system: false,
    reply,
  };
}

describe('commands', () => {
  it('discovers and publishes the canonical commands automatically', async () => {
    const handler = new CommandsHandler(await loadCommands());
    expect(handler.payload().map((command) => command.name)).toEqual(['ping']);
  });

  it('rejects malformed command modules during discovery', async () => {
    await expect(loadCommands(new URL('./fixtures/', import.meta.url))).rejects.toMatchObject({ name: 'CommandLoadError' });
  });

  it('rejects duplicate commands', () => {
    expect(() => new CommandsHandler([pingCommand, pingCommand])).toThrow('Duplicate');
  });

  it('rejects unknown commands', async () => {
    await expect(new CommandsHandler([pingCommand]).execute('unknown', commandContext())).rejects.toThrow('Unknown command');
  });

  it('dispatches a registered command through its global executor', async () => {
    const reply = vi.fn().mockResolvedValue(undefined);
    await new CommandsHandler([pingCommand]).execute('ping', commandContext(reply));
    expect(reply).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
      content: '<:dancing:dancing-id> Pong!',
      embeds: [expect.objectContaining({
        fields: [
          expect.objectContaining({ name: '<:stats:stats-id> API', value: '`42ms`' }),
          expect.objectContaining({ name: '<:gateway:gateway-id> Gateway', value: '`84ms`' }),
        ],
      })],
    }));
  });

  it.each(['k!ping', 'K!ping', 'k!ping '])('dispatches %s to the shared executor', async (content) => {
    const reply = vi.fn().mockResolvedValue(undefined);
    await handleMessageCreate(message(content, reply), new CommandsHandler([pingCommand]));
    expect(reply).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
      content: '<a:dancing:dancing-id> Pong!',
      embeds: [expect.objectContaining({ fields: expect.any(Array) })],
    }));
  });

  it.each(['ping', '!ping', 'k!', 'k!unknown', 'k!pingpong', 'hello k!ping', ' k!ping'])('ignores %s', async (content) => {
    const reply = vi.fn();
    await handleMessageCreate(message(content, reply), new CommandsHandler([pingCommand]));
    expect(reply).not.toHaveBeenCalled();
  });

  it.each([{ author: { bot: true } }, { webhookId: '123' }, { system: true }])('ignores automated messages %o', async (overrides) => {
    const reply = vi.fn();
    await handleMessageCreate({ ...message('k!ping', reply), ...overrides }, new CommandsHandler([pingCommand]));
    expect(reply).not.toHaveBeenCalled();
  });

  it('automatically exposes another registered command through both transports', async () => {
    const execute = vi.fn().mockResolvedValue(undefined);
    const handler = new CommandsHandler([{
      data: new SlashCommandBuilder().setName('example').setDescription('Example'),
      execute,
    }]);
    await handler.execute('example', commandContext());
    await handleMessageCreate(message('K!example'), handler);
    expect(execute).toHaveBeenCalledTimes(2);
    expect(handler.payload().map(({ name }) => name)).toEqual(['example']);
  });

  it('contains failed prefix replies at the event boundary', async () => {
    const reply = vi.fn().mockRejectedValue(new Error('Cannot send'));
    await expect(handleMessageCreate(message('k!ping', reply), new CommandsHandler([pingCommand]))).resolves.toBeUndefined();
  });
});
