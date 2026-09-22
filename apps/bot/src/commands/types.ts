import type { APIEmbed, RESTPostAPIApplicationCommandsJSONBody, SlashCommandBuilder } from 'discord.js';

export type CommandReply = string | {
  content: string;
  embeds: APIEmbed[];
};

export interface HasPermission {
  has(permission: bigint, checkAdmin?: boolean): boolean;
}

/**
 * Mandatory access policy of a command, validated centrally before `execute`.
 * `guild` requires effective channel permissions; absent or invalid policy
 * prevents the module from loading.
 */
export type CommandAccess =
  | { readonly kind: 'public' }
  | {
      readonly kind: 'guild';
      /** Permissions the invoking member must have in this channel. */
      readonly userPermissions: readonly bigint[];
      /** Permissions the bot must have in this channel. */
      readonly botPermissions: readonly bigint[];
      /** Additionally requires SendMessages or SendMessagesInThreads per channel kind. */
      readonly requireChannelSend?: boolean;
      /** Optional command-flavored denial copy overriding the generic defaults. */
      readonly messages?: Partial<AccessDenialMessages>;
    };

/** Denial copy of a guild command; `{permissions}` is replaced by the missing names. */
export interface AccessDenialMessages {
  readonly guildOnly: string;
  readonly userUnavailable: string;
  readonly userMissing: string;
  readonly botUnavailable: string;
  readonly botMissing: string;
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
  /** Required even for open commands, so intent is always explicit. */
  readonly access: CommandAccess;
  execute(context: CommandContext): Promise<void>;
}

export type CommandPayload = RESTPostAPIApplicationCommandsJSONBody;
