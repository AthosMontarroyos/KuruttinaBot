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
    commandName: 'example',
    id: 'interaction-id',
    get deferred() { return deferred; },
    get replied() { return replied; },
    deferReply: vi.fn(async () => { deferred = true; }),
    editReply: vi.fn(async () => undefined),
    followUp: vi.fn(async (_content: string | InteractionReplyOptions) => undefined),
    reply: vi.fn(async (_content: string | InteractionReplyOptions) => { replied = true; }),
  };
  return port;
}

function command(execute: ChatInputCommand['execute']): ChatInputCommand {
  return {
    data: new SlashCommandBuilder().setName('example').setDescription('Example'),
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
      content: 'Something went wrong while running this command.',
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

    expect(interaction.editReply).toHaveBeenCalledExactlyOnceWith('Something went wrong while running this command.');
  });

  it('contains a failure while sending the safe error response', async () => {
    const interaction = interactionPort();
    interaction.reply = vi.fn().mockRejectedValue(new Error('Discord unavailable'));
    const handler = new CommandsHandler([command(async () => { throw new Error('private detail'); })]);

    await expect(handleChatInputCommand(interaction, handler)).resolves.toBeUndefined();
  });
});
