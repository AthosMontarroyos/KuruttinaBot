/** Persistência de templates de mensagem (etapa 1C) e do mapa de ações dos
 * seus componentes (etapa 1D), isolados em `bot_private.message_templates` e
 * `bot_private.message_components`. Cada operação abre sua própria transação,
 * define `app.guild_id` como primeiro comando dentro dela (para a RLS por
 * servidor valer) e nunca concatena identificadores. */

import { withGuildTransaction } from './transaction.js';

/** @typedef {{name: string, buttonCount: number, menuCount: number, version: number, updatedAt: Date, folderId: number|null, folderName: string|null}} TemplateSummary
 * @typedef {{name: string, content: unknown, buttonCount: number, menuCount: number, version: number, createdBy: string, updatedBy: string, createdAt: Date, updatedAt: Date, folderId: number|null, folderName: string|null}} TemplateDetail
 * @typedef {{customId: string, kind: 'button'|'select_option', action: unknown}} ComponentInput */

/** `folder_id` é bigint: o driver pg devolve como string por padrão. Converte aqui
 * (preservando `null`), porque o resto do código trata `folderId` como `number|null`.
 * @param {string|null} value @returns {number|null} */
function toFolderId(value) {
  return value === null ? null : Number(value);
}

/** Nome das constraints UNIQUE que distinguem nome de template duplicado de
 * custom_id duplicado, ambos reportados pelo driver como `23505`. */
const TEMPLATE_NAME_UNIQUE_CONSTRAINT = 'message_templates_guild_id_name_key';
const COMPONENT_CUSTOM_ID_UNIQUE_CONSTRAINT = 'message_components_guild_id_custom_id_key';

/** Grava o conjunto de componentes (ação por custom_id) de um template, dentro
 * da transação já aberta pelo chamador.
 * @param {import('pg').PoolClient} client @param {string} guildId @param {number} templateId @param {readonly ComponentInput[]} components */
async function insertComponents(client, guildId, templateId, components) {
  for (const component of components) {
    await client.query(
      `INSERT INTO bot_private.message_components (guild_id, template_id, custom_id, kind, action)
         VALUES ($1, $2, $3, $4, $5::jsonb)`,
      [guildId, templateId, component.customId, component.kind, JSON.stringify(component.action)],
    );
  }
}

/** @param {unknown} error @returns {error is {code: string, constraint?: string}} */
function hasCode(error) {
  return error !== null && typeof error === 'object' && 'code' in error && typeof error.code === 'string';
}

/** @param {import('pg').PoolClient} client @param {string} guildId @param {{limit?: number, after?: string}} [options]
 * @returns {Promise<TemplateSummary[]>} */
export async function list(client, guildId, { limit = 25, after } = {}) {
  if (limit > 25) throw new Error('limit must not exceed 25');
  return withGuildTransaction(client, guildId, async (tx) => {
    const result = await tx.query(
      after === undefined
        ? `SELECT message_templates.name, message_templates.button_count, message_templates.menu_count, message_templates.version, message_templates.updated_at,
                  folder.id AS folder_id, folder.name AS folder_name
             FROM bot_private.message_templates
             LEFT JOIN bot_private.message_template_folders AS folder ON folder.id = message_templates.folder_id
            ORDER BY message_templates.name LIMIT $1`
        : `SELECT message_templates.name, message_templates.button_count, message_templates.menu_count, message_templates.version, message_templates.updated_at,
                  folder.id AS folder_id, folder.name AS folder_name
             FROM bot_private.message_templates
             LEFT JOIN bot_private.message_template_folders AS folder ON folder.id = message_templates.folder_id
            WHERE message_templates.name > $2 ORDER BY message_templates.name LIMIT $1`,
      after === undefined ? [limit] : [limit, after],
    );
    return result.rows.map((row) => ({
      name: row.name, buttonCount: row.button_count, menuCount: row.menu_count, version: row.version, updatedAt: row.updated_at,
      folderId: toFolderId(row.folder_id), folderName: row.folder_name,
    }));
  });
}

/** @param {import('pg').PoolClient} client @param {string} guildId @param {string} name
 * @returns {Promise<TemplateDetail|null>} */
export async function get(client, guildId, name) {
  return withGuildTransaction(client, guildId, async (tx) => {
    const result = await tx.query(
      `SELECT message_templates.name, message_templates.content, message_templates.button_count, message_templates.menu_count,
              message_templates.version, message_templates.created_by, message_templates.updated_by,
              message_templates.created_at, message_templates.updated_at,
              folder.id AS folder_id, folder.name AS folder_name
         FROM bot_private.message_templates
         LEFT JOIN bot_private.message_template_folders AS folder ON folder.id = message_templates.folder_id
        WHERE message_templates.name = $1`,
      [name],
    );
    const row = result.rows[0];
    if (!row) return null;
    return {
      name: row.name, content: row.content, buttonCount: row.button_count, menuCount: row.menu_count, version: row.version,
      createdBy: row.created_by, updatedBy: row.updated_by, createdAt: row.created_at, updatedAt: row.updated_at,
      folderId: toFolderId(row.folder_id), folderName: row.folder_name,
    };
  });
}

/** Conteúdo do template para o bot. Não consulta pastas: `kuruttina_bot` não tem GRANT nessa tabela.
 * @param {import('pg').PoolClient} client @param {string} guildId @param {string} name
 * @returns {Promise<{content: unknown}|null>} */
export async function getContent(client, guildId, name) {
  return withGuildTransaction(client, guildId, async (tx) => {
    const result = await tx.query(
      `SELECT content FROM bot_private.message_templates WHERE name = $1`,
      [name],
    );
    const row = result.rows[0];
    return row ? { content: row.content } : null;
  });
}

/** @param {import('pg').PoolClient} client @param {string} guildId
 * @returns {Promise<{templates: number, buttons: number, menus: number}>} */
export async function usage(client, guildId) {
  return withGuildTransaction(client, guildId, async (tx) => {
    const result = await tx.query(
      `SELECT count(*) AS templates, coalesce(sum(button_count), 0) AS buttons, coalesce(sum(menu_count), 0) AS menus
         FROM bot_private.message_templates`,
    );
    const row = result.rows[0];
    return { templates: Number(row.templates), buttons: Number(row.buttons), menus: Number(row.menus) };
  });
}

/** @param {import('pg').PoolClient} client
 * @param {{guildId: string, name: string, content: unknown, buttonCount: number, menuCount: number, components?: readonly ComponentInput[], actorId: string, folderId?: number|null|undefined}} input
 * @returns {Promise<{ok: true}|{ok: false, code: 'duplicate'|'duplicate_custom_id'|'quota'|'invalid_folder'}>} */
export async function create(client, { guildId, name, content, buttonCount, menuCount, components, actorId, folderId }) {
  try {
    return await withGuildTransaction(client, guildId, async (tx) => {
      const inserted = await tx.query(
        `INSERT INTO bot_private.message_templates (guild_id, name, content, button_count, menu_count, created_by, updated_by, folder_id)
         VALUES ($1, $2, $3::jsonb, $4, $5, $6, $6, $7) RETURNING id`,
        [guildId, name, JSON.stringify(content), buttonCount, menuCount, actorId, folderId ?? null],
      );
      await insertComponents(tx, guildId, inserted.rows[0].id, components ?? []);
      return { ok: true };
    });
  } catch (error) {
    if (hasCode(error)) {
      if (error.code === '23505') {
        return { ok: false, code: error.constraint === COMPONENT_CUSTOM_ID_UNIQUE_CONSTRAINT ? 'duplicate_custom_id' : 'duplicate' };
      }
      if (error.code === 'KT001') return { ok: false, code: 'quota' };
      // KT004: pasta de outro servidor; 23503: pasta inexistente.
      if (error.code === 'KT004' || error.code === '23503') return { ok: false, code: 'invalid_folder' };
    }
    throw error;
  }
}

/** @param {import('pg').PoolClient} client
 * @param {{guildId: string, name: string, expectedVersion: number, content: unknown, buttonCount: number, menuCount: number, components?: readonly ComponentInput[], actorId: string, folderId?: number|null|undefined}} input
 * @returns {Promise<{ok: true, version: number}|{ok: false, code: 'not_found'|'conflict'|'quota'|'duplicate_custom_id'|'invalid_folder'}>} */
export async function update(client, { guildId, name, expectedVersion, content, buttonCount, menuCount, components, actorId, folderId }) {
  try {
    return await withGuildTransaction(client, guildId, async (tx) => {
      const result = await tx.query(
        `UPDATE bot_private.message_templates
          SET content = $3::jsonb, button_count = $4, menu_count = $5, updated_by = $6, version = version + 1, folder_id = $8
        WHERE guild_id = $1 AND name = $2 AND version = $7
        RETURNING id, version`,
        [guildId, name, JSON.stringify(content), buttonCount, menuCount, actorId, expectedVersion, folderId ?? null],
      );
      if (result.rows.length === 0) {
        const existing = await tx.query('SELECT 1 FROM bot_private.message_templates WHERE guild_id = $1 AND name = $2', [guildId, name]);
        return { ok: false, code: existing.rows.length === 0 ? 'not_found' : 'conflict' };
      }
      // Reescreve o conjunto inteiro de componentes: mais simples que calcular o diff.
      await tx.query('DELETE FROM bot_private.message_components WHERE template_id = $1', [result.rows[0].id]);
      await insertComponents(tx, guildId, result.rows[0].id, components ?? []);
      return { ok: true, version: result.rows[0].version };
    });
  } catch (error) {
    if (hasCode(error)) {
      if (error.code === 'KT001') return { ok: false, code: 'quota' };
      if (error.code === '23505' && error.constraint === COMPONENT_CUSTOM_ID_UNIQUE_CONSTRAINT) {
        return { ok: false, code: 'duplicate_custom_id' };
      }
      if (error.code === 'KT004' || error.code === '23503') return { ok: false, code: 'invalid_folder' };
    }
    throw error;
  }
}

/** Move um template para outra pasta (ou desarquiva, com `folderId: null`), sem
 * mexer no conteúdo nem na versão: é metadado de organização, não parte da mensagem.
 * @param {import('pg').PoolClient} client @param {string} guildId @param {string} name @param {number|null} folderId
 * @returns {Promise<{ok: true}|{ok: false, code: 'not_found'|'invalid_folder'}>} */
export async function move(client, guildId, name, folderId) {
  try {
    return await withGuildTransaction(client, guildId, async (tx) => {
      const result = await tx.query(
        'UPDATE bot_private.message_templates SET folder_id = $3 WHERE guild_id = $1 AND name = $2',
        [guildId, name, folderId],
      );
      return (result.rowCount ?? 0) > 0 ? { ok: true } : { ok: false, code: 'not_found' };
    });
  } catch (error) {
    if (hasCode(error) && (error.code === 'KT004' || error.code === '23503')) return { ok: false, code: 'invalid_folder' };
    throw error;
  }
}

/** Resolve o custom_id clicado (botão ou opção de menu) na ação a executar.
 * @param {import('pg').PoolClient} client @param {string} guildId @param {string} customId
 * @returns {Promise<{kind: 'button'|'select_option', action: unknown}|null>} */
export async function findComponent(client, guildId, customId) {
  return withGuildTransaction(client, guildId, async (tx) => {
    const result = await tx.query(
      'SELECT kind, action FROM bot_private.message_components WHERE guild_id = $1 AND custom_id = $2',
      [guildId, customId],
    );
    const row = result.rows[0];
    if (!row) return null;
    return { kind: row.kind, action: row.action };
  });
}

/** @param {import('pg').PoolClient} client @param {string} guildId @param {string} name @returns {Promise<boolean>} */
export async function remove(client, guildId, name) {
  return withGuildTransaction(client, guildId, async (tx) => {
    const result = await tx.query('DELETE FROM bot_private.message_templates WHERE guild_id = $1 AND name = $2', [guildId, name]);
    return (result.rowCount ?? 0) > 0;
  });
}
