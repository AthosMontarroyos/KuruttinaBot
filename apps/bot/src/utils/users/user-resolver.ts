import { User } from 'discord.js';
import { CommandContext } from '../../types/command-context';

export interface ResolveUserOptions {
  /**
   * Force fetch user data directly from Discord API (bypassing cache).
   * Useful when complete profile metadata like banner or accent color is needed.
   * @default false
   */
  forceFetch?: boolean;

  /**
   * Fallback to the command invoker (ctx.user) if no target user input is provided.
   * @default false
   */
  fallbackToAuthor?: boolean;

  /**
   * Primary Slash Command option key for User option.
   * @default 'usuario'
   */
  userOptionName?: string;

  /**
   * Primary Slash Command option key for String ID/Mention option.
   * @default 'id'
   */
  idOptionName?: string;

  /**
   * Prefix command argument index to inspect for User/ID/Mention input.
   * @default 0
   */
  argIndex?: number;
}

/**
 * Extracts a Discord snowflake ID (17-20 digits) from an input string (raw ID, mention `<@ID>`, or `<@!ID>`),
 * or directly returns the ID if a User object is provided.
 */
export function extractUserId(input?: string | User | null): string | null {
  if (!input) return null;

  if (typeof input === 'object' && 'id' in input && typeof input.id === 'string') {
    return input.id;
  }

  if (typeof input === 'string') {
    const trimmed = input.trim();
    const match = trimmed.match(/\d{17,20}/);
    return match ? match[0] : null;
  }

  return null;
}

/**
 * Reusable utility component to automatically resolve a Discord User from mentions (`<@123...>`) or raw IDs (`123...`).
 * Works seamlessly across both Slash Commands and Prefix Commands.
 */
export async function resolveUser(
  ctx: CommandContext,
  input?: string | User | null,
  options: ResolveUserOptions = {}
): Promise<User | null> {
  const {
    forceFetch = false,
    fallbackToAuthor = false,
    userOptionName = 'usuario',
    idOptionName = 'id',
    argIndex = 0,
  } = options;

  let targetId: string | null = null;
  let targetUser: User | null = null;

  // 1. Explicit input parameter passed directly to the function
  if (input) {
    if (typeof input === 'object' && 'id' in input) {
      targetUser = input;
      targetId = input.id;
    } else if (typeof input === 'string') {
      targetId = extractUserId(input);
    }
  }

  // 2. Automatic context resolution (Slash or Prefix) if explicit input was not provided
  if (!targetUser && !targetId) {
    if (ctx.isSlash && ctx.slashInteraction) {
      const rawOption =
        ctx.slashInteraction.options.get(userOptionName) ??
        ctx.slashInteraction.options.get(idOptionName) ??
        ctx.slashInteraction.options.get('usuario') ??
        ctx.slashInteraction.options.get('user') ??
        ctx.slashInteraction.options.get('target') ??
        ctx.slashInteraction.options.get('membro');

      if (rawOption) {
        if (rawOption.user) {
          targetUser = rawOption.user;
          targetId = rawOption.user.id;
        } else if (typeof rawOption.value === 'string') {
          targetId = extractUserId(rawOption.value);
        }
      }
    } else {
      // Prefix Command Argument parsing
      const arg = ctx.args[argIndex];
      if (arg) {
        targetId = extractUserId(arg);
      }
    }
  }

  // 3. Fetch user object if forceFetch is required or if only targetId was resolved
  if (targetId && (forceFetch || !targetUser)) {
    try {
      targetUser = await ctx.client.users.fetch(targetId, { force: forceFetch });
    } catch {
      targetUser = null;
    }
  }

  // 4. Fallback to command invoker if requested and no target user was resolved
  if (!targetUser && fallbackToAuthor) {
    targetUser = ctx.user;
  }

  return targetUser;
}
