import {
  ApplicationCommandOptionType,
  MessageFlags,
  SlashCommandBuilder,
  type Interaction,
  type InteractionReplyOptions,
} from 'discord.js';
import { describe, expect, it, vi } from 'vitest';
import type { EmojiAttachment } from '../apps/bot/src/application/emojis/types.js';
import type { ChatInputCommand } from '../apps/bot/src/command-system/types.js';
import {
  handleChatInputCommand,
  handleInteractionCreate,
  type InteractionCommandPort,
} from '../apps/bot/src/events/interactions/interactionCreate.js';
import { CommandsHandler } from '../apps/bot/src/command-system/CommandsHandler.js';

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
    attachments: [],
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

  it('acknowledges before querying emojis when execution fails early', async () => {
    const interaction = interactionPort();
    const fetch = vi.mocked(interaction.client.application.emojis.fetch);
    fetch.mockImplementation(async () => {
      expect(interaction.isDeferred()).toBe(true);
      return { find: () => undefined };
    });
    const handler = new CommandsHandler([command(async () => { throw new Error('private detail'); })]);

    await handleChatInputCommand(interaction, handler);

    expect(interaction.deferReply).toHaveBeenCalledExactlyOnceWith({ flags: MessageFlags.Ephemeral });
    expect(interaction.editReply).toHaveBeenCalledExactlyOnceWith('❌ Não consegui executar este comando. Tente de novo daqui a pouco.');
    expect(interaction.reply).not.toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledOnce();
  });

  it('edits the deferred response when execution fails after acknowledgement', async () => {
    const interaction = interactionPort();
    const handler = new CommandsHandler([command(async (context) => {
      await context.acknowledge();
      throw new Error('private detail');
    })]);

    await handleChatInputCommand(interaction, handler);

    expect(interaction.deferReply).toHaveBeenCalledOnce();
    expect(interaction.editReply).toHaveBeenCalledExactlyOnceWith('❌ Não consegui executar este comando. Tente de novo daqui a pouco.');
  });

  it('reuses the shared emoji lookup when reporting an unexpected failure', async () => {
    const interaction = interactionPort();
    vi.mocked(interaction.client.application.emojis.fetch).mockResolvedValue({
      find: (predicate: (emoji: { name: string | null }) => boolean) =>
        [
          { name: 'warning', toString: () => '<:warning:1>' },
          { name: 'error', toString: () => '<:error:2>' },
        ].find(predicate),
    });
    const handler = new CommandsHandler([command(async (context) => {
      await context.acknowledge();
      await context.emoji('warning');
      throw new Error('private detail');
    })]);

    await handleChatInputCommand(interaction, handler);

    expect(interaction.client.application.emojis.fetch).toHaveBeenCalledOnce();
    expect(interaction.editReply).toHaveBeenCalledExactlyOnceWith('<:error:2> Não consegui executar este comando. Tente de novo daqui a pouco.');
  });

  it('uses the error fallback when the emoji lookup fails during an unexpected error', async () => {
    const interaction = interactionPort();
    vi.mocked(interaction.client.application.emojis.fetch).mockRejectedValue(new Error('Unavailable'));
    const handler = new CommandsHandler([command(async () => { throw new Error('private detail'); })]);

    await handleChatInputCommand(interaction, handler);

    expect(interaction.client.application.emojis.fetch).toHaveBeenCalledOnce();
    expect(interaction.editReply).toHaveBeenCalledExactlyOnceWith('❌ Não consegui executar este comando. Tente de novo daqui a pouco.');
  });

  it('contains a failure while sending the safe error response', async () => {
    const interaction = interactionPort();
    interaction.editReply = vi.fn().mockRejectedValue(new Error('Discord unavailable'));
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
      content: '❌ Não consegui executar este comando. Tente de novo daqui a pouco.', flags: MessageFlags.Ephemeral,
    });
    expect(interaction.deferReply).not.toHaveBeenCalled();
  });

  it('copies the slash attachment content type into the command context', async () => {
    let seen: readonly EmojiAttachment[] | undefined;
    const handler = new CommandsHandler([command(async (context) => {
      seen = context.attachments;
    })]);
    const interaction = {
      isChatInputCommand: () => true,
      client: interactionPort().client,
      commandName: 'example',
      createdTimestamp: Date.now(),
      deferred: false,
      replied: false,
      id: 'interaction-id',
      user: { id: '666948364507545600' },
      memberPermissions: undefined,
      appPermissions: undefined,
      channel: null,
      deferReply: async () => undefined,
      deleteReply: async () => undefined,
      editReply: async () => undefined,
      followUp: async () => undefined,
      reply: async () => undefined,
      options: {
        data: [
          {
            name: 'arquivo',
            type: ApplicationCommandOptionType.Attachment,
            attachment: {
              url: 'https://cdn.discordapp.com/ephemeral-attachments/1/2/party_cat.png',
              name: 'party_cat.png',
              size: 2048,
              contentType: 'image/png',
            },
          },
        ],
      },
    } as unknown as Interaction;

    await handleInteractionCreate(interaction, handler);

    expect(seen).toEqual([
      {
        url: 'https://cdn.discordapp.com/ephemeral-attachments/1/2/party_cat.png',
        name: 'party_cat.png',
        size: 2048,
        contentType: 'image/png',
      },
    ]);
  });
});
