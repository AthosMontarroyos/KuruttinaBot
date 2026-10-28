/** Fila de entrega de mensagens (etapa 1D), isolada em `bot_private.message_deliveries`.
 * O site só insere e lê o próprio servidor; o bot lê a fila inteira (sem
 * `app.guild_id`, pela policy `message_deliveries_bot_poll`) e atualiza o
 * status. Cada operação abre e fecha sua própria transação.
 * @typedef {{id: number, guildId: string, channelId: string, templateName: string}} PendingDelivery */

/** @param {import('pg').PoolClient} client @param {string} guildId */
async function withGuild(client, guildId) {
  await client.query('BEGIN');
  await client.query("SELECT set_config('app.guild_id', $1, true)", [guildId]);
}

/** Pede o envio de um template a um canal. Respeita a cota de 20 pendências por servidor.
 * @param {import('pg').PoolClient} client
 * @param {{guildId: string, channelId: string, templateName: string, requestedBy: string}} input
 * @returns {Promise<{ok: true}|{ok: false, code: 'quota'}>} */
export async function create(client, { guildId, channelId, templateName, requestedBy }) {
  await withGuild(client, guildId);
  try {
    await client.query(
      `INSERT INTO bot_private.message_deliveries (guild_id, channel_id, template_name, requested_by)
         VALUES ($1, $2, $3, $4)`,
      [guildId, channelId, templateName, requestedBy],
    );
    await client.query('COMMIT');
    return { ok: true };
  } catch (error) {
    await client.query('ROLLBACK');
    if (error && typeof error === 'object' && 'code' in error && error.code === 'KT002') return { ok: false, code: 'quota' };
    throw error;
  }
}

/** Reivindica os próximos pedidos pendentes, de todos os servidores (o poller
 * é um processo único e confiável; sem filtro por servidor).
 * @param {import('pg').PoolClient} client @param {number} [limit] @returns {Promise<PendingDelivery[]>} */
export async function claimPending(client, limit = 10) {
  await client.query('BEGIN');
  try {
    const result = await client.query(
      `SELECT id, guild_id, channel_id, template_name FROM bot_private.message_deliveries
         WHERE status = 'pending' ORDER BY id LIMIT $1`,
      [limit],
    );
    await client.query('COMMIT');
    return result.rows.map((row) => ({
      // `id` é bigint (string no driver pg); convertido para o tipo declarado, mesmo sem bug ativo hoje
      // (só volta ao banco via query parametrizada), para não surpreender quem usar aritmética nele depois.
      id: Number(row.id), guildId: row.guild_id, channelId: row.channel_id, templateName: row.template_name,
    }));
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

/** @param {import('pg').PoolClient} client @param {number} id @returns {Promise<boolean>} */
export async function markSent(client, id) {
  await client.query('BEGIN');
  try {
    const result = await client.query(
      "UPDATE bot_private.message_deliveries SET status = 'sent', delivered_at = now() WHERE id = $1 AND status = 'pending'",
      [id],
    );
    await client.query('COMMIT');
    return (result.rowCount ?? 0) > 0;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

/** @param {import('pg').PoolClient} client @param {number} id @param {string} errorCode Código estável, nunca a mensagem crua do Discord.
 * @returns {Promise<boolean>} */
export async function markFailed(client, id, errorCode) {
  await client.query('BEGIN');
  try {
    const result = await client.query(
      "UPDATE bot_private.message_deliveries SET status = 'failed', delivered_at = now(), error = $2 WHERE id = $1 AND status = 'pending'",
      [id, errorCode],
    );
    await client.query('COMMIT');
    return (result.rowCount ?? 0) > 0;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}
