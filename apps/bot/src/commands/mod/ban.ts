import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { validateCommandAccess } from '#bot/command-system/access.js';
import type { MessageKey } from '#bot/application/messages/catalog.js';
import type {
  ChatInputCommand,
  CommandAccess,
  CommandContext,
  CommandReply,
  GuildMemberProfile,
  MemberModerationPort,
  ModeratedUserProfile,
} from '#bot/command-system/types.js';
import { log } from '#bot/infrastructure/logging/logger.js';
import {
  MAX_REASON_LENGTH,
  auditReason,
  authorizeMemberTarget,
  errorDetails,
  parsePrefixTarget,
  parseSlashTarget,
  publishConfirmation,
  type ModerationTargetArgs,
} from '#bot/infrastructure/discord/moderation/modUtils.js';

const { BanMembers } = PermissionFlagsBits;

const access: CommandAccess = {
  kind: 'guild',
  userPermissions: [BanMembers],
  botPermissions: [BanMembers],
  requireChannelSend: true,
  messages: {
    guildOnly: 'O banimento só pode ser feito em um canal de texto de servidor.',
    userMissing: 'Você precisa da permissão **{permissions}** neste servidor.',
    botMissing: 'Preciso destas permissões para banir um usuário: **{permissions}**.',
  },
};

export type BanArgs = ModerationTargetArgs;

export function parseBanPrefixArgs(rawArgs: string): BanArgs {
  return parsePrefixTarget(rawArgs);
}

async function say(context: CommandContext, key: MessageKey): Promise<void> {
  await context.reply(await context.render(key));
}

async function sayBanFailed(context: CommandContext): Promise<void> {
  await say(context, 'ban.failed');
}

async function reportBanFailure(context: CommandContext, targetId: string, error: unknown): Promise<void> {
  log('error', 'ban_failed', { guildId: context.guildId, targetId, ...errorDetails(error) });
  await sayBanFailed(context);
}

async function confirmation(
  context: CommandContext,
  target: ModeratedUserProfile,
  moderator: ModeratedUserProfile,
  reason: string | undefined,
): Promise<CommandReply> {
  return context.render(reason === undefined ? 'ban.success_no_reason' : 'ban.success', {
    target: target.displayName,
    'target.id': target.id,
    moderator: moderator.displayName,
    'moderator.id': moderator.id,
    ...(reason === undefined ? {} : { reason }),
  });
}


const banDenial = {
  owner: 'ban.owner',
  failed: 'ban.failed',
  roleAboveActor: 'ban.role_above_actor',
  botTarget: 'ban.bot_target',
  botRoleBelow: 'ban.bot_role_below',
} as const;

async function resolveBanTarget(
  context: CommandContext,
  guild: MemberModerationPort,
  actorId: string,
  userId: string,
  target: GuildMemberProfile | null,
): Promise<{ readonly subject: ModeratedUserProfile; readonly moderator: GuildMemberProfile } | undefined> {
  if (target !== null) {
    const moderator = await authorizeMemberTarget(context, guild, actorId, target, banDenial);
    return moderator === undefined ? undefined : { subject: target, moderator };
  }

  const actor = await guild.fetchMember(actorId);
  if (actor === null || guild.botUserId === null) {
    await sayBanFailed(context);
    return undefined;
  }
  if (await guild.fetchBan(userId) !== null) {
    await say(context, 'ban.already_banned');
    return undefined;
  }
  const user = await guild.fetchUser(userId);
  if (user === null) {
    await say(context, 'ban.user_not_found');
    return undefined;
  }

  const joined = await guild.fetchMember(userId);
  if (joined === null) return { subject: user, moderator: actor };
  const moderator = await authorizeMemberTarget(context, guild, actorId, joined, banDenial);
  return moderator === undefined ? undefined : { subject: joined, moderator };
}

async function execute(context: CommandContext): Promise<void> {
  await context.acknowledge();

  const accessError = await validateCommandAccess(access, context);
  if (accessError) { await context.reply(accessError); return; }

  const args = context.options ? parseSlashTarget(context.options) : parseBanPrefixArgs(context.rawArgs ?? '');
  if (!args.ok) {
    if (args.reason === 'missing') {
      await say(context, 'ban.missing_target');
      return;
    }
    if (args.reason === 'reason-too-long') {
      await say(context, 'ban.reason_too_long');
      return;
    }
    await say(context, 'ban.invalid_target');
    return;
  }

  const guild = context.memberModeration;
  const actorId = context.userId;
  if (guild === undefined || actorId === undefined) {
    await sayBanFailed(context);
    return;
  }
  if (args.userId === actorId) {
    await say(context, 'ban.self');
    return;
  }
  if (guild.botUserId !== null && args.userId === guild.botUserId) {
    await say(context, 'ban.bot_target');
    return;
  }

  let target: GuildMemberProfile | null;
  try {
    target = await guild.fetchMember(args.userId);
  } catch (error: unknown) {
    await reportBanFailure(context, args.userId, error);
    return;
  }

  let resolved: { readonly subject: ModeratedUserProfile; readonly moderator: GuildMemberProfile } | undefined;
  try {
    resolved = await resolveBanTarget(context, guild, actorId, args.userId, target);
  } catch (error: unknown) {
    await reportBanFailure(context, args.userId, error);
    return;
  }
  if (resolved === undefined) return;

  let outcome: 'banned' | 'unknown-user';
  try {
    outcome = await guild.ban(args.userId, auditReason(actorId, args.reason));
  } catch (error: unknown) {
    await reportBanFailure(context, args.userId, error);
    return;
  }
  if (outcome === 'unknown-user') {
    await say(context, 'ban.user_not_found');
    return;
  }

  await publishConfirmation(context, await confirmation(context, resolved.subject, resolved.moderator, args.reason), 'ban_confirm_failed');
}

export const command = {
  data: new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Bane um usuário do servidor')
    .setDefaultMemberPermissions(BanMembers)
    .addUserOption((option) =>
      option.setName('membro').setDescription('Usuário que será banido').setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName('motivo')
        .setDescription('Motivo do banimento')
        .setMaxLength(MAX_REASON_LENGTH)
        .setRequired(false),
    ),
  access,
  help: {
    topic: 'mod',
    examples: [
      { slash: '/ban membro:@Fulano motivo:Spam', prefix: 'k!ban @Fulano Spam' },
      { slash: '/ban membro:123456789012345678', prefix: 'k!ban 123456789012345678' },
    ],
  },
  scope: 'global' as const,
  execute,
} satisfies ChatInputCommand;
