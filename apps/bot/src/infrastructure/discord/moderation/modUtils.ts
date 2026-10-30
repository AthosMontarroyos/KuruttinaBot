import type { CommandContext, CommandReply } from '#bot/command-system/types.js';
import { log } from '#bot/infrastructure/logging/logger.js';

/** Discord audit-log reason limit is 512. The visible reason stays shorter. */
export const MAX_REASON_LENGTH = 200;
const AUDIT_REASON_LIMIT = 512;

export const SNOWFLAKE = /^\d{17,20}$/u;
const MENTION = /^<@!?(\d{17,20})>$/u;

export type ModerationTargetArgs =
  | { readonly ok: false; readonly reason: 'missing' | 'invalid-user' | 'reason-too-long' }
  | { readonly ok: true; readonly userId: string; readonly reason?: string };

export function mentionOrSnowflake(token: string): string | undefined {
  return MENTION.exec(token)?.[1] ?? (SNOWFLAKE.test(token) ? token : undefined);
}

function parseTarget(userId: string | undefined, reason: string): ModerationTargetArgs {
  if (userId === undefined || !SNOWFLAKE.test(userId)) return { ok: false, reason: 'invalid-user' };
  if (reason.length > MAX_REASON_LENGTH) return { ok: false, reason: 'reason-too-long' };
  return { ok: true, userId, ...(reason === '' ? {} : { reason }) };
}

/** Prefixo `k!`: o primeiro token é menção ou ID; o restante é o motivo. */
export function parsePrefixTarget(rawArgs: string): ModerationTargetArgs {
  const trimmed = rawArgs.trim();
  if (trimmed === '') return { ok: false, reason: 'missing' };
  const splitAt = trimmed.search(/\s/u);
  const head = splitAt === -1 ? trimmed : trimmed.slice(0, splitAt);
  const rest = splitAt === -1 ? '' : trimmed.slice(splitAt).trim();
  return parseTarget(mentionOrSnowflake(head), rest);
}

/** Slash: opções `membro` e `motivo`, no mesmo formato do prefixo. */
export function parseSlashTarget(
  options: ReadonlyArray<{ readonly name: string; readonly value?: unknown }>,
): ModerationTargetArgs {
  const userId = options.find((option) => option.name === 'membro')?.value;
  const reason = options.find((option) => option.name === 'motivo')?.value;
  if (reason !== undefined && typeof reason !== 'string') return { ok: false, reason: 'invalid-user' };
  return parseTarget(typeof userId === 'string' ? userId : undefined, typeof reason === 'string' ? reason.trim() : '');
}

/**
 * Motivo gravado no audit log do Discord. `detail` entra no texto base
 * (o castigo usa a duração) e, nesse caso, o limite vale mesmo sem motivo visível.
 */
export function auditReason(moderatorId: string, reason: string | undefined, detail?: string): string {
  const base = detail === undefined ? `Moderador ${moderatorId}` : `Moderador ${moderatorId} ${detail}`;
  if (reason === undefined) return detail === undefined ? base : base.slice(0, AUDIT_REASON_LIMIT);
  return `${base}: ${reason.replace(/\s+/gu, ' ').trim()}`.slice(0, AUDIT_REASON_LIMIT);
}

export function errorDetails(error: unknown): { errorName: string; errorCode?: string | number } {
  const code = error !== null && typeof error === 'object' && 'code' in error ? error.code : undefined;
  return {
    errorName: error instanceof Error ? error.name : 'UnknownError',
    ...(typeof code === 'number' || (typeof code === 'string' && /^[A-Z0-9_]{1,64}$/u.test(code))
      ? { errorCode: code }
      : {}),
  };
}

/** Publica a confirmação no canal e apaga o indicador efêmero. Falha de envio não desfaz a ação. */
export async function publishConfirmation(
  context: CommandContext,
  message: CommandReply,
  failureEvent: string,
): Promise<void> {
  try {
    if (context.sendMessage) await context.sendMessage(message);
    else await context.reply(message);
  } catch (error: unknown) {
    log('error', failureEvent, { guildId: context.guildId, ...errorDetails(error) });
    try { await context.reply(message); } catch { /* A ação de moderação já concluiu. */ }
    return;
  }
  if (context.sendMessage && context.deleteReply) {
    try { await context.deleteReply(); } catch { /* O indicador efêmero pode expirar. */ }
  }
}
