/** Fila de entrega de mensagens (etapa 1D), isolada em `bot_private.message_deliveries`.
 * O site só insere e lê o próprio servidor; o bot lê a fila inteira (sem
 * `app.guild_id`, pela policy `message_deliveries_bot_poll`) e atualiza o
 * status. Cada operação abre e fecha sua própria transação.
 * @typedef {{id: number, guildId: string, channelId: string, templateName: string|null, content: unknown|null, requestedBy: string}} PendingDelivery */

import { withGuildTransaction, withTransaction } from './transaction.js';

/** Pede o envio a um canal: um template salvo (`templateName`) ou um conteúdo avulso (`content`), nunca os dois.
 * Respeita a cota de 20 pendências por servidor.
 * @param {import('pg').PoolClient} client
 * @param {{guildId: string, channelId: string, templateName?: string, content?: unknown, requestedBy: string}} input
 * @returns {Promise<{ok: true}|{ok: false, code: 'quota'}>} */
export async function create(client, { guildId, channelId, templateName, content, requestedBy }) {
  const hasTemplate = templateName != null;
  const hasContent = content != null;
  if (hasTemplate === hasContent) throw new Error('Entrega exige exatamente um entre templateName e content.');
  try {
    return await withGuildTransaction(client, guildId, async (tx) => {
      // O conteúdo vai como texto JSON e é convertido para jsonb pelo próprio parâmetro.
      await tx.query(
        `INSERT INTO bot_private.message_deliveries (guild_id, channel_id, template_name, content, requested_by)
         VALUES ($1, $2, $3, $4::jsonb, $5)`,
        [guildId, channelId, templateName ?? null, hasContent ? JSON.stringify(content) : null, requestedBy],
      );
      return { ok: true };
    });
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'KT002') return { ok: false, code: 'quota' };
    throw error;
  }
}

/** Reivindica os próximos pedidos pendentes, de todos os servidores (o poller
 * é um processo único e confiável; sem filtro por servidor).
 * @param {import('pg').PoolClient} client @param {number} [limit] @returns {Promise<PendingDelivery[]>} */
export async function claimPending(client, limit = 10) {
  return withTransaction(client, async (tx) => {
    const result = await tx.query(
      `SELECT id, guild_id, channel_id, template_name, content, requested_by FROM bot_private.message_deliveries
         WHERE status = 'pending' ORDER BY id LIMIT $1`,
      [limit],
    );
    return result.rows.map((row) => ({
      // `id` é bigint (string no driver pg); convertido para o tipo declarado, mesmo sem bug ativo hoje
      // (só volta ao banco via query parametrizada), para não surpreender quem usar aritmética nele depois.
      id: Number(row.id), guildId: row.guild_id, channelId: row.channel_id, templateName: row.template_name,
      content: row.content, requestedBy: row.requested_by,
    }));
  });
}

/** @param {import('pg').PoolClient} client @param {number} id @returns {Promise<boolean>} */
export async function markSent(client, id) {
  return withTransaction(client, async (tx) => {
    const result = await tx.query(
      "UPDATE bot_private.message_deliveries SET status = 'sent', delivered_at = now() WHERE id = $1 AND status = 'pending'",
      [id],
    );
    return (result.rowCount ?? 0) > 0;
  });
}

/** @param {import('pg').PoolClient} client @param {number} id @param {string} errorCode Código estável, nunca a mensagem crua do Discord.
 * @returns {Promise<boolean>} */
export async function markFailed(client, id, errorCode) {
  return withTransaction(client, async (tx) => {
    const result = await tx.query(
      "UPDATE bot_private.message_deliveries SET status = 'failed', delivered_at = now(), error = $2 WHERE id = $1 AND status = 'pending'",
      [id, errorCode],
    );
    return (result.rowCount ?? 0) > 0;
  });
}
