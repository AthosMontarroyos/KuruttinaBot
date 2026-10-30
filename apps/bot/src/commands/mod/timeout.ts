import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { validateCommandAccess } from '#bot/command-system/access.js';
import type {
  ChatInputCommand,
  CommandAccess,
  CommandContext,
  CommandReply,
  GuildMemberProfile,
} from '#bot/command-system/types.js';
import type { MessageKey } from '#bot/application/messages/catalog.js';
import { log } from '#bot/infrastructure/logging/logger.js';
import {
  MAX_REASON_LENGTH,
  auditReason,
  authorizeMemberTarget,
  isSnowflake,
  errorDetails,
  mentionOrSnowflake,
  publishConfirmation,
} from '#bot/infrastructure/discord/moderation/modUtils.js';

const { ModerateMembers } = PermissionFlagsBits;
const SECOND_MS = 1_000;
const MINUTE_MS = 60 * SECOND_MS;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const WEEK_MS = 7 * DAY_MS;
/** Discord accepts `communication_disabled_until` up to 28 days ahead. */
const MAX_TIMEOUT_MS = 28 * DAY_MS;
const MIN_TIMEOUT_MS = SECOND_MS;

const UNIT_MS: Readonly<Record<string, number>> = {
  s: SECOND_MS,
  seg: SECOND_MS,
  segs: SECOND_MS,
  segundo: SECOND_MS,
  segundos: SECOND_MS,
  m: MINUTE_MS,
  min: MINUTE_MS,
  mins: MINUTE_MS,
  minuto: MINUTE_MS,
  minutos: MINUTE_MS,
  h: HOUR_MS,
  hr: HOUR_MS,
  hrs: HOUR_MS,
  hora: HOUR_MS,
  horas: HOUR_MS,
  d: DAY_MS,
  dia: DAY_MS,
  dias: DAY_MS,
  w: WEEK_MS,
  sem: WEEK_MS,
  semana: WEEK_MS,
  semanas: WEEK_MS,
};

const DURATION_PART = new RegExp(
  String.raw`^(\d{1,7})(?:\s*(semanas|semana|segundos|segundo|minutos|minuto|horas|hora|dias|dia|segs|seg|mins|min|hrs|hr|sem)|\s*([smhdw]))(?=$|[\s,]|\d)`,
  'iu',
);

const access: CommandAccess = {
  kind: 'guild',
  userPermissions: [ModerateMembers],
  botPermissions: [ModerateMembers],
  requireChannelSend: true,
  messages: {
    guildOnly: 'O castigo só pode ser feito em um canal de texto de servidor.',
    userMissing: 'Você precisa da permissão **{permissions}** neste servidor.',
    botMissing: 'Preciso destas permissões para castigar um membro: **{permissions}**.',
  },
};

type DurationParse =
  | 'invalid'
  | 'too-short'
  | 'too-long'
  | { readonly ms: number; readonly rest: string };

export type TimeoutArgs =
  | {
      readonly ok: false;
      readonly reason:
        | 'missing'
        | 'missing-duration'
        | 'invalid-user'
        | 'invalid-duration'
        | 'duration-too-short'
        | 'duration-too-long'
        | 'reason-too-long';
    }
  | { readonly ok: true; readonly userId: string; readonly durationMs: number; readonly reason?: string };

const durationFailure = {
  invalid: 'invalid-duration',
  'too-short': 'duration-too-short',
  'too-long': 'duration-too-long',
} as const;

export function parseTimeoutPrefixArgs(rawArgs: string): TimeoutArgs {
  const trimmed = rawArgs.trim();
  if (trimmed === '') return { ok: false, reason: 'missing' };
  const splitAt = trimmed.search(/\s/u);
  const head = splitAt === -1 ? trimmed : trimmed.slice(0, splitAt);
  const rest = splitAt === -1 ? '' : trimmed.slice(splitAt).trim();
  const userId = mentionOrSnowflake(head);
  if (userId === undefined) return { ok: false, reason: 'invalid-user' };
  if (rest === '') return { ok: false, reason: 'missing-duration' };
  return finishTimeout(userId, parseDurationPrefix(rest));
}

function parseSlashArgs(options: NonNullable<CommandContext['options']>): TimeoutArgs {
  const userId = options.find((option) => option.name === 'membro')?.value;
  const duration = options.find((option) => option.name === 'duracao')?.value;
  const reason = options.find((option) => option.name === 'motivo')?.value;
  if (typeof userId !== 'string') return { ok: false, reason: 'invalid-user' };
  if (typeof duration !== 'string') return { ok: false, reason: 'missing-duration' };
  if (reason !== undefined && typeof reason !== 'string') return { ok: false, reason: 'invalid-duration' };
  return finishTimeout(userId, parseDurationPrefix(duration), typeof reason === 'string' ? reason : '');
}

function readDurationPart(input: string): { amount: number; unit: string; length: number } | null {
  const match = DURATION_PART.exec(input);
  const unit = (match?.[2] ?? match?.[3])?.toLowerCase();
  const amount = match?.[1];
  if (match === null || unit === undefined || amount === undefined || UNIT_MS[unit] === undefined) return null;
  return { amount: Number(amount), unit, length: match[0].length };
}

function skipToNextPart(input: string): string | null {
  const match = /^[\s,]+(?:e[\s,]+)?|^e[\s,]+/iu.exec(input);
  if (match === null || match[0] === '') return null;
  const next = input.slice(match[0].length);
  return readDurationPart(next) === null ? null : next;
}

function parseDurationPrefix(input: string): DurationParse {
  let rest = input.trim();
  let total = 0;
  let parts = 0;
  while (rest !== '') {
    const part = readDurationPart(rest);
    const unitMs = part === null ? undefined : UNIT_MS[part.unit];
    if (part === null || unitMs === undefined) break;
    if (part.amount > Math.floor(MAX_TIMEOUT_MS / unitMs)) return 'too-long';
    total += part.amount * unitMs;
    if (total > MAX_TIMEOUT_MS) return 'too-long';
    parts += 1;
    rest = rest.slice(part.length);
    const next = skipToNextPart(rest);
    if (next !== null) rest = next;
  }
  if (parts === 0) return 'invalid';
  if (/^\d/u.test(rest)) return 'invalid';
  if (total < MIN_TIMEOUT_MS) return 'too-short';
  return { ms: total, rest: rest.replace(/^[\s,]+/u, '').trim() };
}

function finishTimeout(userId: string, duration: DurationParse, separateReason?: string): TimeoutArgs {
  if (!isSnowflake(userId)) return { ok: false, reason: 'invalid-user' };
  if (typeof duration === 'string') return { ok: false, reason: durationFailure[duration] };
  if (separateReason !== undefined && duration.rest !== '') return { ok: false, reason: 'invalid-duration' };
  const reason = (separateReason ?? duration.rest).trim();
  if (reason.length > MAX_REASON_LENGTH) return { ok: false, reason: 'reason-too-long' };
  return { ok: true, userId, durationMs: duration.ms, ...(reason === '' ? {} : { reason }) };
}

export function formatTimeoutDuration(ms: number): string {
  const units = [
    { size: WEEK_MS, one: 'semana', many: 'semanas' },
    { size: DAY_MS, one: 'dia', many: 'dias' },
    { size: HOUR_MS, one: 'hora', many: 'horas' },
    { size: MINUTE_MS, one: 'minuto', many: 'minutos' },
    { size: SECOND_MS, one: 'segundo', many: 'segundos' },
  ] as const;
  const parts: string[] = [];
  let left = ms;
  for (const unit of units) {
    const count = Math.floor(left / unit.size);
    if (count <= 0) continue;
    left -= count * unit.size;
    parts.push(`${count} ${count === 1 ? unit.one : unit.many}`);
  }
  if (parts.length === 0) return '1 segundo';
  if (parts.length === 1) return parts[0] ?? '1 segundo';
  const last = parts[parts.length - 1] ?? '1 segundo';
  return `${parts.slice(0, -1).join(', ')} e ${last}`;
}

async function say(context: CommandContext, key: MessageKey): Promise<void> {
  await context.reply(await context.render(key));
}

async function sayTimeoutFailed(context: CommandContext): Promise<void> {
  await say(context, 'timeout.failed');
}

async function reportTimeoutFailure(context: CommandContext, targetId: string, error: unknown): Promise<void> {
  log('error', 'timeout_failed', { guildId: context.guildId, targetId, ...errorDetails(error) });
  await sayTimeoutFailed(context);
}

async function confirmation(
  context: CommandContext,
  target: GuildMemberProfile,
  moderator: GuildMemberProfile,
  durationMs: number,
  reason: string | undefined,
): Promise<CommandReply> {
  return context.render(reason === undefined ? 'timeout.success_no_reason' : 'timeout.success', {
    target: target.displayName,
    'target.id': target.id,
    moderator: moderator.displayName,
    'moderator.id': moderator.id,
    length: formatTimeoutDuration(durationMs),
    ...(reason === undefined ? {} : { reason }),
  });
}

async function rejectTimeoutArgs(context: CommandContext, reason: Exclude<TimeoutArgs, { ok: true }>['reason']): Promise<void> {
  if (reason === 'missing') {
    await say(context, 'timeout.missing_target');
    return;
  }
  if (reason === 'missing-duration') {
    await say(context, 'timeout.missing_duration');
    return;
  }
  if (reason === 'invalid-duration') {
    await say(context, 'timeout.invalid_duration');
    return;
  }
  if (reason === 'duration-too-short') {
    await say(context, 'timeout.duration_too_short');
    return;
  }
  if (reason === 'duration-too-long') {
    await say(context, 'timeout.duration_too_long');
    return;
  }
  if (reason === 'reason-too-long') {
    await say(context, 'timeout.reason_too_long');
    return;
  }
  await say(context, 'timeout.invalid_target');
}

async function execute(context: CommandContext): Promise<void> {
  await context.acknowledge();

  const accessError = await validateCommandAccess(access, context);
  if (accessError) { await context.reply(accessError); return; }

  const args = context.options ? parseSlashArgs(context.options) : parseTimeoutPrefixArgs(context.rawArgs ?? '');
  if (!args.ok) {
    await rejectTimeoutArgs(context, args.reason);
    return;
  }

  const guild = context.memberModeration;
  const actorId = context.userId;
  if (guild === undefined || actorId === undefined) {
    await sayTimeoutFailed(context);
    return;
  }
  if (args.userId === actorId) {
    await say(context, 'timeout.self');
    return;
  }
  if (guild.botUserId !== null && args.userId === guild.botUserId) {
    await say(context, 'timeout.bot_target');
    return;
  }

  let target: GuildMemberProfile | null;
  try {
    target = await guild.fetchMember(args.userId);
  } catch (error: unknown) {
    await reportTimeoutFailure(context, args.userId, error);
    return;
  }
  if (target === null) {
    await say(context, 'timeout.member_not_found');
    return;
  }

  let moderator: GuildMemberProfile | undefined;
  try {
    moderator = await authorizeMemberTarget(context, guild, actorId, target, {
      owner: 'timeout.owner',
      failed: 'timeout.failed',
      roleAboveActor: 'timeout.role_above_actor',
      botTarget: 'timeout.bot_target',
      botRoleBelow: 'timeout.bot_role_below',
      administrator: 'timeout.administrator',
    });
  } catch (error: unknown) {
    await reportTimeoutFailure(context, args.userId, error);
    return;
  }
  if (moderator === undefined) return;

  let outcome: 'timed-out' | 'missing';
  try {
    outcome = await guild.timeout(args.userId, args.durationMs, auditReason(actorId, args.reason, `por ${formatTimeoutDuration(args.durationMs)}`));
  } catch (error: unknown) {
    await reportTimeoutFailure(context, args.userId, error);
    return;
  }
  if (outcome === 'missing') {
    await say(context, 'timeout.member_not_found');
    return;
  }

  await publishConfirmation(context, await confirmation(context, target, moderator, args.durationMs, args.reason), 'timeout_confirm_failed');
}

export const command = {
  data: new SlashCommandBuilder()
    .setName('timeout')
    .setDescription('Aplica um castigo temporário a um membro')
    .setDefaultMemberPermissions(ModerateMembers)
    .addUserOption((option) =>
      option.setName('membro').setDescription('Membro que será castigado').setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName('duracao')
        .setDescription('Duração, como 10m, 2h, 1d ou 1 semana')
        .setMaxLength(48)
        .setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName('motivo')
        .setDescription('Motivo do castigo')
        .setMaxLength(MAX_REASON_LENGTH)
        .setRequired(false),
    ),
  access,
  scope: 'global' as const,
  execute,
} satisfies ChatInputCommand;
