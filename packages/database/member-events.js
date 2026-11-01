/** Persistência das mensagens de entrada e saída de membros, isoladas em
 * `bot_private.member_event_messages`. Há uma configuração por evento (`join` ou
 * `leave`) e por servidor. O site administra (canal, conteúdo, ignorar bots); o
 * bot só lê.
 * Cada operação abre sua própria transação e nunca concatena identificadores.
 * @typedef {{event: 'join'|'leave', enabled: boolean, channelId: string|null, ignoreBots: boolean, content: unknown, version: number, updatedAt: Date}} MemberEventConfig */

import { withGuildTransaction } from './transaction.js';

/** @param {unknown} error @returns {error is {code: string}} */
function hasCode(error) {
  return error !== null && typeof error === 'object' && 'code' in error && typeof error.code === 'string';
}

/** @param {Record<string, any>} row @returns {MemberEventConfig} */
function toConfig(row) {
  return {
    event: row.event,
    enabled: row.enabled,
    channelId: row.channel_id,
    ignoreBots: row.ignore_bots,
    content: row.content,
    version: row.version,
    updatedAt: row.updated_at,
  };
}

/** @param {import('pg').PoolClient} client @param {string} guildId @param {'join'|'leave'} event @returns {Promise<MemberEventConfig|null>} */
export async function get(client, guildId, event) {
  return withGuildTransaction(client, guildId, async (tx) => {
    const result = await tx.query(
      // A RLS já escopa por servidor; o filtro explícito segue o padrão do resto do projeto.
      `SELECT event, enabled, channel_id, ignore_bots, content, version, updated_at
         FROM bot_private.member_event_messages
        WHERE guild_id = $1 AND event = $2`,
      [guildId, event],
    );
    const row = result.rows[0];
    return row ? toConfig(row) : null;
  });
}

/** Lista as configurações do servidor, sempre na ordem join, leave.
 * @param {import('pg').PoolClient} client @param {string} guildId @returns {Promise<MemberEventConfig[]>} */
export async function list(client, guildId) {
  return withGuildTransaction(client, guildId, async (tx) => {
    const result = await tx.query(
      // 'join' < 'leave' em ordem alfabética, então ORDER BY event já entrega a ordem fixa.
      `SELECT event, enabled, channel_id, ignore_bots, content, version, updated_at
         FROM bot_private.member_event_messages
        WHERE guild_id = $1 ORDER BY event`,
      [guildId],
    );
    return result.rows.map(toConfig);
  });
}

/** Cria (expectedVersion null) ou atualiza a configuração de um evento, com concorrência otimista pela versão.
 * @param {import('pg').PoolClient} client
 * @param {{guildId: string, event: 'join'|'leave', expectedVersion: number|null, enabled: boolean, channelId: string|null, ignoreBots: boolean, content: unknown, actorId: string}} input
 * @returns {Promise<{ok: true, version: number}|{ok: false, code: 'conflict'}>} */
export async function save(client, { guildId, event, expectedVersion, enabled, channelId, ignoreBots, content, actorId }) {
  try {
    return await withGuildTransaction(client, guildId, async (tx) => {
      // O conteúdo vai como texto JSON e é convertido para jsonb pelo próprio parâmetro.
      const json = JSON.stringify(content);
      if (expectedVersion === null) {
        const inserted = await tx.query(
          `INSERT INTO bot_private.member_event_messages (guild_id, event, enabled, channel_id, ignore_bots, content, created_by, updated_by)
           VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $7) RETURNING version`,
          [guildId, event, enabled, channelId, ignoreBots, json, actorId],
        );
        return { ok: true, version: inserted.rows[0].version };
      }
      const result = await tx.query(
        `UPDATE bot_private.member_event_messages
            SET enabled = $3, channel_id = $4, ignore_bots = $5, content = $6::jsonb, updated_by = $7, version = version + 1
          WHERE guild_id = $1 AND event = $2 AND version = $8
          RETURNING version`,
        [guildId, event, enabled, channelId, ignoreBots, json, actorId, expectedVersion],
      );
      // Zero linhas: versão antiga ou evento inexistente.
      if (result.rows.length === 0) return { ok: false, code: 'conflict' };
      return { ok: true, version: result.rows[0].version };
    });
  } catch (error) {
    // Corrida na criação: outra gravação já criou o evento (chave primária duplicada).
    if (hasCode(error) && error.code === '23505') return { ok: false, code: 'conflict' };
    throw error;
  }
}
