import { describe, expect, it, vi } from 'vitest';
import { CommandsHandler } from '../apps/bot/src/handlers/CommandsHandler.js';

describe('commands', () => {
  it('publishes only the canonical ping command', () => {
    expect(new CommandsHandler().payload().map((command) => command.name)).toEqual(['ping']);
  });

  it('rejects unknown commands', async () => {
    await expect(new CommandsHandler().execute({ commandName: 'unknown' } as never)).rejects.toThrow('Unknown command');
  });

  it('dispatches a registered command through its global executor', async () => {
    const reply = vi.fn().mockResolvedValue(undefined);

    await new CommandsHandler().execute({ commandName: 'ping', reply } as never);

    expect(reply).toHaveBeenCalledOnce();
    expect(reply).toHaveBeenCalledWith('Pong!');
  });
});
