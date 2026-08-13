import { Guild, GuildPreview, InviteGuild } from 'discord.js';
import { CommandContext } from '../../types/command-context';

export interface ResolveGuildOptions {
  /**
   * Fallback to the current server (ctx.guild) if no target server ID/invite input is provided.
   * @default true
   */
  fallbackToCurrentGuild?: boolean;

  /**
   * Primary Slash Command option key for Guild/Server ID/Invite option.
   * @default 'servidor'
   */
  guildOptionName?: string;

  /**
   * Prefix command argument index to inspect for Server ID/Invite input.
   * @default 0
   */
  argIndex?: number;
}

export type ResolvableGuild = Guild | GuildPreview | InviteGuild;

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
    const match = trimmed.match(/\b\d{17,20}\b/);
    return match ? match[0] : null;
  }

  return null;
}

/**
 * Extracts a Discord invite code from a URL or raw invite string.
 */
export function extractInviteCode(input?: string | null): string | null {
  if (!input || typeof input !== 'string') return null;

  const trimmed = input.trim();
  const inviteRegex = /(?:https?:\/\/)?(?:www\.)?(?:discord\.(?:gg|io|me|li)|discord(?:app)?\.com\/invite)\/([a-zA-Z0-9-]+)/i;
  const match = trimmed.match(inviteRegex);
  if (match && match[1]) {
    return match[1];
  }

  // If input looks like an invite code (alphanumeric, 2-32 chars, not purely numeric snowflake ID)
  if (/^[a-zA-Z0-9-]{2,32}$/.test(trimmed) && !/^\d{17,20}$/.test(trimmed)) {
    return trimmed;
  }

  return null;
}

/**
 * Reusable utility component to automatically resolve a Discord Guild from snowflake IDs or Invite links/codes.
 * Searches bot cache, fetches from Discord API, checks public Guild Preview, or resolves via Discord Invite.
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

  let rawInputValue: string | null = null;
  let targetId: string | null = null;
  let targetGuild: ResolvableGuild | null = null;

  // 1. Explicit input parameter
  if (input) {
    if (typeof input === 'object' && 'id' in input) {
      targetGuild = input;
      targetId = input.id;
    } else if (typeof input === 'string') {
      rawInputValue = input.trim();
      targetId = extractGuildId(rawInputValue);
    }
  }

  // 2. Automatic context resolution (Slash or Prefix)
  if (!targetGuild && !rawInputValue) {
    if (ctx.isSlash && ctx.slashInteraction) {
      const rawOption =
        ctx.slashInteraction.options.get(guildOptionName) ??
        ctx.slashInteraction.options.get('servidor') ??
        ctx.slashInteraction.options.get('guild') ??
        ctx.slashInteraction.options.get('server') ??
        ctx.slashInteraction.options.get('convite') ??
        ctx.slashInteraction.options.get('id');

      if (rawOption && typeof rawOption.value === 'string') {
        rawInputValue = rawOption.value.trim();
        targetId = extractGuildId(rawInputValue);
      }
    } else {
      const arg = ctx.args[argIndex];
      if (arg) {
        rawInputValue = arg.trim();
        targetId = extractGuildId(rawInputValue);
      }
    }
  }

  // 3. Fetch guild by Snowflake ID (if numeric ID detected)
  if (targetId) {
    // Check in local bot cache
    const cachedGuild = ctx.client.guilds.cache.get(targetId);
    if (cachedGuild) {
      return cachedGuild;
    }

    // Try fetching full guild (if bot is a member)
    try {
      targetGuild = await ctx.client.guilds.fetch(targetId);
      if (targetGuild) return targetGuild;
    } catch {
      // Bot is not in the guild or lacks access
    }

    // Try fetching public discoverable guild preview
    try {
      targetGuild = await ctx.client.fetchGuildPreview(targetId);
      if (targetGuild) return targetGuild;
    } catch {
      // Guild is not discoverable / public
    }
  }

  // 4. Try resolving via Discord Invite code/URL if rawInputValue was provided
  if (rawInputValue) {
    const inviteCode = extractInviteCode(rawInputValue);
    if (inviteCode) {
      try {
        const invite = await ctx.client.fetchInvite(inviteCode);
        if (invite.guild) {
          return invite.guild;
        }
      } catch {
        // Invalid or expired invite
      }
    }
  }

  // 5. Fallback to current guild if requested
  if (!targetGuild && fallbackToCurrentGuild && ctx.guild) {
    targetGuild = ctx.guild;
  }

  return targetGuild;
}
