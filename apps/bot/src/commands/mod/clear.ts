import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommand, BulkDeletePort, CommandContext, CommandMessage } from '#bot/commands/types.js';
import { log } from '#bot/infrastructure/logger.js';

const { ManageMessages, ViewChannel, ReadMessageHistory, SendMessages, SendMessagesInThreads } = PermissionFlagsBits;

/** Maximum messages the user can request. */
const MAX_COUNT = 200;

/** Maximum pages of 100 to scan (10,000 messages). */
const MAX_PAGES = 100;

/** Time budget in milliseconds for all operations. */
const TIME_BUDGET_MS = 120_000;

/** Two weeks in milliseconds. */
const TWO_WEEKS_MS = 14 * 24 * 60 * 60 * 1000;

/** Per-guild+channel concurrency lock (per process instance). */
const activeChannels = new Set<string>();

function errorDetails(error: unknown): { errorName: string; errorCode?: string | number } {
  const code = error !== null && typeof error === 'object' && 'code' in error ? error.code : undefined;
  return {
    errorName: error instanceof Error ? error.name : 'UnknownError',
    ...(typeof code === 'number' || (typeof code === 'string' && /^[A-Z0-9_]{1,64}$/u.test(code))
      ? { errorCode: code }
      : {}),
  };
}

function tryAcquireLock(key: string): boolean {
  if (activeChannels.has(key)) return false;
  activeChannels.add(key);
  return true;
}

function validateUserPermissions(ctx: CommandContext): string | null {
  if (!ctx.memberPermissions) return 'Nao foi possivel verificar suas permissoes.';
  if (ctx.memberPermissions.has(ManageMessages, true)) return null;
  return 'Voce precisa da permissao Gerenciar mensagens neste canal.';
}

function validateBotPermissions(ctx: CommandContext): string | null {
  if (!ctx.appPermissions) return 'Nao consegui verificar minhas permissoes neste canal.';
  const missing: string[] = [];
  if (!ctx.appPermissions.has(ViewChannel, true)) missing.push('Ver canal');
  if (!ctx.appPermissions.has(ReadMessageHistory, true)) missing.push('Ler historico');
  if (!ctx.appPermissions.has(ManageMessages, true)) missing.push('Gerenciar mensagens');
  const sendPermission = ctx.textChannel?.isThread ? SendMessagesInThreads : SendMessages;
  if (!ctx.appPermissions.has(sendPermission, true)) {
    missing.push('Enviar mensagens');
  }
  if (missing.length > 0) return `Estou sem permissoes necesarias: ${missing.join(', ')}.`;
  return null;
}

function validCount(count: number): boolean {
  return Number.isInteger(count) && count >= 1 && count <= MAX_COUNT;
}

export function parsePrefixArgs(rawArgs: string): { count: number; userId?: string } {
  const parts = rawArgs.trim().split(/\s+/u);
  const count = Number(parts[0]);
  if (!validCount(count) || parts.length > 2) {
    return { count: 0 };
  }
  const mentionMatch = /^<@!?(\d+)>$/u.exec(parts[1] ?? '');
  const mentionUserId = mentionMatch?.[1];
  // Preserve invalid input so the shared validation rejects it instead of dropping the filter.
  const userId = mentionUserId ?? parts[1];
  return { count, ...(userId ? { userId } : {}) };
}

function parseSlashArgs(options: NonNullable<CommandContext['options']>): { count: number; userId?: unknown } {
  const count = options.find((option) => option.name === 'quantidade')?.value;
  const userId = options.find((option) => option.name === 'usuario')?.value;
  return { count: typeof count === 'number' ? count : 0, userId };
}

async function fetchEligibleMessages(
  channel: BulkDeletePort,
  count: number,
  targetUserId: string | undefined,
  deadline: number,
  beforeOverride?: string,
): Promise<readonly CommandMessage[]> {
  const eligible: CommandMessage[] = [];
  let before: string | undefined = beforeOverride;
  const now = Date.now();
  let pages = 0;

  while (eligible.length < count && pages < MAX_PAGES && Date.now() < deadline) {
    const batch = await channel.fetchMessages({ limit: 100, before });
    if (batch.length === 0) break;

    let hitOldMessage = false;
    for (const msg of batch) {
      if (now - msg.createdTimestamp >= TWO_WEEKS_MS) { hitOldMessage = true; break; }
      if (targetUserId && msg.author.id !== targetUserId) continue;
      eligible.push(msg);
      if (eligible.length >= count) break;
    }

    if (hitOldMessage) break;
    const lastMessage = batch[batch.length - 1];
    if (!lastMessage) break;
    const nextCursor = lastMessage.id;
    if (nextCursor === before) break;
    before = nextCursor;
    pages++;
    if (batch.length < 100) break;
  }

  return eligible;
}

async function execute(context: CommandContext): Promise<void> {
  await context.acknowledge();

  const channel = context.textChannel;
  if (!channel) {
    await context.reply('Este comando so pode ser usado em canais de texto de servidor.');
    return;
  }

  const userError = validateUserPermissions(context);
  if (userError) { await context.reply(userError); return; }

  const botError = validateBotPermissions(context);
  if (botError) {
    await context.reply(botError);
    return;
  }

  const args = context.options ? parseSlashArgs(context.options) : parsePrefixArgs(context.rawArgs ?? '');

  if (!validCount(args.count)) {
    await context.reply(`Informe um numero entre 1 e ${MAX_COUNT}.`);
    return;
  }

  if (args.userId !== undefined && (typeof args.userId !== 'string' || !/^\d{17,20}$/u.test(args.userId))) {
    await context.reply('Usuario invalido.');
    return;
  }

  const lockKey = `${context.guildId}:${context.channelId}`;
  if (!tryAcquireLock(lockKey)) {
    await context.reply('Ja existe uma operacao de limpeza em andamento neste canal. Aguarde concluir.');
    return;
  }

  const deadline = Date.now() + TIME_BUDGET_MS;
  const { channelId, commandMessageId } = context;
  try {
    const [cleaning, slap] = await Promise.all([
      context.emoji('cleaning'),
      context.emoji('slap'),
    ]);
    let eligible: readonly CommandMessage[];
    try {
      eligible = await fetchEligibleMessages(channel, args.count, args.userId, deadline, commandMessageId);
    } catch (error: unknown) {
      log('error', 'clear_fetch_failed', { channelId, ...errorDetails(error) });
      try { await context.reply('Falha ao buscar mensagens. Operacao interrompida.'); } catch { /* best effort */ }
      return;
    }

    if (eligible.length === 0) {
      await context.reply(`${cleaning} Nenhuma mensagem elegivel encontrada para apagar.`);
      return;
    }

    let deleted: number;
    try {
      deleted = await channel.bulkDelete(eligible);
    } catch (error: unknown) {
      log('error', 'clear_delete_failed', { channelId, ...errorDetails(error) });
      try { await context.reply('Falha ao apagar mensagens. Operacao interrompida.'); } catch { /* best effort */ }
      return;
    }

    const channelMention = channelId ? `<#${channelId}>` : 'canal';
    const confirmationText = `${cleaning} Foram apagadas ${deleted} mensagens em ${channelMention}! ${slap}`;

    try {
      if (context.sendMessage) await context.sendMessage(confirmationText);
      else await context.reply(confirmationText);
    } catch (error: unknown) {
      log('error', 'clear_confirm_failed', { channelId, deleted, ...errorDetails(error) });
      // Deletion succeeded but confirmation failed — inform via reply as fallback
      try { await context.reply(`${cleaning} ${deleted} mensagens apagadas em ${channelMention} (falha ao enviar confirmacao publica).`); } catch { /* best effort */ }
      return;
    }

    // Prefix: delete the user's command message after confirmation is sent
    if (commandMessageId) {
      try { await channel.deleteMessage(commandMessageId); } catch { /* best effort */ }
    }

    // Slash: remove the ephemeral thinking indicator; prefix: confirmation already sent via sendMessage
    if (context.sendMessage && context.deleteReply) {
      try { await context.deleteReply(); } catch { /* best effort */ }
    }
  } catch (error: unknown) {
    log('error', 'clear_unexpected_error', {
      channelId,
      ...errorDetails(error),
    });
    try { await context.reply('Falha ao apagar mensagens. Operacao interrompida.'); } catch { /* best effort */ }
  } finally {
    activeChannels.delete(lockKey);
  }
}

export const command = {
  data: new SlashCommandBuilder()
    .setName('clear')
    .setDescription('Limpa mensagens de um canal')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addIntegerOption((option) =>
      option.setName('quantidade').setDescription('Numero de mensagens para apagar (1-200)').setMinValue(1).setMaxValue(MAX_COUNT).setRequired(true),
    )
    .addUserOption((option) =>
      option.setName('usuario').setDescription('Usuario especifico para apagar mensagens (opcional)').setRequired(false),
    ),
  execute,
} satisfies ChatInputCommand;
