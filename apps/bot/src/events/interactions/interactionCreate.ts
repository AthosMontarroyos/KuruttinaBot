import { MessageFlags, type Interaction, type InteractionReplyOptions } from 'discord.js';
import type { CommandReply } from '#bot/commands/types.js';
import type { CommandsHandler } from '#bot/handlers/CommandsHandler.js';
import { log } from '#bot/infrastructure/logger.js';

const failureMessage = 'Something went wrong while running this command.';

export interface InteractionCommandPort {
  readonly client: {
    readonly application: { readonly emojis: { fetch(): Promise<{ find(predicate: (emoji: { name: string | null }) => boolean): { toString(): string } | undefined }> } };
    readonly ws: { readonly ping: number };
  };
  readonly commandName: string;
  readonly createdTimestamp: number;
  readonly deferred: boolean;
  readonly id: string;
  readonly replied: boolean;
  deferReply(): Promise<unknown>;
  editReply(content: CommandReply): Promise<unknown>;
  followUp(content: string | InteractionReplyOptions): Promise<unknown>;
  reply(content: string | InteractionReplyOptions): Promise<unknown>;
}

async function respondToFailure(interaction: InteractionCommandPort): Promise<void> {
  if (interaction.deferred) {
    await interaction.editReply(failureMessage);
  } else if (interaction.replied) {
    await interaction.followUp({ content: failureMessage, flags: MessageFlags.Ephemeral });
  } else {
    await interaction.reply({ content: failureMessage, flags: MessageFlags.Ephemeral });
  }
}

export async function handleInteractionCreate(interaction: Interaction, commandsHandler: CommandsHandler): Promise<void> {
  if (!interaction.isChatInputCommand()) return;

  await handleChatInputCommand(interaction, commandsHandler);
}

export async function handleChatInputCommand(
  interaction: InteractionCommandPort,
  commandsHandler: CommandsHandler,
): Promise<void> {
  let applicationEmojis: ReturnType<InteractionCommandPort['client']['application']['emojis']['fetch']> | undefined;

  try {
    await commandsHandler.execute(interaction.commandName, {
      acknowledge: async () => {
        if (!interaction.deferred && !interaction.replied) await interaction.deferReply();
      },
      apiPing: Math.max(0, Date.now() - interaction.createdTimestamp),
      gatewayPing: Math.max(0, Math.round(interaction.client.ws.ping)),
      emoji: async (name: string) => {
        const emojis = await (applicationEmojis ??= interaction.client.application.emojis.fetch());
        const emoji = emojis.find((candidate) => candidate.name === name);
        if (!emoji) throw new Error(`Application emoji unavailable: ${name}`);
        return emoji.toString();
      },
      reply: async (content: CommandReply) => {
        if (interaction.deferred) await interaction.editReply(content);
        else if (interaction.replied) await interaction.followUp(content);
        else await interaction.reply(content);
      },
    });
  } catch (error: unknown) {
    log('error', 'command_failed', {
      command: interaction.commandName,
      interactionId: interaction.id,
      errorName: error instanceof Error ? error.name : 'UnknownError',
    });

    try {
      await respondToFailure(interaction);
    } catch {
      log('error', 'command_failure_response_failed', {
        command: interaction.commandName,
        interactionId: interaction.id,
      });
    }
  }
}
