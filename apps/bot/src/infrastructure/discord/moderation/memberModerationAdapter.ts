import type { Guild } from 'discord.js';
import type { GuildMemberProfile, MemberModerationPort } from '#bot/command-system/types.js';

function isUnknownMember(error: unknown): boolean {
  if (error === null || typeof error !== 'object' || !('code' in error)) return false;
  return error.code === 10007 || error.code === 10013;
}

function profileOf(member: { id: string; displayName: string; roles: { highest: { position: number } } }): GuildMemberProfile {
  return {
    id: member.id,
    displayName: member.displayName,
    highestRolePosition: member.roles.highest.position,
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
  };
}
