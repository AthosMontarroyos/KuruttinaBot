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

const { ModerateMembers } = PermissionFlagsBits;

/** Discord audit-log reason limit is 512. The visible reason stays shorter. */
const MAX_REASON_LENGTH = 200;

const cannotClearBot = 'Você não pode remover o meu castigo.';
const clearFailed = 'Não consegui remover o castigo desse membro. Tente de novo daqui a pouco.';
const memberMissing = 'Não encontrei esse membro neste servidor.';
const SNOWFLAKE = /^\d{17,20}$/u;
const MENTION = /^<@!?(\d{17,20})>$/u;

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

export type UntimeoutArgs =
  | { readonly ok: false; readonly reason: 'missing' | 'invalid-user' | 'reason-too-long' }
  | { readonly ok: true; readonly userId: string; readonly reason?: string };

export function parseUntimeoutPrefixArgs(rawArgs: string): UntimeoutArgs {
  const trimmed = rawArgs.trim();
  if (trimmed === '') return { ok: false, reason: 'missing' };
  const splitAt = trimmed.search(/\s/u);
  const head = splitAt === -1 ? trimmed : trimmed.slice(0, splitAt);
  const rest = splitAt === -1 ? '' : trimmed.slice(splitAt).trim();
  return parseTarget(mentionOrSnowflake(head), rest);
}

function parseSlashArgs(options: NonNullable<CommandContext['options']>): UntimeoutArgs {
  const userId = options.find((option) => option.name === 'membro')?.value;
  const reason = options.find((option) => option.name === 'motivo')?.value;
  if (reason !== undefined && typeof reason !== 'string') return { ok: false, reason: 'invalid-user' };
  return parseTarget(typeof userId === 'string' ? userId : undefined, typeof reason === 'string' ? reason.trim() : '');
}

function mentionOrSnowflake(token: string): string | undefined {
  return MENTION.exec(token)?.[1] ?? (SNOWFLAKE.test(token) ? token : undefined);
}

function parseTarget(userId: string | undefined, reason: string): UntimeoutArgs {
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

async function sayClearFailed(context: CommandContext): Promise<void> {
  await say(context, 'ops', clearFailed);
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
  const [done, unmute, identity, police, note] = await Promise.all([
    context.emoji('sucess'),
    context.emoji('unmute'),
    context.emoji('ID'),
    context.emoji('police'),
    context.emoji('Note'),
  ]);
  return {
    content: withEmojis(done, `Pronto. O castigo de ${asCode(target.displayName, 'Membro')} foi removido.`, unmute),
    embeds: [{
      color: 0x2b2d31,
      fields: [
        {
          name: withEmojis(identity, 'Membro'),
          value: `${asCode(target.displayName, 'Membro')}\n\`${target.id}\``,
          inline: true,
        },
        {
          name: withEmojis(police, 'Responsável'),
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
    log('error', 'untimeout_confirm_failed', { guildId: context.guildId, ...errorDetails(error) });
    try { await context.reply(message); } catch { /* A remoção já concluiu. */ }
    return;
  }
  if (context.sendMessage && context.deleteReply) {
    try { await context.deleteReply(); } catch { /* O indicador efêmero pode expirar. */ }
  }
}

async function authorizeClear(
  context: CommandContext,
  guild: MemberModerationPort,
  actorId: string,
  target: GuildMemberProfile,
): Promise<GuildMemberProfile | undefined> {
  if (target.id === guild.ownerId) {
    await say(context, 'Disappointed', 'Ei! Não consigo alterar o castigo do dono deste servidor...');
    return undefined;
  }

  const actor = await guild.fetchMember(actorId);
  if (actor === null || guild.botUserId === null) {
    await sayClearFailed(context);
    return undefined;
  }
  if (actorId !== guild.ownerId && actor.highestRolePosition <= target.highestRolePosition) {
    await say(context, 'Disappointed', 'Ei! O cargo desse membro está acima do seu ou no mesmo nível. Você não pode remover o castigo dele!');
    return undefined;
  }

  const bot = await guild.fetchMember(guild.botUserId);
  if (bot === null) {
    await sayClearFailed(context);
    return undefined;
  }
  if (target.id === bot.id) {
    await say(context, 'Angry', cannotClearBot);
    return undefined;
  }
  if (bot.highestRolePosition <= target.highestRolePosition) {
    await say(context, 'cry', 'Ei! Meu cargo está abaixo do cargo desse membro ou no mesmo nível. Não consigo remover o castigo dele.');
    return undefined;
  }
  if (target.administrator) {
    await say(context, 'cry', 'Ei! Não consigo alterar o castigo de um membro com a permissão **Administrador**.');
    return undefined;
  }
  return actor;
}

async function execute(context: CommandContext): Promise<void> {
  await context.acknowledge();

  const accessError = await validateCommandAccess(access, context);
  if (accessError) { await context.reply(accessError); return; }

  const args = context.options ? parseSlashArgs(context.options) : parseUntimeoutPrefixArgs(context.rawArgs ?? '');
  if (!args.ok) {
    if (args.reason === 'missing') {
      await say(context, 'question', 'Diga de quem remover o castigo. Mencione o membro ou digite o ID!');
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
    await sayClearFailed(context);
    return;
  }
  if (args.userId === actorId) {
    await say(context, 'Disappointed', 'Você não pode remover o próprio castigo.');
    return;
  }
  if (guild.botUserId !== null && args.userId === guild.botUserId) {
    await say(context, 'Angry', cannotClearBot);
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
    await say(context, 'search', memberMissing);
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
    await say(context, 'search', 'Esse membro não está castigado.');
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
    await say(context, 'search', memberMissing);
    return;
  }

  await publishConfirmation(context, await confirmation(context, target, moderator, args.reason));
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
