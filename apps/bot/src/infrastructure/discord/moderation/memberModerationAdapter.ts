import { PermissionFlagsBits, type Guild } from 'discord.js';
import type { GuildMemberProfile, MemberModerationPort } from '#bot/command-system/types.js';

function hasDiscordCode(error: unknown, code: number): boolean {
  return error !== null && typeof error === 'object' && 'code' in error && error.code === code;
}

function isUnknownMember(error: unknown): boolean {
  return hasDiscordCode(error, 10007) || hasDiscordCode(error, 10013);
}

function profileOf(member: {
  id: string;
  displayName: string;
  roles: { highest: { position: number } };
  permissions: { has(permission: bigint): boolean };
  communicationDisabledUntilTimestamp: number | null;
}): GuildMemberProfile {
  const until = member.communicationDisabledUntilTimestamp;
  return {
    id: member.id,
    displayName: member.displayName,
    highestRolePosition: member.roles.highest.position,
    administrator: member.permissions.has(PermissionFlagsBits.Administrator),
    timedOutUntil: until !== null && until > Date.now() ? until : null,
  };
}

/** Live guild reads. A missing member is `null`; other failures propagate. */
export function createMemberModerationAdapter(guild: Guild): MemberModerationPort {
  return {
    get ownerId() {
      return guild.ownerId;
    },
    get botUserId() {
      return guild.members.me?.id ?? null;
    },
    async fetchMember(userId) {
      try {
        return profileOf(await guild.members.fetch(userId));
      } catch (error: unknown) {
        if (isUnknownMember(error)) return null;
        throw error;
      }
    },
    async kick(userId, reason) {
      try {
        const member = await guild.members.fetch(userId);
        await member.kick(reason);
        return 'kicked';
      } catch (error: unknown) {
        if (isUnknownMember(error)) return 'missing';
        throw error;
      }
    },
    async timeout(userId, durationMs, reason) {
      try {
        const member = await guild.members.fetch(userId);
        await member.timeout(durationMs, reason);
        return 'timed-out';
      } catch (error: unknown) {
        if (isUnknownMember(error)) return 'missing';
        throw error;
      }
    },
    async clearTimeout(userId, reason) {
      try {
        const member = await guild.members.fetch(userId);
        await member.timeout(null, reason);
        return 'cleared';
      } catch (error: unknown) {
        if (isUnknownMember(error)) return 'missing';
        throw error;
      }
    },
    async fetchUser(userId) {
      try {
        const user = await guild.client.users.fetch(userId);
        return { id: user.id, displayName: user.displayName };
      } catch (error: unknown) {
        if (hasDiscordCode(error, 10013)) return null;
        throw error;
      }
    },
    async fetchBan(userId) {
      try {
        const ban = await guild.bans.fetch(userId);
        return { id: ban.user.id, displayName: ban.user.displayName };
      } catch (error: unknown) {
        if (hasDiscordCode(error, 10026) || hasDiscordCode(error, 10013)) return null;
        throw error;
      }
    },
    /** `deleteMessageSeconds: 0` keeps the message history. Discord allows up to seven days. */
    async ban(userId, reason) {
      try {
        await guild.members.ban(userId, { deleteMessageSeconds: 0, reason });
        return 'banned';
      } catch (error: unknown) {
        if (hasDiscordCode(error, 10013)) return 'unknown-user';
        throw error;
      }
    },
    async unban(userId, reason) {
      try {
        await guild.members.unban(userId, reason);
        return 'unbanned';
      } catch (error: unknown) {
        if (hasDiscordCode(error, 10026) || hasDiscordCode(error, 10013)) return 'not-banned';
        throw error;
      }
    },
  };
}
