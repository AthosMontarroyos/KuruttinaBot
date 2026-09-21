import type { APIEmbed, RESTPostAPIApplicationCommandsJSONBody, SlashCommandBuilder } from 'discord.js';

export type CommandReply = string | {
  content: string;
  embeds: APIEmbed[];
};

export interface HasPermission {
  has(permission: bigint, checkAdmin?: boolean): boolean;
}

export type CommandMessage = Readonly<{ id: string; createdTimestamp: number; author: { readonly id: string } }>;

export interface CommandContext {
  readonly apiPing: number;
  readonly gatewayPing: number;
  acknowledge(): Promise<void>;
  emoji(name: string): Promise<string>;
  reply(content: CommandReply): Promise<void>;
  deleteReply?(): Promise<void>;

  // Optional properties for commands that need guild/channel context.
  readonly memberPermissions?: HasPermission | undefined;
  readonly appPermissions?: HasPermission | undefined;
  sendMessage?(content: string): Promise<unknown>;
  readonly guildId?: string | undefined;
  readonly textChannel?: BulkDeletePort | undefined;
  /** Slash command interaction options. */
  readonly options?: ReadonlyArray<{ readonly name: string; readonly value?: unknown }> | undefined;
  /** Raw arguments from prefix commands. */
  readonly rawArgs?: string | undefined;
  /** ID of the message that triggered the command (prefix only). Used to exclude it from deletion. */
  readonly commandMessageId?: string | undefined;
  /** Channel ID for logging. */
  readonly channelId?: string | undefined;
}

/** Port for message fetch and delete operations. */
export interface BulkDeletePort {
  readonly isThread: boolean;
  fetchMessages(options: {
    limit: number;
    before?: string | undefined;
  }): Promise<readonly CommandMessage[]>;
  bulkDelete(messages: ReadonlyArray<{ readonly id: string }>): Promise<number>;
  deleteMessage(messageId: string): Promise<boolean>;
}

export interface ChatInputCommand {
  readonly data: Pick<SlashCommandBuilder, 'name' | 'toJSON'>;
  execute(context: CommandContext): Promise<void>;
}

export type CommandPayload = RESTPostAPIApplicationCommandsJSONBody;
