import type { Channel, Client, GuildTextBasedChannel } from 'discord.js';
import { ACTION_VARIABLES, renderTemplate, type MessageTemplate } from '@kuruttina/message-templates';
import { log } from '#bot/infrastructure/logging/logger.js';
import { actionValuesFor } from './actionValues.js';
import { toCommandReply } from './toCommandReply.js';

/** Pedido de entrega pendente, como devolvido por `database.deliveries.claimPending`. */
interface PendingDelivery {
  readonly id: number;
  readonly guildId: string;
  readonly channelId: string;
  readonly templateName: string;
}

/** Porta mínima consumida pelo poller: a fila de entregas e a leitura de templates. */
export interface DeliveryDatabasePort {
  readonly deliveries: {
    claimPending(limit?: number): Promise<readonly PendingDelivery[]>;
    markSent(id: number): Promise<boolean>;
    markFailed(id: number, errorCode: string): Promise<boolean>;
  };
  readonly templates: {
    getTemplate(guildId: string, name: string): Promise<{ content: MessageTemplate } | null>;
  };
}

/** Códigos de falha de entrega gravados na fila: estáveis, minúsculos, com `_`. */
const CHANNEL_NOT_FOUND = 'channel_not_found';
const WRONG_GUILD = 'wrong_guild';
const NOT_TEXT_CHANNEL = 'not_text_channel';
const TEMPLATE_NOT_FOUND = 'template_not_found';
const MISSING_PERMISSION = 'missing_permission';
const SEND_FAILED = 'send_failed';
const RENDER_FAILED = 'render_failed';

/** Discord reporta permissão insuficiente com esses códigos de erro de API. */
const MISSING_PERMISSION_API_CODES = new Set([50001, 50013]);

function missingPermissionCode(error: unknown): boolean {
  return (
    error !== null &&
    typeof error === 'object' &&
    'code' in error &&
    MISSING_PERMISSION_API_CODES.has((error as { code: unknown }).code as number)
  );
}

/** Canal de servidor com `send`: exclui DM e grupo de DM, que não pertencem a nenhum servidor. */
function isGuildSendableChannel(channel: Channel): channel is GuildTextBasedChannel {
  return 'guildId' in channel && typeof channel.guildId === 'string' && 'send' in channel;
}

/**
 * Consome periodicamente a fila de entrega (etapa 1D): reivindica pendências,
 * renderiza o template pedido e publica no canal do servidor que pediu.
 * Uma falha em um item nunca impede os demais do mesmo ciclo.
 */
export function createDeliveryPoller(
  client: Client,
  database: DeliveryDatabasePort,
  intervalMs = 5000,
): { stop(): void } {
  let stopped = false;
  let cycleRunning = false;

  async function fail(delivery: PendingDelivery, errorCode: string): Promise<void> {
    log('error', 'delivery_failed', {
      id: delivery.id, guildId: delivery.guildId, channelId: delivery.channelId, errorCode,
    });
    try {
      await database.deliveries.markFailed(delivery.id, errorCode);
    } catch (error) {
      log('error', 'delivery_mark_failed_failed', {
        id: delivery.id, errorName: error instanceof Error ? error.name : 'UnknownError',
      });
    }
  }

  async function deliverOne(delivery: PendingDelivery): Promise<void> {
    let channel;
    try {
      channel = await client.channels.fetch(delivery.channelId);
    } catch {
      channel = null;
    }
    if (!channel || !channel.isTextBased() || !isGuildSendableChannel(channel)) {
      await fail(delivery, !channel ? CHANNEL_NOT_FOUND : NOT_TEXT_CHANNEL);
      return;
    }
    if (channel.guildId !== delivery.guildId) {
      await fail(delivery, WRONG_GUILD);
      return;
    }

    const record = await database.templates.getTemplate(delivery.guildId, delivery.templateName);
    if (!record) {
      await fail(delivery, TEMPLATE_NOT_FOUND);
      return;
    }

    let reply;
    try {
      // Entrega de teste do painel: não há usuário disparando, então o bot faz esse papel, como no preview do site.
      const values = 'guild' in channel ? actionValuesFor(channel.guild, client.user ?? undefined) : {};
      reply = toCommandReply(renderTemplate(record.content, ACTION_VARIABLES, values));
    } catch (error) {
      log('error', 'delivery_render_failed', {
        id: delivery.id,
        guildId: delivery.guildId,
        errorName: error instanceof Error ? error.name : 'UnknownError',
      });
      await fail(delivery, RENDER_FAILED);
      return;
    }
    const content = typeof reply === 'string'
      ? { content: reply, allowedMentions: { parse: [] as const } }
      : { ...reply, allowedMentions: { parse: [] as const } };

    try {
      await channel.send(content);
    } catch (error) {
      await fail(delivery, missingPermissionCode(error) ? MISSING_PERMISSION : SEND_FAILED);
      return;
    }

    try {
      await database.deliveries.markSent(delivery.id);
    } catch (error) {
      log('error', 'delivery_mark_sent_failed', {
        id: delivery.id, errorName: error instanceof Error ? error.name : 'UnknownError',
      });
    }
  }

  async function tick(): Promise<void> {
    if (stopped || cycleRunning) return;
    cycleRunning = true;
    try {
      const pending = await database.deliveries.claimPending(10);
      for (const delivery of pending) {
        // Uma entrega ruim não pode travar as demais do mesmo ciclo.
        try {
          await deliverOne(delivery);
        } catch (error) {
          await fail(delivery, SEND_FAILED).catch(() => {});
          log('error', 'delivery_cycle_item_failed', {
            id: delivery.id, errorName: error instanceof Error ? error.name : 'UnknownError',
          });
        }
      }
    } catch (error) {
      log('error', 'delivery_poll_failed', { errorName: error instanceof Error ? error.name : 'UnknownError' });
    } finally {
      cycleRunning = false;
    }
  }

  // Primeiro ciclo imediato: não espera o bot ficar de braços cruzados até o primeiro intervalo.
  void tick();
  const timer = setInterval(() => { void tick(); }, intervalMs);

  return {
    stop(): void {
      stopped = true;
      clearInterval(timer);
    },
  };
}
