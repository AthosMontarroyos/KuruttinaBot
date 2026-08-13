import { Guild, GuildPreview } from 'discord.js';
import { CommandContext } from '../../types/command-context';

export interface ResolveGuildOptions {
  /**
   * Fallback to the current server (ctx.guild) if no target server ID input is provided.
   * @default true
   */
  fallbackToCurrentGuild?: boolean;

  /**
   * Primary Slash Command option key for Guild/Server ID option.
   * @default 'servidor'
   */
  guildOptionName?: string;

  /**
   * Prefix command argument index to inspect for Server ID input.
   * @default 0
   */
  argIndex?: number;
}

export type ResolvableGuild = Guild | GuildPreview;

/**
 * Extracts a Discord snowflake ID (17-20 digits) from an input string or Guild object.
 */
export function extractGuildId(input?: string | ResolvableGuild | null): string | null {
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
 * Reusable utility component to automatically resolve a Discord Guild from snowflake IDs.
 * Searches bot cache, fetches from Discord API, or falls back to public Guild Preview.
 * Works seamlessly across both Slash Commands and Prefix Commands.
 */
export async function resolveGuild(
  ctx: CommandContext,
  input?: string | ResolvableGuild | null,
  options: ResolveGuildOptions = {}
): Promise<ResolvableGuild | null> {
  const {
    fallbackToCurrentGuild = true,
    guildOptionName = 'servidor',
    argIndex = 0,
  } = options;

  let targetId: string | null = null;
  let targetGuild: ResolvableGuild | null = null;

  // 1. Explicit input parameter
  if (input) {
    if (typeof input === 'object' && 'id' in input) {
      targetGuild = input;
      targetId = input.id;
    } else if (typeof input === 'string') {
      targetId = extractGuildId(input);
    }
  }

  // 2. Automatic context resolution (Slash or Prefix)
  if (!targetGuild && !targetId) {
    if (ctx.isSlash && ctx.slashInteraction) {
      const rawOption =
        ctx.slashInteraction.options.get(guildOptionName) ??
        ctx.slashInteraction.options.get('servidor') ??
        ctx.slashInteraction.options.get('guild') ??
        ctx.slashInteraction.options.get('server') ??
        ctx.slashInteraction.options.get('id');

      if (rawOption && typeof rawOption.value === 'string') {
        targetId = extractGuildId(rawOption.value);
      }
    } else {
      const arg = ctx.args[argIndex];
      if (arg) {
        targetId = extractGuildId(arg);
      }
    }
  }

  // 3. Fetch guild by ID if specified
  if (targetId) {
    // Check in cache
    const cachedGuild = ctx.client.guilds.cache.get(targetId);
    if (cachedGuild) {
      return cachedGuild;
    }

    // Try fetching full guild (if bot is in guild)
    try {
      targetGuild = await ctx.client.guilds.fetch(targetId);
      if (targetGuild) return targetGuild;
    } catch {
      // Not in guild or failed
    }

    // Try fetching public guild preview
    try {
      targetGuild = await ctx.client.fetchGuildPreview(targetId);
      if (targetGuild) return targetGuild;
    } catch {
      // Guild preview not available
    }

    return null;
  }

  // 4. Fallback to current guild if requested
  if (!targetGuild && fallbackToCurrentGuild && ctx.guild) {
    targetGuild = ctx.guild;
  }

  return targetGuild;
}
