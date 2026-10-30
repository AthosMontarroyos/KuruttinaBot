import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { validateCommandAccess } from '#bot/command-system/access.js';
import { withEmojis } from '#bot/command-system/responses.js';
import type { ChatInputCommand, BulkDeletePort, CommandAccess, CommandContext, CommandMessage } from '#bot/command-system/types.js';
import { log } from '#bot/infrastructure/logging/logger.js';
import { errorDetails } from '#bot/infrastructure/discord/moderation/modUtils.js';

const { ManageMessages, ViewChannel, ReadMessageHistory } = PermissionFlagsBits;

/** Declared policy; enforced centrally by CommandsHandler and rechecked here before any work. */
const access: CommandAccess = {
  kind: 'guild',
  userPermissions: [ManageMessages],
  botPermissions: [ViewChannel, ReadMessageHistory, ManageMessages],
  requireChannelSend: true,
  messages: {
    guildOnly: 'A limpeza só pode ser feita em um canal de texto de servidor.',
    botMissing: 'Preciso destas permissões para fazer a limpeza: **{permissions}**.',
  },
};

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

function tryAcquireLock(key: string): boolean {
  if (activeChannels.has(key)) return false;
  activeChannels.add(key);
  return true;
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

  const accessError = await validateCommandAccess(access, context);
  if (accessError) { await context.reply(accessError); return; }

  const channel = context.textChannel;
  // Inalcançável: a política acima já nega quando não há canal de texto de servidor.
  if (!channel) return;

  const args = context.options ? parseSlashArgs(context.options) : parsePrefixArgs(context.rawArgs ?? '');

  if (!validCount(args.count)) {
    await context.reply(withEmojis(await context.emoji('question'), `Diga quantas mensagens apagar: um número de **1 a ${MAX_COUNT}**.`));
    return;
  }

  if (args.userId !== undefined && (typeof args.userId !== 'string' || !/^\d{17,20}$/u.test(args.userId))) {
    await context.reply(withEmojis(await context.emoji('ID'), 'Não consegui identificar esse usuário. Selecione um usuário válido para a limpeza.'));
    return;
  }

  const lockKey = `${context.guildId}:${context.channelId}`;
  if (!tryAcquireLock(lockKey)) {
    await context.reply(withEmojis(await context.emoji('loading'), 'Já estou limpando este canal. Espere eu terminar para começar outra limpeza.'));
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
      try { await context.reply(withEmojis(await context.emoji('ops'), 'Não consegui buscar as mensagens. Tente de novo daqui a pouco.')); } catch { /* best effort */ }
      return;
    }

    if (eligible.length === 0) {
      const filter = args.userId ? ` de <@${args.userId}>` : '';
      await context.reply(withEmojis(await context.emoji('search'), `Não encontrei mensagens${filter} para apagar. Só consigo limpar mensagens enviadas há menos de 14 dias.`));
      return;
    }

    let deleted: number;
    try {
      deleted = await channel.bulkDelete(eligible);
    } catch (error: unknown) {
      log('error', 'clear_delete_failed', { channelId, ...errorDetails(error) });
      try { await context.reply(withEmojis(await context.emoji('ops'), 'Não consegui concluir a limpeza. Confira o histórico antes de tentar de novo.')); } catch { /* best effort */ }
      return;
    }

    const channelMention = channelId ? `<#${channelId}>` : 'canal';
    const noun = deleted === 1 ? 'mensagem' : 'mensagens';
    const confirmationText = withEmojis(cleaning, `Pronto. Apaguei ${deleted} ${noun} em ${channelMention}.`, slap);

    try {
      if (context.sendMessage) await context.sendMessage(confirmationText);
      else await context.reply(confirmationText);
    } catch (error: unknown) {
      log('error', 'clear_confirm_failed', { channelId, deleted, ...errorDetails(error) });
      // A exclusão já concluiu; descarta apenas o indicador efêmero, sem uma segunda confirmação.
      try { await context.deleteReply?.(); } catch { /* best effort */ }
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
    try { await context.reply(withEmojis(await context.emoji('ops'), 'Não consegui concluir a limpeza. Confira o histórico antes de tentar de novo.')); } catch { /* best effort */ }
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
  access,
  scope: 'global' as const,
  execute,
} satisfies ChatInputCommand;
