/** Persistência de grupos de cargos, isolados em `bot_private.role_groups` e
 * `bot_private.role_group_roles`. Um grupo é metadado do app, não um cargo do
 * Discord: só guarda nome e a lista ordenada de IDs de cargos do próprio
 * servidor. O site administra (criar, editar, apagar); o bot só lê.
 * Cada operação abre sua própria transação e nunca concatena identificadores.
 * @typedef {{id: number, name: string, version: number, roleIds: string[], createdAt: Date, updatedAt: Date}} RoleGroup */

import { withGuildTransaction } from './transaction.js';

/** Nomes das constraints UNIQUE usadas para distinguir duplicidades (ambas `23505`). */
const GROUP_NAME_UNIQUE_CONSTRAINT = 'role_groups_guild_id_name_key';
const GROUP_ROLE_PRIMARY_KEY = 'role_group_roles_pkey';

/** @param {unknown} error @returns {error is {code: string, constraint?: string}} */
function hasCode(error) {
  return error !== null && typeof error === 'object' && 'code' in error && typeof error.code === 'string';
}

/** Grava os cargos do grupo na ordem recebida, dentro da transação do chamador.
 * @param {import('pg').PoolClient} client @param {string} guildId @param {number} groupId @param {readonly string[]} roleIds */
async function insertRoles(client, guildId, groupId, roleIds) {
  for (const [position, roleId] of roleIds.entries()) {
    await client.query(
      'INSERT INTO bot_private.role_group_roles (group_id, guild_id, role_id, position) VALUES ($1, $2, $3, $4)',
      [groupId, guildId, roleId, position],
    );
  }
}

/** @param {import('pg').PoolClient} client @param {string} guildId @returns {Promise<RoleGroup[]>} */
export async function list(client, guildId) {
  return withGuildTransaction(client, guildId, async (tx) => {
    const groups = await tx.query(
      // A RLS já escopa por servidor; o filtro explícito segue o padrão do resto do projeto.
      `SELECT id, name, version, created_at, updated_at FROM bot_private.role_groups
        WHERE guild_id = $1 ORDER BY name`,
      [guildId],
    );
    const roles = await tx.query(
      'SELECT group_id, role_id FROM bot_private.role_group_roles WHERE guild_id = $1 ORDER BY group_id, position',
      [guildId],
    );
    const rolesByGroup = new Map();
    for (const row of roles.rows) {
      const key = Number(row.group_id);
      rolesByGroup.set(key, [...(rolesByGroup.get(key) ?? []), row.role_id]);
    }
    return groups.rows.map((row) => ({
      id: Number(row.id),
      name: row.name,
      version: row.version,
      roleIds: rolesByGroup.get(Number(row.id)) ?? [],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  });
}

/** @param {import('pg').PoolClient} client
 * @param {{guildId: string, name: string, roleIds: readonly string[], actorId: string}} input
 * @returns {Promise<{ok: true, id: number}|{ok: false, code: 'quota'|'duplicate'|'duplicate_role'}>} */
export async function create(client, { guildId, name, roleIds, actorId }) {
  try {
    return await withGuildTransaction(client, guildId, async (tx) => {
      const inserted = await tx.query(
        `INSERT INTO bot_private.role_groups (guild_id, name, created_by, updated_by)
         VALUES ($1, $2, $3, $3) RETURNING id`,
        [guildId, name, actorId],
      );
      const id = Number(inserted.rows[0].id);
      await insertRoles(tx, guildId, id, roleIds);
      return { ok: true, id };
    });
  } catch (error) {
    if (hasCode(error)) {
      if (error.code === 'KT006') return { ok: false, code: 'quota' };
      if (error.code === '23505') {
        return { ok: false, code: error.constraint === GROUP_ROLE_PRIMARY_KEY ? 'duplicate_role' : 'duplicate' };
      }
    }
    throw error;
  }
}

/** Substitui nome e cargos de um grupo, com concorrência otimista pela versão.
 * @param {import('pg').PoolClient} client
 * @param {{guildId: string, id: number, expectedVersion: number, name: string, roleIds: readonly string[], actorId: string}} input
 * @returns {Promise<{ok: true, version: number}|{ok: false, code: 'not_found'|'conflict'|'duplicate'|'duplicate_role'}>} */
export async function update(client, { guildId, id, expectedVersion, name, roleIds, actorId }) {
  try {
    return await withGuildTransaction(client, guildId, async (tx) => {
      const result = await tx.query(
        `UPDATE bot_private.role_groups
            SET name = $4, updated_by = $5, version = version + 1
          WHERE guild_id = $1 AND id = $2 AND version = $3
          RETURNING version`,
        [guildId, id, expectedVersion, name, actorId],
      );
      if (result.rows.length === 0) {
        const existing = await tx.query('SELECT 1 FROM bot_private.role_groups WHERE guild_id = $1 AND id = $2', [guildId, id]);
        return { ok: false, code: existing.rows.length === 0 ? 'not_found' : 'conflict' };
      }
      // Reescreve a lista inteira de cargos: mais simples que calcular o diff, como em templates.js.
      await tx.query('DELETE FROM bot_private.role_group_roles WHERE group_id = $1', [id]);
      await insertRoles(tx, guildId, id, roleIds);
      return { ok: true, version: result.rows[0].version };
    });
  } catch (error) {
    if (hasCode(error) && error.code === '23505') {
      return { ok: false, code: error.constraint === GROUP_ROLE_PRIMARY_KEY ? 'duplicate_role' : 'duplicate' };
    }
    throw error;
  }
}

/** @param {import('pg').PoolClient} client @param {string} guildId @param {number} id @returns {Promise<boolean>} */
export async function remove(client, guildId, id) {
  return withGuildTransaction(client, guildId, async (tx) => {
    const result = await tx.query('DELETE FROM bot_private.role_groups WHERE guild_id = $1 AND id = $2', [guildId, id]);
    return (result.rowCount ?? 0) > 0;
  });
}
