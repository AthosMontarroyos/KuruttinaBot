import { PermissionFlagsBits, PermissionsBitField, SlashCommandBuilder, type RESTPostAPIChatInputApplicationCommandsJSONBody } from 'discord.js';
import { describe, expect, it, vi } from 'vitest';
import { hasConsistentDefaultPermissions, loadCommands } from '../apps/bot/src/commands/loadCommands.js';
import { command as pingCommand } from '../apps/bot/src/commands/public/ping.js';
import type { BulkDeletePort, ChatInputCommand, CommandAccess, CommandContext } from '../apps/bot/src/commands/types.js';
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
    author: { bot: false, id: 'author-id' },
    client: {
      application: {
        emojis: {
          fetch: vi.fn(async () => ({
            find: (predicate: (emoji: { name: string }) => boolean) => [
              { name: 'dancing', toString: () => '<a:dancing:dancing-id>' },
              { name: 'stats', toString: () => '<:stats:stats-id>' },
              { name: 'gateway', toString: () => '<:gateway:gateway-id>' },
              { name: 'cleaning', toString: () => '<:cleaning:cleaning-id>' },
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
    expect(handler.payload().map((command) => command.name)).toEqual(['clear', 'ping']);
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

  it.each([
    { author: { bot: true, id: 'author-id' } },
    { webhookId: '123' },
    { system: true },
  ])('ignores automated messages %o', async (overrides) => {
    const reply = vi.fn();
    await handleMessageCreate({ ...message('k!ping', reply), ...overrides }, new CommandsHandler([pingCommand]));
    expect(reply).not.toHaveBeenCalled();
  });

  it('automatically exposes another registered command through both transports', async () => {
    const execute = vi.fn().mockResolvedValue(undefined);
    const handler = new CommandsHandler([{
      data: new SlashCommandBuilder().setName('example').setDescription('Example'),
      access: { kind: 'public' },
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

describe('command access policy', () => {
  function guardedCommand(execute: ChatInputCommand['execute']): ChatInputCommand {
    return {
      data: new SlashCommandBuilder().setName('guardado').setDescription('Guardado'),
      access: {
        kind: 'guild',
        userPermissions: [PermissionFlagsBits.ManageMessages],
        botPermissions: [],
        requireChannelSend: true,
      },
      execute,
    };
  }

  function guildContext(reply = vi.fn().mockResolvedValue(undefined)): CommandContext {
    return {
      ...commandContext(reply),
      textChannel: { isThread: false } as unknown as BulkDeletePort,
      memberPermissions: new PermissionsBitField(PermissionFlagsBits.ManageMessages),
      appPermissions: new PermissionsBitField(PermissionFlagsBits.Administrator),
    };
  }

  it('rejects a command module without an access policy during discovery', async () => {
    await expect(loadCommands(new URL('./fixtures/missing-access/', import.meta.url))).rejects.toMatchObject({
      name: 'CommandLoadError',
      message: expect.stringContaining('missing-access'),
    });
  });

  it('blocks a guild command before its executor when permission context is unavailable', async () => {
    const execute = vi.fn().mockResolvedValue(undefined);
    const reply = vi.fn().mockResolvedValue(undefined);
    const acknowledge = vi.fn().mockResolvedValue(undefined);
    await new CommandsHandler([guardedCommand(execute)]).execute('guardado', {
      ...guildContext(reply),
      acknowledge,
      memberPermissions: undefined,
    });
    expect(execute).not.toHaveBeenCalled();
    expect(acknowledge).toHaveBeenCalledOnce();
    expect(reply).toHaveBeenCalledExactlyOnceWith('<:ops:ops-id> Não consegui conferir suas permissões. Tente novamente!');
  });

  it('blocks a guild command whose member lacks the declared permission', async () => {
    const execute = vi.fn().mockResolvedValue(undefined);
    const reply = vi.fn().mockResolvedValue(undefined);
    await new CommandsHandler([guardedCommand(execute)]).execute('guardado', {
      ...guildContext(reply),
      memberPermissions: new PermissionsBitField(),
    });
    expect(execute).not.toHaveBeenCalled();
    expect(reply).toHaveBeenCalledExactlyOnceWith(
      '<:Disappointed:Disappointed-id> Você precisa da permissão **Gerenciar mensagens** neste canal.',
    );
  });

  it('runs a guild command when its declared permissions are available', async () => {
    const execute = vi.fn().mockResolvedValue(undefined);
    const reply = vi.fn().mockResolvedValue(undefined);
    await new CommandsHandler([guardedCommand(execute)]).execute('guardado', guildContext(reply));
    expect(execute).toHaveBeenCalledOnce();
    expect(reply).not.toHaveBeenCalled();
  });

  function accessCommand(access: CommandAccess, defaultMemberPermissions: string | null): ChatInputCommand {
    return {
      data: {
        name: 'exemplo',
        toJSON: () => ({
          name: 'exemplo',
          description: 'Exemplo',
          default_member_permissions: defaultMemberPermissions,
        } as RESTPostAPIChatInputApplicationCommandsJSONBody),
      },
      access,
      execute: async () => {},
    };
  }

  it('accepts a public command without a default member gate', () => {
    expect(hasConsistentDefaultPermissions(accessCommand({ kind: 'public' }, null))).toBe(true);
  });

  it('rejects a public command with a default member gate', () => {
    const gated = accessCommand({ kind: 'public' }, String(PermissionFlagsBits.ManageMessages));
    expect(hasConsistentDefaultPermissions(gated)).toBe(false);
  });

  const guildPolicy: CommandAccess = {
    kind: 'guild',
    userPermissions: [PermissionFlagsBits.ManageMessages],
    botPermissions: [],
  };

  it('accepts a guild command without a default member gate', () => {
    expect(hasConsistentDefaultPermissions(accessCommand(guildPolicy, null))).toBe(true);
  });

  it('accepts a guild command whose default gate matches its policy', () => {
    const matching = accessCommand(guildPolicy, String(PermissionFlagsBits.ManageMessages));
    expect(hasConsistentDefaultPermissions(matching)).toBe(true);
  });

  it('rejects a guild command whose default gate diverges from its policy', () => {
    const divergent = accessCommand(guildPolicy, String(PermissionFlagsBits.ManageGuild));
    expect(hasConsistentDefaultPermissions(divergent)).toBe(false);
  });
});
