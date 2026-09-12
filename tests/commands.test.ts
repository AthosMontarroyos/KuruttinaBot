import { describe, expect, it, vi } from 'vitest';
import { command as pingCommand } from '../apps/bot/src/commands/public/ping.js';
import { CommandsHandler, loadCommands } from '../apps/bot/src/handlers/CommandsHandler.js';

describe('commands', () => {
  it('discovers and publishes the canonical commands automatically', async () => {
    const handler = new CommandsHandler(await loadCommands());

    expect(handler.payload().map((command) => command.name)).toEqual(['ping']);
  });

  it('requires name, description and the prefix-command option', () => {
    expect(() => new CommandsHandler([{ ...pingCommand, prefixCommand: undefined } as never])).not.toThrow();
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
});
