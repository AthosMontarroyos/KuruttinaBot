import { describe, expect, it, vi } from 'vitest';
import { SlashCommandBuilder } from 'discord.js';
import { command as pingCommand } from '../apps/bot/src/commands/public/ping.js';
import { CommandsHandler, loadCommands } from '../apps/bot/src/handlers/CommandsHandler.js';

describe('commands', () => {
  it('discovers and publishes the canonical commands automatically', async () => {
    const handler = new CommandsHandler(await loadCommands());

    expect(handler.payload().map((command) => command.name)).toEqual(['ping']);
  });

  it('rejects malformed and duplicate commands', () => {
    expect(() => new CommandsHandler([{ ...pingCommand, execute: undefined } as never])).toThrow('Invalid command');
    expect(() => new CommandsHandler([pingCommand, pingCommand])).toThrow('Duplicate');
  });

  it('rejects unknown commands', async () => {
    await expect(new CommandsHandler([pingCommand]).execute({ commandName: 'unknown' } as never)).rejects.toThrow(
      'Unknown command',
    );
  });

  it('dispatches a registered command through its global executor', async () => {
    const reply = vi.fn().mockResolvedValue(undefined);

    await new CommandsHandler([pingCommand]).execute({ commandName: 'ping', reply } as never);

    expect(reply).toHaveBeenCalledOnce();
    expect(reply).toHaveBeenCalledWith('Pong!');
  });

  it.each(['k!ping', 'K!ping', 'k!ping '])('dispatches %s to the shared executor', async (content) => {
    const reply = vi.fn().mockResolvedValue(undefined);
    await new CommandsHandler([pingCommand]).executeMessage({
      content, author: { bot: false }, webhookId: null, system: false, reply,
    } as never);
    expect(reply).toHaveBeenCalledExactlyOnceWith('Pong!');
  });

  it.each(['ping', '!ping', 'k!', 'k!unknown', 'k!pingpong', 'hello k!ping', ' k!ping'])('ignores %s', async (content) => {
    const reply = vi.fn();
    await new CommandsHandler([pingCommand]).executeMessage({
      content, author: { bot: false }, webhookId: null, system: false, reply,
    } as never);
    expect(reply).not.toHaveBeenCalled();
  });

  it.each([{ author: { bot: true } }, { webhookId: '123' }, { system: true }])('ignores automated messages %o', async (overrides) => {
    const reply = vi.fn();
    await new CommandsHandler([pingCommand]).executeMessage({
      content: 'k!ping', author: { bot: false }, webhookId: null, system: false, reply, ...overrides,
    } as never);
    expect(reply).not.toHaveBeenCalled();
  });

  it('automatically exposes another registered command through both transports', async () => {
    const execute = vi.fn().mockResolvedValue(undefined);
    const handler = new CommandsHandler([{ data: new SlashCommandBuilder().setName('example').setDescription('Example'), execute }]);
    await handler.execute({ commandName: 'example', reply: vi.fn() } as never);
    await handler.executeMessage({ content: 'K!example', author: { bot: false }, webhookId: null, system: false, reply: vi.fn() } as never);
    expect(execute).toHaveBeenCalledTimes(2);
    expect(handler.payload().map(({ name }) => name)).toEqual(['example']);
  });

  it('propagates failed prefix replies to the event error boundary', async () => {
    await expect(new CommandsHandler([pingCommand]).executeMessage({
      content: 'k!ping', author: { bot: false }, webhookId: null, system: false,
      reply: vi.fn().mockRejectedValue(new Error('Cannot send')),
    } as never)).rejects.toThrow('Cannot send');
  });
});
