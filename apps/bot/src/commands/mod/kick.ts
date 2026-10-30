import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { validateCommandAccess } from '#bot/command-system/access.js';
import type {
  ChatInputCommand,
  CommandAccess,
  CommandContext,
  CommandReply,
  GuildMemberProfile,
  MemberModerationPort,
} from '#bot/command-system/types.js';
import type { MessageKey } from '#bot/application/messages/catalog.js';
import { log } from '#bot/infrastructure/logging/logger.js';
import {
  MAX_REASON_LENGTH,
  auditReason,
  errorDetails,
  parsePrefixTarget,
  parseSlashTarget,
  publishConfirmation,
  type ModerationTargetArgs,
} from '#bot/infrastructure/discord/moderation/modUtils.js';

const { KickMembers } = PermissionFlagsBits;

const access: CommandAccess = {
  kind: 'guild',
  userPermissions: [KickMembers],
  botPermissions: [KickMembers],
  requireChannelSend: true,
  messages: {
    guildOnly: 'A expulsão só pode ser feita em um canal de texto de servidor.',
    userMissing: 'Você precisa da permissão **{permissions}** neste servidor.',
    botMissing: 'Preciso destas permissões para expulsar um membro: **{permissions}**.',
  },
};

export type KickArgs = ModerationTargetArgs;

export function parseKickPrefixArgs(rawArgs: string): KickArgs {
  return parsePrefixTarget(rawArgs);
}

async function say(context: CommandContext, key: MessageKey): Promise<void> {
  await context.reply(await context.render(key));
}

async function sayKickFailed(context: CommandContext): Promise<void> {
  await say(context, 'kick.failed');
}

async function reportKickFailure(context: CommandContext, targetId: string, error: unknown): Promise<void> {
  log('error', 'kick_failed', { guildId: context.guildId, targetId, ...errorDetails(error) });
  await sayKickFailed(context);
}

async function confirmation(
  context: CommandContext,
  target: GuildMemberProfile,
  moderator: GuildMemberProfile,
  reason: string | undefined,
): Promise<CommandReply> {
  const values = {
    target: target.displayName,
    'target.id': target.id,
    moderator: moderator.displayName,
    'moderator.id': moderator.id,
  };
  return reason === undefined
    ? context.render('kick.success_no_reason', values)
    : context.render('kick.success', { ...values, reason });
}

async function authorizeKick(
  context: CommandContext,
  guild: MemberModerationPort,
  actorId: string,
  target: GuildMemberProfile,
): Promise<GuildMemberProfile | undefined> {
  if (target.id === guild.ownerId) {
    await say(context, 'kick.owner');
    return undefined;
  }

  const actor = await guild.fetchMember(actorId);
  if (actor === null || guild.botUserId === null) {
    await sayKickFailed(context);
    return undefined;
  }
  if (actorId !== guild.ownerId && actor.highestRolePosition <= target.highestRolePosition) {
    await say(context, 'kick.role_above_actor');
    return undefined;
  }

  const bot = await guild.fetchMember(guild.botUserId);
  if (bot === null) {
    await sayKickFailed(context);
    return undefined;
  }
  if (target.id === bot.id) {
    await say(context, 'kick.bot_target');
    return undefined;
  }
  if (bot.highestRolePosition <= target.highestRolePosition) {
    await say(context, 'kick.bot_role_below');
    return undefined;
  }
  return actor;
}

async function execute(context: CommandContext): Promise<void> {
  await context.acknowledge();

  const accessError = await validateCommandAccess(access, context);
  if (accessError) { await context.reply(accessError); return; }

  const args = context.options ? parseSlashTarget(context.options) : parseKickPrefixArgs(context.rawArgs ?? '');
  if (!args.ok) {
    if (args.reason === 'missing') {
      await say(context, 'kick.missing_target');
      return;
    }
    if (args.reason === 'reason-too-long') {
      await say(context, 'kick.reason_too_long');
      return;
    }
    await say(context, 'kick.invalid_target');
    return;
  }

  const guild = context.memberModeration;
  const actorId = context.userId;
  if (guild === undefined || actorId === undefined) {
    await sayKickFailed(context);
    return;
  }
  if (args.userId === actorId) {
    await say(context, 'kick.self');
    return;
  }
  if (guild.botUserId !== null && args.userId === guild.botUserId) {
    await say(context, 'kick.bot_target');
    return;
  }

  let target: GuildMemberProfile | null;
  try {
    target = await guild.fetchMember(args.userId);
  } catch (error: unknown) {
    await reportKickFailure(context, args.userId, error);
    return;
  }
  if (target === null) {
    await say(context, 'kick.member_not_found');
    return;
  }

  let moderator: GuildMemberProfile | undefined;
  try {
    moderator = await authorizeKick(context, guild, actorId, target);
  } catch (error: unknown) {
    await reportKickFailure(context, args.userId, error);
    return;
  }
  if (moderator === undefined) return;

  let outcome: 'kicked' | 'missing';
  try {
    outcome = await guild.kick(args.userId, auditReason(actorId, args.reason));
  } catch (error: unknown) {
    await reportKickFailure(context, args.userId, error);
    return;
  }
  if (outcome === 'missing') {
    await say(context, 'kick.member_not_found');
    return;
  }

  await publishConfirmation(context, await confirmation(context, target, moderator, args.reason), 'kick_confirm_failed');
}

export const command = {
  data: new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Expulsa um membro do servidor')
    .setDefaultMemberPermissions(KickMembers)
    .addUserOption((option) =>
      option.setName('membro').setDescription('Membro que será expulso').setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName('motivo')
        .setDescription('Motivo da expulsão')
        .setMaxLength(MAX_REASON_LENGTH)
        .setRequired(false),
    ),
  access,
  scope: 'global' as const,
  execute,
} satisfies ChatInputCommand;
