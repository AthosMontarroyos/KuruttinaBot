import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { validateCommandAccess } from '#bot/command-system/access.js';
import { withEmojis } from '#bot/command-system/responses.js';
import type {
  ChatInputCommand,
  CommandAccess,
  CommandContext,
  CommandReply,
  GuildMemberProfile,
  ModeratedUserProfile,
} from '#bot/command-system/types.js';
import { log } from '#bot/infrastructure/logging/logger.js';

const { BanMembers } = PermissionFlagsBits;

/** Discord audit-log reason limit is 512. The visible reason stays shorter. */
const MAX_REASON_LENGTH = 200;

const cannotUnbanBot = 'Ei! Eu nem estou banida, então como voce estaria tentando revogar o meu banimento?';
const unbanFailed = 'Não consegui revogar o banimento desse usuário. Tente de novo daqui a pouco.';
const notBanned = 'Ei! Esse usuário não está nem sequer banido.';
const SNOWFLAKE = /^\d{17,20}$/u;
const MENTION = /^<@!?(\d{17,20})>$/u;

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

export type UnbanArgs =
  | { readonly ok: false; readonly reason: 'missing' | 'invalid-user' | 'reason-too-long' }
  | { readonly ok: true; readonly userId: string; readonly reason?: string };

export function parseUnbanPrefixArgs(rawArgs: string): UnbanArgs {
  const trimmed = rawArgs.trim();
  if (trimmed === '') return { ok: false, reason: 'missing' };
  const splitAt = trimmed.search(/\s/u);
  const head = splitAt === -1 ? trimmed : trimmed.slice(0, splitAt);
  const rest = splitAt === -1 ? '' : trimmed.slice(splitAt).trim();
  return parseTarget(mentionOrSnowflake(head), rest);
}

function parseSlashArgs(options: NonNullable<CommandContext['options']>): UnbanArgs {
  const userId = options.find((option) => option.name === 'membro')?.value;
  const reason = options.find((option) => option.name === 'motivo')?.value;
  if (reason !== undefined && typeof reason !== 'string') return { ok: false, reason: 'invalid-user' };
  return parseTarget(typeof userId === 'string' ? userId : undefined, typeof reason === 'string' ? reason.trim() : '');
}

function mentionOrSnowflake(token: string): string | undefined {
  return MENTION.exec(token)?.[1] ?? (SNOWFLAKE.test(token) ? token : undefined);
}

function parseTarget(userId: string | undefined, reason: string): UnbanArgs {
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

async function sayUnbanFailed(context: CommandContext): Promise<void> {
  await say(context, 'ops', unbanFailed);
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
  const [done, happy, unlock, identity, staff, note] = await Promise.all([
    context.emoji('sucess'),
    context.emoji('happy'),
    context.emoji('unlock'),
    context.emoji('ID'),
    context.emoji('staff'),
    context.emoji('Note'),
  ]);
  return {
    content: withEmojis(happy, `Pronto. O banimento de ${asCode(target.displayName, 'Usuário')} foi revogado.`),
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
    log('error', 'unban_confirm_failed', { guildId: context.guildId, ...errorDetails(error) });
    try { await context.reply(message); } catch { /* A revogação já concluiu. */ }
    return;
  }
  if (context.sendMessage && context.deleteReply) {
    try { await context.deleteReply(); } catch { /* O indicador efêmero pode expirar. */ }
  }
}

async function execute(context: CommandContext): Promise<void> {
  await context.acknowledge();

  const accessError = await validateCommandAccess(access, context);
  if (accessError) { await context.reply(accessError); return; }

  const args = context.options ? parseSlashArgs(context.options) : parseUnbanPrefixArgs(context.rawArgs ?? '');
  if (!args.ok) {
    if (args.reason === 'missing') {
      await say(context, 'question', 'Diga de quem revogar o banimento. Mencione o usuário ou digite o ID!');
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
    await sayUnbanFailed(context);
    return;
  }
  if (args.userId === actorId) {
    await say(context, 'Disappointed', 'Como voce estaria tentando revogar o seu próprio banimento?');
    return;
  }
  if (guild.botUserId !== null && args.userId === guild.botUserId) {
    await say(context, 'Disappointed', cannotUnbanBot);
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
    await say(context, 'search', notBanned);
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
    await say(context, 'search', notBanned);
    return;
  }

  await publishConfirmation(context, await confirmation(context, banned, moderator, args.reason));
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
  scope: 'global' as const,
  execute,
} satisfies ChatInputCommand;
