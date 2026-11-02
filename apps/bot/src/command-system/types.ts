import type { StaffRole } from '@kuruttina/database';
import type { APIActionRowComponent, APIButtonComponent, APIEmbed, APIStringSelectComponent, RESTPostAPIApplicationCommandsJSONBody, SlashCommandBuilder } from 'discord.js';
import type { EmojiAttachment } from '#bot/application/emojis/types.js';
import type { MessageKey } from '#bot/application/messages/catalog.js';
import type { EmojiImportService } from '#bot/application/emojis/importEmoji.js';
import type { CatalogCommand, CommandExample, CommandTopic } from '@kuruttina/command-catalog';

export type { CommandExample, CommandTopic };

export type CommandReply = string | {
  content?: string;
  embeds: APIEmbed[];
  components?: readonly APIActionRowComponent<APIButtonComponent | APIStringSelectComponent>[];
};

export interface HasPermission {
  has(permission: bigint, checkAdmin?: boolean): boolean;
}

/**
 * Mandatory access policy of a command, validated centrally before `execute`.
 * `guild` requires effective channel permissions; absent or invalid policy
 * prevents the module from loading.
 */
export interface GuildAccessRequirements {
  readonly userPermissions: readonly bigint[];
  readonly botPermissions: readonly bigint[];
  readonly requireChannelSend?: boolean;
  readonly messages?: Partial<AccessDenialMessages>;
}
export type CommandAccess =
  | { readonly kind: 'public' }
  | ({ readonly kind: 'guild' } & GuildAccessRequirements)
  | ({ readonly kind: 'staff'; readonly minimumRole: StaffRole } & GuildAccessRequirements);
export interface StaffAccessPort {
  getStaffRole(userId: string, guildId: string): Promise<StaffRole | null>;
}

/** Denial copy of a guild command; `{permissions}` is replaced by the missing names. */
export interface AccessDenialMessages {
  readonly guildOnly: string;
  readonly userUnavailable: string;
  readonly userMissing: string;
  readonly botUnavailable: string;
  readonly botMissing: string;
}

export type CommandMessage = Readonly<{ id: string; createdTimestamp: number; author: { readonly id: string } }>;

/** Member data needed to authorize and describe a moderation action. */
export interface GuildMemberProfile {
  readonly id: string;
  readonly displayName: string;
  readonly highestRolePosition: number;
  /** Discord refuses timeouts for members with Administrator. */
  readonly administrator: boolean;
  /** Epoch milliseconds when the current timeout ends; null when the member is not timed out. */
  readonly timedOutUntil: number | null;
}

/** Account shown in a ban confirmation. Membership is not required. */
export interface ModeratedUserProfile {
  readonly id: string;
  readonly displayName: string;
}

/** Guild moderation operations shared by slash and prefix. Cache miss is not absence. */
export interface MemberModerationPort {
  readonly ownerId: string;
  readonly botUserId: string | null;
  fetchMember(userId: string): Promise<GuildMemberProfile | null>;
  kick(userId: string, reason: string): Promise<'kicked' | 'missing'>;
  /** `durationMs` is from 1 second through 28 days, Discord's timeout limit. */
  timeout(userId: string, durationMs: number, reason: string): Promise<'timed-out' | 'missing'>;
  clearTimeout(userId: string, reason: string): Promise<'cleared' | 'missing'>;
  /** An unknown account is `null`. Other failures propagate. */
  fetchUser(userId: string): Promise<ModeratedUserProfile | null>;
  /** A user who is not banned is `null`. Other failures propagate. */
  fetchBan(userId: string): Promise<ModeratedUserProfile | null>;
  /** Does not delete message history. `unknown-user` means Discord has no such account. */
  ban(userId: string, reason: string): Promise<'banned' | 'unknown-user'>;
  unban(userId: string, reason: string): Promise<'unbanned' | 'not-banned'>;
}

export interface CommandContext {
  /** Trusted Discord author identity; missing identity always denies staff access. */
  readonly userId?: string | undefined;
  readonly apiPing: number;
  readonly gatewayPing: number;
  acknowledge(): Promise<void>;
  emoji(name: string): Promise<string>;
  /** Renderiza uma fala do catálogo, com emojis resolvidos e variáveis escapadas. */
  render: (key: MessageKey, values?: Readonly<Record<string, string>>) => Promise<CommandReply>;
  reply(content: CommandReply): Promise<void>;
  deleteReply?(): Promise<void>;

  // Optional properties for commands that need guild/channel context.
  readonly memberPermissions?: HasPermission | undefined;
  readonly appPermissions?: HasPermission | undefined;
  sendMessage?(content: CommandReply): Promise<unknown>;
  readonly guildId?: string | undefined;
  readonly textChannel?: BulkDeletePort | undefined;
  /** Kick, timeout, ban and their reversals; absent outside a guild text channel. */
  readonly memberModeration?: MemberModerationPort | undefined;
  /** Slash command interaction options. */
  readonly options?: ReadonlyArray<{ readonly name: string; readonly value?: unknown }> | undefined;
  /** Raw arguments from prefix commands. */
  readonly rawArgs?: string | undefined;
  /** ID of the message that triggered the command (prefix only). Used to exclude it from deletion. */
  readonly commandMessageId?: string | undefined;
  /** Channel ID for logging. */
  readonly channelId?: string | undefined;
  /** Files attached to the invoking message or to the slash attachment option. */
  readonly attachments?: readonly EmojiAttachment[] | undefined;
  /** Shared import pipeline (queue, limits, Discord adapter) injected by the dispatcher. */
  readonly emojiImport?: EmojiImportService | undefined;
  /**
   * Dispara o workflow de Application Emoji de produção.
   * Ausente quando `GITHUB_WORKFLOW_TOKEN` não está configurado.
   */
  readonly productionEmojiDispatch?: ProductionEmojiDispatchPort | undefined;
  /** Guild emoji lookup injected by the dispatcher. */
  readonly emojiInfo?: EmojiInfoPort | undefined;
  /** Public command list built from the registered modules and injected by the dispatcher, for `/help`. */
  readonly commandCatalog?: readonly CatalogCommand[] | undefined;
}

/** Narrow GitHub capability: `workflow_dispatch` of `emoji-prod.yml` on `main`. */
export interface ProductionEmojiDispatchPort {
  request(input: { readonly name: string; readonly source: string }): Promise<{ readonly runsUrl: string }>;
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

/**
 * Executable route of a subcommand. Slash addresses it by `path` below the
 * root command; prefix messages address it by one exact `alias`.
 */
export interface CommandRoute {
  /** Slash path below the root, e.g. `['emoji', 'add']`. Never empty. */
  readonly path: readonly string[];
  /** Exact prefix aliases, e.g. `['emoji-add']`. Never empty. */
  readonly aliases: readonly string[];
  /**
   * Usage examples, required and never empty. Each one shows the slash form
   * (`/emoji add ...`) and the prefix form (`k!emoji-add ...`).
   */
  readonly examples: readonly CommandExample[];
  /**
   * Extra guild requirements for this route. They are added to the root
   * policy and cannot replace or weaken it.
   */
  readonly access?: GuildAccessRequirements;
  execute(context: CommandContext): Promise<void>;
}

/** Result of a guild emoji lookup. A cache miss is not proof that the emoji was deleted. */
export type EmojiInfoLookup =
  | {
      readonly status: 'confirmed';
      readonly name: string | null;
      readonly animated: boolean | null;
      readonly guildName: string;
    }
  | { readonly status: 'unconfirmed' }
  | { readonly status: 'unavailable' };

/** Discord lookup injected by the dispatcher. Both transports share the same port. */
export interface EmojiInfoPort {
  lookup(currentGuildId: string, emojiId: string): Promise<EmojiInfoLookup>;
}

/**
 * Publishing scope of a command. `global` goes only to the global deployment;
 * `dev-guild` goes only to each development guild registered in the database
 * (`bot_dev_guilds`), never to the global set. An empty registration publishes
 * nothing for that scope.
 */
export type CommandScope = 'global' | 'dev-guild';

/**
 * Mandatory documentation of a command, read by `/help`, the site and the
 * generated catalog. The description comes from the slash builder, and the
 * prefix form (`k!<name>`, or `k!<alias>` for a route) exists for every
 * command, so it is shown rather than configured.
 */
export interface CommandHelp {
  /**
   * Display topic. `mod/` requires `mod`, `dev/` requires `dev`, and `public/`
   * takes `public`, `fun` or `utility`.
   */
  readonly topic: CommandTopic;
  /**
   * Usage examples of the root executor: required and never empty without
   * `routes`, and forbidden with `routes` (each route has its own).
   */
  readonly examples?: readonly CommandExample[];
}

export interface ChatInputCommand {
  readonly data: Pick<SlashCommandBuilder, 'name' | 'toJSON'>;
  /** Required even for open commands, so intent is always explicit. */
  readonly access: CommandAccess;
  /** Required topic and usage examples; the loader rejects a module without them. */
  readonly help: CommandHelp;
  /**
   * Publishing scope. It must agree with the policy and with the category,
   * the first path segment under the catalog root: `public/` is `public` and
   * `global`, `mod/` is `guild` and `global`, and `dev/` (at any depth) is
   * `staff` and `dev-guild`. The loader rejects any divergence.
   */
  readonly scope: CommandScope;
  /** Root executor; required exactly when `routes` is absent. */
  execute?(context: CommandContext): Promise<void>;
  /** Subcommand routes; when present they replace the root executor. */
  readonly routes?: readonly CommandRoute[];
}

export type CommandPayload = RESTPostAPIApplicationCommandsJSONBody;
