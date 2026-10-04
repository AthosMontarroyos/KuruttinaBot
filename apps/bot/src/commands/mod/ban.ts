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
  ModeratedUserProfile,
} from '#bot/command-system/types.js';
import { log } from '#bot/infrastructure/logging/logger.js';

const { BanMembers } = PermissionFlagsBits;

/** Discord audit-log reason limit is 512. The visible reason stays shorter. */
const MAX_REASON_LENGTH = 200;

const cannotBanBot = 'Ei! Porque você estar tentando banir?';
const banFailed = 'Não consegui banir esse usuário. Tente de novo daqui a pouco.';
const userMissing = 'Não encontrei esse usuário.';
const alreadyBanned = 'Esse usuário já está banido.';
const SNOWFLAKE = /^\d{17,20}$/u;
const MENTION = /^<@!?(\d{17,20})>$/u;

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

export type BanArgs =
  | { readonly ok: false; readonly reason: 'missing' | 'invalid-user' | 'reason-too-long' }
  | { readonly ok: true; readonly userId: string; readonly reason?: string };

export function parseBanPrefixArgs(rawArgs: string): BanArgs {
  const trimmed = rawArgs.trim();
  if (trimmed === '') return { ok: false, reason: 'missing' };
  const splitAt = trimmed.search(/\s/u);
  const head = splitAt === -1 ? trimmed : trimmed.slice(0, splitAt);
  const rest = splitAt === -1 ? '' : trimmed.slice(splitAt).trim();
  return parseTarget(mentionOrSnowflake(head), rest);
}

function parseSlashArgs(options: NonNullable<CommandContext['options']>): BanArgs {
  const userId = options.find((option) => option.name === 'membro')?.value;
  const reason = options.find((option) => option.name === 'motivo')?.value;
  if (reason !== undefined && typeof reason !== 'string') return { ok: false, reason: 'invalid-user' };
  return parseTarget(typeof userId === 'string' ? userId : undefined, typeof reason === 'string' ? reason.trim() : '');
}

function mentionOrSnowflake(token: string): string | undefined {
  return MENTION.exec(token)?.[1] ?? (SNOWFLAKE.test(token) ? token : undefined);
}

function parseTarget(userId: string | undefined, reason: string): BanArgs {
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

async function sayBanFailed(context: CommandContext): Promise<void> {
  await say(context, 'ops', banFailed);
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
  const [ban, identity, staff, note, coffee] = await Promise.all([
    context.emoji('ban'),
    context.emoji('ID'),
    context.emoji('staff'),
    context.emoji('Note'),
    context.emoji('coffee'),
  ]);
  return {
    content: withEmojis(ban, `Pronto. ${asCode(target.displayName, 'Usuário')} foi banido deste servidor.`, coffee),
    embeds: [{
      color: 0x2b2d31,
      fields: [
        {
          name: withEmojis(identity, 'Usuário'),
          value: `${asCode(target.displayName, 'Usuário')}\n\`${target.id}\``,
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
    log('error', 'ban_confirm_failed', { guildId: context.guildId, ...errorDetails(error) });
    try { await context.reply(message); } catch { /* O banimento já concluiu. */ }
    return;
  }
  if (context.sendMessage && context.deleteReply) {
    try { await context.deleteReply(); } catch { /* O indicador efêmero pode expirar. */ }
  }
}

async function authorizeBan(
  context: CommandContext,
  guild: MemberModerationPort,
  actorId: string,
  target: GuildMemberProfile,
): Promise<GuildMemberProfile | undefined> {
  if (target.id === guild.ownerId) {
    await say(context, 'Disappointed', 'Não consigo banir o dono deste servidor.');
    return undefined;
  }

  const actor = await guild.fetchMember(actorId);
  if (actor === null || guild.botUserId === null) {
    await sayBanFailed(context);
    return undefined;
  }
  if (actorId !== guild.ownerId && actor.highestRolePosition <= target.highestRolePosition) {
    await say(context, 'Disappointed', 'Ei! O cargo desse membro está acima do seu ou no mesmo nível. Você não pode simplesmente bani-lo.');
    return undefined;
  }

  const bot = await guild.fetchMember(guild.botUserId);
  if (bot === null) {
    await sayBanFailed(context);
    return undefined;
  }
  if (target.id === bot.id) {
    await say(context, 'cry', cannotBanBot);
    return undefined;
  }
  if (bot.highestRolePosition <= target.highestRolePosition) {
    await say(context, 'Angry', 'Ei! Meu cargo está abaixo desse membro ou no mesmo nível. Eu não consigo simplesmente bani-lo desse servidor.');
    return undefined;
  }
  return actor;
}

async function resolveBanTarget(
  context: CommandContext,
  guild: MemberModerationPort,
  actorId: string,
  userId: string,
  target: GuildMemberProfile | null,
): Promise<{ readonly subject: ModeratedUserProfile; readonly moderator: GuildMemberProfile } | undefined> {
  if (target !== null) {
    const moderator = await authorizeBan(context, guild, actorId, target);
    return moderator === undefined ? undefined : { subject: target, moderator };
  }

  const actor = await guild.fetchMember(actorId);
  if (actor === null || guild.botUserId === null) {
    await sayBanFailed(context);
    return undefined;
  }
  if (await guild.fetchBan(userId) !== null) {
    await say(context, 'search', alreadyBanned);
    return undefined;
  }
  const user = await guild.fetchUser(userId);
  if (user === null) {
    await say(context, 'search', userMissing);
    return undefined;
  }

  const joined = await guild.fetchMember(userId);
  if (joined === null) return { subject: user, moderator: actor };
  const moderator = await authorizeBan(context, guild, actorId, joined);
  return moderator === undefined ? undefined : { subject: joined, moderator };
}

async function execute(context: CommandContext): Promise<void> {
  await context.acknowledge();

  const accessError = await validateCommandAccess(access, context);
  if (accessError) { await context.reply(accessError); return; }

  const args = context.options ? parseSlashArgs(context.options) : parseBanPrefixArgs(context.rawArgs ?? '');
  if (!args.ok) {
    if (args.reason === 'missing') {
      await say(context, 'question', 'Diga quem banir. Mencione o membro ou digite o ID!');
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
    await sayBanFailed(context);
    return;
  }
  if (args.userId === actorId) {
    await say(context, 'Disappointed', 'Você não pode se banir... Por que você estaria tentando banir você mesmo?');
    return;
  }
  if (guild.botUserId !== null && args.userId === guild.botUserId) {
    await say(context, 'cry', cannotBanBot);
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
    await say(context, 'search', userMissing);
    return;
  }

  await publishConfirmation(context, await confirmation(context, resolved.subject, resolved.moderator, args.reason));
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
  scope: 'global' as const,
  execute,
} satisfies ChatInputCommand;
