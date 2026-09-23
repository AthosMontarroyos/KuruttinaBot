import { MessageFlags, SlashCommandBuilder, type InteractionReplyOptions } from 'discord.js';
import { describe, expect, it, vi } from 'vitest';
import type { ChatInputCommand } from '../apps/bot/src/commands/types.js';
import {
  handleChatInputCommand,
  type InteractionCommandPort,
} from '../apps/bot/src/events/interactions/interactionCreate.js';
import { CommandsHandler } from '../apps/bot/src/handlers/CommandsHandler.js';

function interactionPort() {
  let deferred = false;
  let replied = false;
  const port: InteractionCommandPort = {
    client: {
      application: {
        emojis: { fetch: vi.fn(async () => ({ find: () => undefined })) },
      },
      ws: { ping: 84 },
    },
    commandName: 'example',
    createdTimestamp: Date.now() - 42,
    id: 'interaction-id',
    userId: '666948364507545600',
    isDeferred: () => deferred,
    isReplied: () => replied,
    deferReply: vi.fn(async () => { deferred = true; }),
    deleteReply: vi.fn(async () => undefined),
    editReply: vi.fn(async () => undefined),
    followUp: vi.fn(async (_content: string | InteractionReplyOptions) => undefined),
    reply: vi.fn(async (_content: string | InteractionReplyOptions) => { replied = true; }),
    optionsData: vi.fn(() => []),
    routePath: [],
  };
  return port;
}

function command(execute: NonNullable<ChatInputCommand['execute']>): ChatInputCommand {
  return {
    data: new SlashCommandBuilder().setName('example').setDescription('Example'),
    access: { kind: 'public' },
    scope: 'global',
    execute,
  };
}

describe('interaction command boundary', () => {
  it('supports acknowledging slow commands and completing the deferred response', async () => {
    const interaction = interactionPort();
    const handler = new CommandsHandler([command(async (context) => {
      await context.acknowledge();
      await context.reply('Done');
    })]);

    await handleChatInputCommand(interaction, handler);

    expect(interaction.deferReply).toHaveBeenCalledOnce();
    expect(interaction.editReply).toHaveBeenCalledExactlyOnceWith('Done');
  });

  it('replies ephemerally when execution fails before acknowledgement', async () => {
    const interaction = interactionPort();
    const handler = new CommandsHandler([command(async () => { throw new Error('private detail'); })]);

    await handleChatInputCommand(interaction, handler);

    expect(interaction.reply).toHaveBeenCalledExactlyOnceWith({
      content: 'Algo deu errado ao executar este comando.',
      flags: MessageFlags.Ephemeral,
    });
  });

  it('edits the deferred response when execution fails after acknowledgement', async () => {
    const interaction = interactionPort();
    const handler = new CommandsHandler([command(async (context) => {
      await context.acknowledge();
      throw new Error('private detail');
    })]);

    await handleChatInputCommand(interaction, handler);

    expect(interaction.editReply).toHaveBeenCalledExactlyOnceWith('Algo deu errado ao executar este comando.');
  });

  it('contains a failure while sending the safe error response', async () => {
    const interaction = interactionPort();
    interaction.reply = vi.fn().mockRejectedValue(new Error('Discord unavailable'));
    const handler = new CommandsHandler([command(async () => { throw new Error('private detail'); })]);

    await expect(handleChatInputCommand(interaction, handler)).resolves.toBeUndefined();
  });

  it('uses an ephemeral follow-up when execution fails after replying', async () => {
    const interaction = interactionPort();
    const handler = new CommandsHandler([command(async (context) => {
      await context.reply('All done');
      throw new Error('private detail');
    })]);

    await handleChatInputCommand(interaction, handler);
    expect(interaction.followUp).toHaveBeenCalledExactlyOnceWith({
      content: 'Algo deu errado ao executar este comando.', flags: MessageFlags.Ephemeral,
    });
  });
});
