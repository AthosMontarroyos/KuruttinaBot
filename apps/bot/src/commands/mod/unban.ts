import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { validateCommandAccess } from '#bot/command-system/access.js';
import type { MessageKey } from '#bot/application/messages/catalog.js';
import type {
  ChatInputCommand,
  CommandAccess,
  CommandContext,
  CommandReply,
  GuildMemberProfile,
  ModeratedUserProfile,
} from '#bot/command-system/types.js';
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

const { BanMembers } = PermissionFlagsBits;

const access: CommandAccess = {
  kind: 'guild',
  userPermissions: [BanMembers],
  botPermissions: [BanMembers],
  requireChannelSend: true,
  messages: {
    guildOnly: 'A revogação do banimento só pode ser feita em um canal de texto de servidor.',
    userMissing: 'Você precisa da permissão **{permissions}** neste servidor.',
    botMissing: 'Preciso destas permissões para revogar um banimento: **{permissions}**.',
  },
};

export type UnbanArgs = ModerationTargetArgs;

export function parseUnbanPrefixArgs(rawArgs: string): UnbanArgs {
  return parsePrefixTarget(rawArgs);
}

async function say(context: CommandContext, key: MessageKey): Promise<void> {
  await context.reply(await context.render(key));
}

async function sayUnbanFailed(context: CommandContext): Promise<void> {
  await say(context, 'unban.failed');
}

async function reportUnbanFailure(context: CommandContext, targetId: string, error: unknown): Promise<void> {
  log('error', 'unban_failed', { guildId: context.guildId, targetId, ...errorDetails(error) });
  await sayUnbanFailed(context);
}

async function confirmation(
  context: CommandContext,
  target: ModeratedUserProfile,
  moderator: ModeratedUserProfile,
  reason: string | undefined,
): Promise<CommandReply> {
  return context.render(reason === undefined ? 'unban.success_no_reason' : 'unban.success', {
    target: target.displayName,
    'target.id': target.id,
    moderator: moderator.displayName,
    'moderator.id': moderator.id,
    ...(reason === undefined ? {} : { reason }),
  });
}


async function execute(context: CommandContext): Promise<void> {
  await context.acknowledge();

  const accessError = await validateCommandAccess(access, context);
  if (accessError) { await context.reply(accessError); return; }

  const args = context.options ? parseSlashTarget(context.options) : parseUnbanPrefixArgs(context.rawArgs ?? '');
  if (!args.ok) {
    if (args.reason === 'missing') {
      await say(context, 'unban.missing_target');
      return;
    }
    if (args.reason === 'reason-too-long') {
      await say(context, 'unban.reason_too_long');
      return;
    }
    await say(context, 'unban.invalid_target');
    return;
  }

  const guild = context.memberModeration;
  const actorId = context.userId;
  if (guild === undefined || actorId === undefined) {
    await sayUnbanFailed(context);
    return;
  }
  if (args.userId === actorId) {
    await say(context, 'unban.self');
    return;
  }
  if (guild.botUserId !== null && args.userId === guild.botUserId) {
    await say(context, 'unban.bot_target');
    return;
  }

  let banned: ModeratedUserProfile | null;
  let moderator: GuildMemberProfile | null;
  try {
    banned = await guild.fetchBan(args.userId);
    moderator = banned === null ? null : await guild.fetchMember(actorId);
  } catch (error: unknown) {
    await reportUnbanFailure(context, args.userId, error);
    return;
  }
  if (banned === null) {
    await say(context, 'unban.not_banned');
    return;
  }
  if (moderator === null) {
    await sayUnbanFailed(context);
    return;
  }

  let outcome: 'unbanned' | 'not-banned';
  try {
    outcome = await guild.unban(args.userId, auditReason(actorId, args.reason));
  } catch (error: unknown) {
    await reportUnbanFailure(context, args.userId, error);
    return;
  }
  if (outcome === 'not-banned') {
    await say(context, 'unban.not_banned');
    return;
  }

  await publishConfirmation(context, await confirmation(context, banned, moderator, args.reason), 'unban_confirm_failed');
}

export const command = {
  data: new SlashCommandBuilder()
    .setName('unban')
    .setDescription('Revoga o banimento de um usuário')
    .setDefaultMemberPermissions(BanMembers)
    .addUserOption((option) =>
      option.setName('membro').setDescription('Usuário que terá o banimento revogado').setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName('motivo')
        .setDescription('Motivo da revogação')
        .setMaxLength(MAX_REASON_LENGTH)
        .setRequired(false),
    ),
  access,
  help: {
    topic: 'mod',
    examples: [
      { slash: '/unban membro:123456789012345678 motivo:Apelo aceito', prefix: 'k!unban 123456789012345678 Apelo aceito' },
    ],
  },
  scope: 'global' as const,
  execute,
} satisfies ChatInputCommand;
