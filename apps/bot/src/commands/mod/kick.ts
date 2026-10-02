import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { validateCommandAccess } from '#bot/command-system/access.js';
import { withEmojis } from '#bot/command-system/responses.js';
import type {
  ChatInputCommand,
  CommandAccess,
  CommandContext,
  CommandReply,
  GuildMemberProfile,
  MemberModerationPort,
} from '#bot/command-system/types.js';
import { log } from '#bot/infrastructure/logging/logger.js';

const { KickMembers } = PermissionFlagsBits;

/** Discord audit-log reason limit is 512. The visible reason stays shorter. */
const MAX_REASON_LENGTH = 200;

const cannotKickBot = 'Ei! Você não pode me expulsar!!!';
const kickFailed = 'Não consegui expulsar esse membro. Tente de novo daqui a pouco.';
const memberMissing = 'Não encontrei esse membro neste servidor.';
const SNOWFLAKE = /^\d{17,20}$/u;
const MENTION = /^<@!?(\d{17,20})>$/u;

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

export type KickArgs =
  | { readonly ok: false; readonly reason: 'missing' | 'invalid-user' | 'reason-too-long' }
  | { readonly ok: true; readonly userId: string; readonly reason?: string };

export function parseKickPrefixArgs(rawArgs: string): KickArgs {
  const trimmed = rawArgs.trim();
  if (trimmed === '') return { ok: false, reason: 'missing' };
  const splitAt = trimmed.search(/\s/u);
  const head = splitAt === -1 ? trimmed : trimmed.slice(0, splitAt);
  const rest = splitAt === -1 ? '' : trimmed.slice(splitAt).trim();
  return parseTarget(mentionOrSnowflake(head), rest);
}

function parseSlashArgs(options: NonNullable<CommandContext['options']>): KickArgs {
  const userId = options.find((option) => option.name === 'membro')?.value;
  const reason = options.find((option) => option.name === 'motivo')?.value;
  if (reason !== undefined && typeof reason !== 'string') return { ok: false, reason: 'invalid-user' };
  return parseTarget(typeof userId === 'string' ? userId : undefined, typeof reason === 'string' ? reason.trim() : '');
}

function mentionOrSnowflake(token: string): string | undefined {
  return MENTION.exec(token)?.[1] ?? (SNOWFLAKE.test(token) ? token : undefined);
}

function parseTarget(userId: string | undefined, reason: string): KickArgs {
  if (userId === undefined || !SNOWFLAKE.test(userId)) return { ok: false, reason: 'invalid-user' };
  if (reason.length > MAX_REASON_LENGTH) return { ok: false, reason: 'reason-too-long' };
  return { ok: true, userId, ...(reason === '' ? {} : { reason }) };
}

function asCode(value: string, fallback: string): string {
  const cleaned = value.replaceAll('`', '').replace(/\s+/gu, ' ').trim().slice(0, MAX_REASON_LENGTH);
  return `\`${cleaned === '' ? fallback : cleaned}\``;
}

function auditReason(moderatorId: string, reason: string | undefined): string {
  const base = `Moderador ${moderatorId}`;
  if (reason === undefined) return base;
  return `${base}: ${reason.replace(/\s+/gu, ' ').trim()}`.slice(0, 512);
}

function errorDetails(error: unknown): { errorName: string; errorCode?: string | number } {
  const code = error !== null && typeof error === 'object' && 'code' in error ? error.code : undefined;
  return {
    errorName: error instanceof Error ? error.name : 'UnknownError',
    ...(typeof code === 'number' || (typeof code === 'string' && /^[A-Z0-9_]{1,64}$/u.test(code))
      ? { errorCode: code }
      : {}),
  };
}

async function say(context: CommandContext, emojiName: string, text: string): Promise<void> {
  await context.reply(withEmojis(await context.emoji(emojiName), text));
}

async function sayKickFailed(context: CommandContext): Promise<void> {
  await say(context, 'ops', kickFailed);
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
  const [done, ID, kick, staff, note] = await Promise.all([
    context.emoji('sucess'),
    context.emoji('kick'),
    context.emoji('staff'),
    context.emoji('Note'),
    context.emoji('ID'),
  ]);
  return {
    content: withEmojis(kick, `Pronto. ${asCode(target.displayName, 'Membro')} foi expulso deste servidor.`),
    embeds: [{
      color: 0x2b2d31,
      fields: [
        {
          name: withEmojis(ID, 'Membro'),
          value: `${asCode(target.displayName, 'Membro')}\n\`${target.id}\``,
          inline: true,
        },
        {
          name: withEmojis(staff, 'Responsável'),
          value: `${asCode(moderator.displayName, 'Moderador')}\n\`${moderator.id}\``,
          inline: true,
        },
        {
          name: withEmojis(note, 'Motivo'),
          value: reason === undefined ? 'Nenhum motivo informado.' : asCode(reason, 'Motivo'),
          inline: false,
        },
      ],
    }],
  };
}

async function publishConfirmation(context: CommandContext, message: CommandReply): Promise<void> {
  try {
    if (context.sendMessage) await context.sendMessage(message);
    else await context.reply(message);
  } catch (error: unknown) {
    log('error', 'kick_confirm_failed', { guildId: context.guildId, ...errorDetails(error) });
    try { await context.reply(message); } catch { /* A expulsão já concluiu. */ }
    return;
  }
  if (context.sendMessage && context.deleteReply) {
    try { await context.deleteReply(); } catch { /* O indicador efêmero pode expirar. */ }
  }
}

async function authorizeKick(
  context: CommandContext,
  guild: MemberModerationPort,
  actorId: string,
  target: GuildMemberProfile,
): Promise<GuildMemberProfile | undefined> {
  if (target.id === guild.ownerId) {
    await say(context, 'Disappointed', 'Não consigo expulsar o dono deste servidor.');
    return undefined;
  }

  const actor = await guild.fetchMember(actorId);
  if (actor === null || guild.botUserId === null) {
    await sayKickFailed(context);
    return undefined;
  }
  if (actorId !== guild.ownerId && actor.highestRolePosition <= target.highestRolePosition) {
    await say(context, 'Disappointed', 'O cargo desse membro está acima do seu ou no mesmo nível. Não consigo expulsá-lo.');
    return undefined;
  }

  const bot = await guild.fetchMember(guild.botUserId);
  if (bot === null) {
    await sayKickFailed(context);
    return undefined;
  }
  if (target.id === bot.id) {
    await say(context, 'Angry', cannotKickBot);
    return undefined;
  }
  if (bot.highestRolePosition <= target.highestRolePosition) {
    await say(context, 'Angry', 'Meu cargo está abaixo do cargo desse membro ou no mesmo nível. Não consigo expulsá-lo.');
    return undefined;
  }
  return actor;
}

async function execute(context: CommandContext): Promise<void> {
  await context.acknowledge();

  const accessError = await validateCommandAccess(access, context);
  if (accessError) { await context.reply(accessError); return; }

  const args = context.options ? parseSlashArgs(context.options) : parseKickPrefixArgs(context.rawArgs ?? '');
  if (!args.ok) {
    if (args.reason === 'missing') {
      await say(context, 'question', 'Diga quem expulsar. Mencione o membro ou digite o ID!');
      return;
    }
    if (args.reason === 'reason-too-long') {
      await say(context, 'warning', `O motivo pode ter no máximo **${MAX_REASON_LENGTH}** caracteres.`);
      return;
    }
    await say(context, 'search', 'Não consegui identificar esse membro. Mencione alguém ou informe um ID válido.');
    return;
  }

  const guild = context.memberModeration;
  const actorId = context.userId;
  if (guild === undefined || actorId === undefined) {
    await sayKickFailed(context);
    return;
  }
  if (args.userId === actorId) {
    await say(context, 'Disappointed', 'Você não pode se expulsar!!');
    return;
  }
  if (guild.botUserId !== null && args.userId === guild.botUserId) {
    await say(context, 'Angry', cannotKickBot);
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
    await say(context, 'search', memberMissing);
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
    await say(context, 'search', memberMissing);
    return;
  }

  await publishConfirmation(context, await confirmation(context, target, moderator, args.reason));
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
