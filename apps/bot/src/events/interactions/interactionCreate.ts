import { MessageFlags, type ChatInputCommandInteraction, type Interaction, type InteractionReplyOptions } from 'discord.js';
import type { CommandReply, CommandContext, HasPermission } from '#bot/commands/types.js';
import type { CommandsHandler } from '#bot/handlers/CommandsHandler.js';
import { createChannelContext, createEmojiResolver, type CommandClientPort } from '#bot/infrastructure/discord/commandContext.js';
import { log } from '#bot/infrastructure/logger.js';

const failureMessage = 'Algo deu errado ao executar este comando.';

export interface InteractionCommandPort {
  readonly client: CommandClientPort;
  readonly commandName: string;
  readonly createdTimestamp: number;
  /** Live state: reads from the real interaction every time. */
  readonly isDeferred: () => boolean;
  readonly isReplied: () => boolean;
  readonly id: string;
  readonly memberPermissions?: HasPermission | undefined;
  readonly appPermissions?: HasPermission | undefined;
  readonly channel?: ChatInputCommandInteraction['channel'];
  deferReply(options?: { flags?: number }): Promise<unknown>;
  deleteReply(): Promise<unknown>;
  editReply(content: CommandReply): Promise<unknown>;
  followUp(content: string | InteractionReplyOptions): Promise<unknown>;
  reply(content: string | InteractionReplyOptions): Promise<unknown>;
  /** Returns interaction options as a plain array. */
  optionsData(): NonNullable<CommandContext['options']>;
}

/** Adapt a real ChatInputCommandInteraction to the InteractionCommandPort interface. */
function adaptInteraction(interaction: ChatInputCommandInteraction): InteractionCommandPort {
  return {
    client: interaction.client,
    commandName: interaction.commandName,
    createdTimestamp: interaction.createdTimestamp,
    // Read live state from the real interaction — never copy.
    isDeferred: () => interaction.deferred,
    isReplied: () => interaction.replied,
    id: interaction.id,
    memberPermissions: interaction.memberPermissions ?? undefined,
    appPermissions: interaction.appPermissions ?? undefined,
    channel: interaction.channel,
    deferReply: (options) => interaction.deferReply(options),
    deleteReply: () => interaction.deleteReply(),
    editReply: (content) => interaction.editReply(content),
    followUp: (content) => interaction.followUp(content),
    reply: (content) => interaction.reply(content),
    optionsData: () => [...interaction.options.data],
  };
}

async function respondToFailure(interaction: InteractionCommandPort): Promise<void> {
  if (interaction.isDeferred()) {
    await interaction.editReply(failureMessage);
  } else if (interaction.isReplied()) {
    await interaction.followUp({ content: failureMessage, flags: MessageFlags.Ephemeral });
  } else {
    await interaction.reply({ content: failureMessage, flags: MessageFlags.Ephemeral });
  }
}

export async function handleInteractionCreate(interaction: Interaction, commandsHandler: CommandsHandler): Promise<void> {
  if (!interaction.isChatInputCommand()) return;

  await handleChatInputCommand(adaptInteraction(interaction), commandsHandler);
}

export async function handleChatInputCommand(
  interaction: InteractionCommandPort,
  commandsHandler: CommandsHandler,
): Promise<void> {
  try {
    const context: CommandContext = {
      ...createChannelContext(interaction.channel, interaction.memberPermissions, interaction.appPermissions),
      acknowledge: async () => {
        if (!interaction.isDeferred() && !interaction.isReplied()) await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      },
      apiPing: Math.max(0, Date.now() - interaction.createdTimestamp),
      gatewayPing: Math.max(0, Math.round(interaction.client.ws.ping)),
      emoji: createEmojiResolver(interaction.client.application),
      reply: async (content: CommandReply) => {
        if (interaction.isDeferred()) await interaction.editReply(content);
        else if (interaction.isReplied()) await interaction.followUp(content);
        else await interaction.reply(content);
      },
      deleteReply: async () => {
        if (interaction.isDeferred() || interaction.isReplied()) {
          await interaction.deleteReply();
        }
      },
      options: interaction.optionsData(),
    };

    await commandsHandler.execute(interaction.commandName, context);
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
