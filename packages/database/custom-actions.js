/** Persistência de ações personalizadas por servidor, isoladas em `bot_private.custom_buttons`
 * (botões) e `bot_private.custom_selects` (menus de seleção). Uma ação é metadado do app: só
 * guarda o nome. O site administra (criar, listar, apagar); o bot só lê.
 * Cada operação abre sua própria transação. A tabela vem de uma allowlist fixa por `kind`;
 * nenhuma entrada do usuário entra no SQL como identificador.
 * @typedef {'buttons'|'selects'} CustomActionKind
 * @typedef {{id: number, name: string, version: number, createdAt: Date, updatedAt: Date}} CustomAction
 * @typedef {(content: unknown, kind: 'button'|'select', id: number) => {content: unknown, changed: boolean}} RewriteTemplate */

import { withGuildTransaction } from './transaction.js';

/** Tabela, constraint de nome e código de cota (trigger KT007 para botões, KT008 para menus) de cada tipo. */
const KINDS = Object.freeze({
  buttons: Object.freeze({ table: 'bot_private.custom_buttons', nameConstraint: 'custom_buttons_guild_id_name_key' }),
  selects: Object.freeze({ table: 'bot_private.custom_selects', nameConstraint: 'custom_selects_guild_id_name_key' }),
});
const QUOTA_CODES = new Set(['KT007', 'KT008']);

/** @param {unknown} error @returns {error is {code: string, constraint?: string}} */
function hasCode(error) {
  return error !== null && typeof error === 'object' && 'code' in error && typeof error.code === 'string';
}

/** Resolve o tipo pela allowlist. Qualquer outro valor é erro de programação, não de entrada. @param {CustomActionKind} kind */
function kindConfig(kind) {
  if (!Object.hasOwn(KINDS, kind)) throw new Error('Invalid custom action kind');
  return KINDS[kind];
}

/** @param {import('pg').PoolClient} client @param {CustomActionKind} kind @param {string} guildId @returns {Promise<CustomAction[]>} */
export async function list(client, kind, guildId) {
  const { table } = kindConfig(kind);
  return withGuildTransaction(client, guildId, async (tx) => {
    // A RLS já escopa por servidor; o filtro explícito segue o padrão do resto do projeto.
    const result = await tx.query(
      `SELECT id, name, version, created_at, updated_at FROM ${table}
        WHERE guild_id = $1 ORDER BY name`,
      [guildId],
    );
    return result.rows.map((row) => ({
      id: Number(row.id),
      name: row.name,
      version: row.version,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  });
}

/** @param {import('pg').PoolClient} client
 * @param {{kind: CustomActionKind, guildId: string, name: string, actorId: string}} input
 * @returns {Promise<{ok: true, id: number, version: number}|{ok: false, code: 'quota'|'duplicate'}>} */
export async function create(client, { kind, guildId, name, actorId }) {
  const { table, nameConstraint } = kindConfig(kind);
  try {
    return await withGuildTransaction(client, guildId, async (tx) => {
      const inserted = await tx.query(
        `INSERT INTO ${table} (guild_id, name, created_by, updated_by)
         VALUES ($1, $2, $3, $3) RETURNING id, version`,
        [guildId, name, actorId],
      );
      const row = inserted.rows[0];
      return { ok: true, id: Number(row.id), version: row.version };
    });
  } catch (error) {
    if (hasCode(error)) {
      if (QUOTA_CODES.has(error.code)) return { ok: false, code: 'quota' };
      if (error.code === '23505' && error.constraint === nameConstraint) return { ok: false, code: 'duplicate' };
    }
    throw error;
  }
}

/** Tipo do Component como o template o referencia (`unlinkComponent` de `@kuruttina/message-templates`). */
const TEMPLATE_COMPONENT_KIND = Object.freeze({ buttons: 'button', selects: 'select' });

/**
 * Apaga a ação e, na mesma transação, tira a referência dela dos templates do servidor (`rewriteTemplate`).
 * `rewriteTemplate` é injetada pelo chamador para não criar dependência entre pacotes; sem ela, só apaga.
 * `actorId` é quem apaga e vai para `updated_by` dos templates reescritos (obrigatório quando há `rewriteTemplate`).
 * @param {import('pg').PoolClient} client
 * @param {CustomActionKind} kind
 * @param {string} guildId
 * @param {number} id
 * @param {RewriteTemplate} [rewriteTemplate]
 * @param {string} [actorId]
 * @returns {Promise<{removed: boolean, unlinked: number}>}
 */
export async function remove(client, kind, guildId, id, rewriteTemplate, actorId) {
  const { table } = kindConfig(kind);
  if (rewriteTemplate !== undefined && actorId === undefined) throw new Error('actorId is required to rewrite templates');
  return withGuildTransaction(client, guildId, async (tx) => {
    const result = await tx.query(`DELETE FROM ${table} WHERE guild_id = $1 AND id = $2`, [guildId, id]);
    if ((result.rowCount ?? 0) === 0) return { removed: false, unlinked: 0 };
    if (rewriteTemplate === undefined) return { removed: true, unlinked: 0 };
    // Pré-filtro barato: todo template que aponta para um menu tem `"component"` (o menu exige o componente).
    // FOR UPDATE segura as linhas até o fim da transação, para uma edição concorrente não ser sobrescrita.
    const templates = await tx.query(
      `SELECT name, version, content FROM bot_private.message_templates
        WHERE guild_id = $1 AND content::text LIKE '%"component"%' FOR UPDATE`,
      [guildId],
    );
    let unlinked = 0;
    for (const row of templates.rows) {
      const rewritten = rewriteTemplate(row.content, TEMPLATE_COMPONENT_KIND[kind], id);
      if (!rewritten.changed) continue;
      await tx.query(
        `UPDATE bot_private.message_templates
            SET content = $3::jsonb, version = version + 1, updated_by = $4
          WHERE guild_id = $1 AND name = $2`,
        [guildId, row.name, JSON.stringify(rewritten.content), actorId],
      );
      unlinked += 1;
    }
    return { removed: true, unlinked };
  });
}
