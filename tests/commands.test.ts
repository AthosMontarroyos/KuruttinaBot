import { describe, expect, it } from 'vitest';
import { commandPayload } from '../apps/bot/src/commands/index.js';
import { CommandsHandler } from '../apps/bot/src/handlers/CommandsHandler.js';

describe('commands', () => {
  it('publishes only the canonical ping command', () => {
    expect(commandPayload().map((command) => command.name)).toEqual(['ping']);
  });

  it('rejects unknown commands', async () => {
    await expect(new CommandsHandler().execute({ commandName: 'unknown' } as never)).rejects.toThrow('Unknown command');
  });
});
