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

const { ModerateMembers } = PermissionFlagsBits;

const access: CommandAccess = {
  kind: 'guild',
  userPermissions: [ModerateMembers],
  botPermissions: [ModerateMembers],
  requireChannelSend: true,
  messages: {
    guildOnly: 'A remoção do castigo só pode ser feita em um canal de texto de servidor.',
    userMissing: 'Você precisa da permissão **{permissions}** neste servidor.',
    botMissing: 'Preciso destas permissões para remover um castigo: **{permissions}**.',
  },
};

export type UntimeoutArgs = ModerationTargetArgs;

export function parseUntimeoutPrefixArgs(rawArgs: string): UntimeoutArgs {
  return parsePrefixTarget(rawArgs);
}

async function say(context: CommandContext, key: MessageKey): Promise<void> {
  await context.reply(await context.render(key));
}

async function sayClearFailed(context: CommandContext): Promise<void> {
  await say(context, 'untimeout.failed');
}

async function reportClearFailure(context: CommandContext, targetId: string, error: unknown): Promise<void> {
  log('error', 'untimeout_failed', { guildId: context.guildId, targetId, ...errorDetails(error) });
  await sayClearFailed(context);
}

async function confirmation(
  context: CommandContext,
  target: GuildMemberProfile,
  moderator: GuildMemberProfile,
  reason: string | undefined,
): Promise<CommandReply> {
  return context.render(reason === undefined ? 'untimeout.success_no_reason' : 'untimeout.success', {
    target: target.displayName,
    'target.id': target.id,
    moderator: moderator.displayName,
    'moderator.id': moderator.id,
    ...(reason === undefined ? {} : { reason }),
  });
}


async function authorizeClear(
  context: CommandContext,
  guild: MemberModerationPort,
  actorId: string,
  target: GuildMemberProfile,
): Promise<GuildMemberProfile | undefined> {
  if (target.id === guild.ownerId) {
    await say(context, 'untimeout.owner');
    return undefined;
  }

  const actor = await guild.fetchMember(actorId);
  if (actor === null || guild.botUserId === null) {
    await sayClearFailed(context);
    return undefined;
  }
  if (actorId !== guild.ownerId && actor.highestRolePosition <= target.highestRolePosition) {
    await say(context, 'untimeout.role_above_actor');
    return undefined;
  }

  const bot = await guild.fetchMember(guild.botUserId);
  if (bot === null) {
    await sayClearFailed(context);
    return undefined;
  }
  if (target.id === bot.id) {
    await say(context, 'untimeout.bot_target');
    return undefined;
  }
  if (bot.highestRolePosition <= target.highestRolePosition) {
    await say(context, 'untimeout.bot_role_below');
    return undefined;
  }
  if (target.administrator) {
    await say(context, 'untimeout.administrator');
    return undefined;
  }
  return actor;
}

async function execute(context: CommandContext): Promise<void> {
  await context.acknowledge();

  const accessError = await validateCommandAccess(access, context);
  if (accessError) { await context.reply(accessError); return; }

  const args = context.options ? parseSlashTarget(context.options) : parseUntimeoutPrefixArgs(context.rawArgs ?? '');
  if (!args.ok) {
    if (args.reason === 'missing') {
      await say(context, 'untimeout.missing_target');
      return;
    }
    if (args.reason === 'reason-too-long') {
      await say(context, 'untimeout.reason_too_long');
      return;
    }
    await say(context, 'untimeout.invalid_target');
    return;
  }

  const guild = context.memberModeration;
  const actorId = context.userId;
  if (guild === undefined || actorId === undefined) {
    await sayClearFailed(context);
    return;
  }
  if (args.userId === actorId) {
    await say(context, 'untimeout.self');
    return;
  }
  if (guild.botUserId !== null && args.userId === guild.botUserId) {
    await say(context, 'untimeout.bot_target');
    return;
  }

  let target: GuildMemberProfile | null;
  try {
    target = await guild.fetchMember(args.userId);
  } catch (error: unknown) {
    await reportClearFailure(context, args.userId, error);
    return;
  }
  if (target === null) {
    await say(context, 'untimeout.member_not_found');
    return;
  }

  let moderator: GuildMemberProfile | undefined;
  try {
    moderator = await authorizeClear(context, guild, actorId, target);
  } catch (error: unknown) {
    await reportClearFailure(context, args.userId, error);
    return;
  }
  if (moderator === undefined) return;
  if (target.timedOutUntil === null) {
    await say(context, 'untimeout.not_timed_out');
    return;
  }

  let outcome: 'cleared' | 'missing';
  try {
    outcome = await guild.clearTimeout(args.userId, auditReason(actorId, args.reason));
  } catch (error: unknown) {
    await reportClearFailure(context, args.userId, error);
    return;
  }
  if (outcome === 'missing') {
    await say(context, 'untimeout.member_not_found');
    return;
  }

  await publishConfirmation(context, await confirmation(context, target, moderator, args.reason), 'untimeout_confirm_failed');
}

export const command = {
  data: new SlashCommandBuilder()
    .setName('untimeout')
    .setDescription('Remove o castigo de um membro')
    .setDefaultMemberPermissions(ModerateMembers)
    .addUserOption((option) =>
      option.setName('membro').setDescription('Membro que terá o castigo removido').setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName('motivo')
        .setDescription('Motivo da remoção')
        .setMaxLength(MAX_REASON_LENGTH)
        .setRequired(false),
    ),
  access,
  scope: 'global' as const,
  execute,
} satisfies ChatInputCommand;
