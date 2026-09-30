import {
  ApplicationCommandOptionType,
  MessageFlags,
  type Attachment,
  type ChatInputCommandInteraction,
  type CommandInteractionOption,
  type Interaction,
  type InteractionReplyOptions,
} from 'discord.js';
import type { EmojiAttachment } from '#bot/application/emojis/types.js';
import { withEmojis } from '#bot/commands/access.js';
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
  readonly userId: string;
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
  /** Slash route below the root command, e.g. `['emoji', 'add']`. */
  readonly routePath: readonly string[];
  /** Attachments resolved from the selected subcommand's options. */
  readonly attachments: readonly EmojiAttachment[];
}

/**
 * Hoists the selected subcommand (and group) exactly like discord.js does, so
 * the dispatcher receives the route and only the leaf options of that route.
 */
function splitRoute(options: readonly CommandInteractionOption[]): {
  path: string[];
  leaf: CommandInteractionOption[];
} {
  const path: string[] = [];
  let leaf = [...options];
  for (;;) {
    const [first] = leaf;
    if (
      first === undefined ||
      (first.type !== ApplicationCommandOptionType.SubcommandGroup &&
        first.type !== ApplicationCommandOptionType.Subcommand)
    ) break;
    path.push(first.name);
    leaf = [...(first.options ?? [])];
  }
  return { path, leaf };
}

function toEmojiAttachment(attachment: Attachment): EmojiAttachment {
  return {
    url: attachment.url,
    name: attachment.name,
    size: attachment.size,
    contentType: attachment.contentType,
  };
}

/** Adapt a real ChatInputCommandInteraction to the InteractionCommandPort interface. */
function adaptInteraction(interaction: ChatInputCommandInteraction): InteractionCommandPort {
  const { path, leaf } = splitRoute(interaction.options.data);
  return {
    client: interaction.client,
    commandName: interaction.commandName,
    createdTimestamp: interaction.createdTimestamp,
    // Read live state from the real interaction — never copy.
    isDeferred: () => interaction.deferred,
    isReplied: () => interaction.replied,
    id: interaction.id,
    userId: interaction.user.id,
    memberPermissions: interaction.memberPermissions ?? undefined,
    appPermissions: interaction.appPermissions ?? undefined,
    channel: interaction.channel,
    deferReply: (options) => interaction.deferReply(options),
    deleteReply: () => interaction.deleteReply(),
    editReply: (content) => interaction.editReply(content),
    followUp: (content) => interaction.followUp(content),
    reply: (content) => interaction.reply(content),
    routePath: path,
    attachments: leaf.flatMap((option) => (option.attachment ? [toEmojiAttachment(option.attachment)] : [])),
    optionsData: () => leaf.map((option) => ({ name: option.name, value: option.value })),
  };
}

async function respondToFailure(
  interaction: InteractionCommandPort,
  emoji: CommandContext['emoji'],
): Promise<void> {
  // A consulta de emoji pode esperar a API; reconhece antes se a interação ainda está aberta.
  if (!interaction.isDeferred() && !interaction.isReplied()) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  }
  const content = withEmojis(await emoji('error'), failureMessage);
  if (interaction.isDeferred()) {
    await interaction.editReply(content);
  } else if (interaction.isReplied()) {
    await interaction.followUp({ content, flags: MessageFlags.Ephemeral });
  } else {
    await interaction.reply({ content, flags: MessageFlags.Ephemeral });
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
  const emoji = createEmojiResolver(interaction.client.application);
  try {
    const context: CommandContext = {
      userId: interaction.userId,
      ...createChannelContext(interaction.channel, interaction.memberPermissions, interaction.appPermissions),
      attachments: interaction.attachments,
      acknowledge: async () => {
        if (!interaction.isDeferred() && !interaction.isReplied()) await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      },
      apiPing: Math.max(0, Date.now() - interaction.createdTimestamp),
      gatewayPing: Math.max(0, Math.round(interaction.client.ws.ping)),
      emoji,
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

    await commandsHandler.execute(interaction.commandName, context, interaction.routePath);
  } catch (error: unknown) {
    log('error', 'command_failed', {
      command: interaction.commandName,
      interactionId: interaction.id,
      errorName: error instanceof Error ? error.name : 'UnknownError',
    });

    try {
      await respondToFailure(interaction, emoji);
    } catch {
      log('error', 'command_failure_response_failed', {
        command: interaction.commandName,
        interactionId: interaction.id,
      });
    }
  }
}
