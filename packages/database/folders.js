/** Persistência de pastas de templates de mensagem, isoladas em
 * `bot_private.message_template_folders`. Só o site administra (criar,
 * renomear, apagar); o bot nunca lê nem escreve esta tabela. Cada operação
 * abre e fecha sua própria transação, no mesmo padrão de `templates.js`.
 * @typedef {{id: number, name: string, createdAt: Date}} FolderSummary */

/** @param {import('pg').PoolClient} client @param {string} guildId */
async function withGuild(client, guildId) {
  await client.query('BEGIN');
  await client.query("SELECT set_config('app.guild_id', $1, true)", [guildId]);
}

/** @param {import('pg').PoolClient} client @param {{guildId: string, name: string}} input
 * @returns {Promise<{ok: true, id: number}|{ok: false, code: 'quota'|'duplicate'}>} */
export async function create(client, { guildId, name }) {
  await withGuild(client, guildId);
  try {
    const result = await client.query(
      'INSERT INTO bot_private.message_template_folders (guild_id, name) VALUES ($1, $2) RETURNING id',
      [guildId, name],
    );
    await client.query('COMMIT');
    // `id` é bigint: o driver pg devolve como string por padrão (evita perder precisão). Converte aqui, uma vez,
    // porque a API HTTP e o formulário do site tratam `folderId` como `number` em todo o resto do código.
    return { ok: true, id: Number(result.rows[0].id) };
  } catch (error) {
    await client.query('ROLLBACK');
    if (error && typeof error === 'object' && 'code' in error) {
      if (error.code === 'KT003') return { ok: false, code: 'quota' };
      if (error.code === '23505') return { ok: false, code: 'duplicate' };
    }
    throw error;
  }
}

/** @param {import('pg').PoolClient} client @param {string} guildId @returns {Promise<FolderSummary[]>} */
export async function list(client, guildId) {
  await withGuild(client, guildId);
  try {
    const result = await client.query(
      // A RLS já escopa por servidor; o filtro explícito segue o padrão do resto do projeto.
      'SELECT id, name, created_at FROM bot_private.message_template_folders WHERE guild_id = $1 ORDER BY name',
      [guildId],
    );
    await client.query('COMMIT');
    return result.rows.map((row) => ({ id: Number(row.id), name: row.name, createdAt: row.created_at }));
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

/** @param {import('pg').PoolClient} client @param {{guildId: string, id: number, name: string}} input
 * @returns {Promise<{ok: true}|{ok: false, code: 'not_found'|'duplicate'}>} */
export async function rename(client, { guildId, id, name }) {
  await withGuild(client, guildId);
  try {
    const result = await client.query(
      'UPDATE bot_private.message_template_folders SET name = $3 WHERE guild_id = $1 AND id = $2',
      [guildId, id, name],
    );
    await client.query('COMMIT');
    return (result.rowCount ?? 0) > 0 ? { ok: true } : { ok: false, code: 'not_found' };
  } catch (error) {
    await client.query('ROLLBACK');
    if (error && typeof error === 'object' && 'code' in error && error.code === '23505') {
      return { ok: false, code: 'duplicate' };
    }
    throw error;
  }
}

/** @param {import('pg').PoolClient} client @param {string} guildId @param {number} id @returns {Promise<boolean>} */
export async function remove(client, guildId, id) {
  await withGuild(client, guildId);
  try {
    const result = await client.query(
      'DELETE FROM bot_private.message_template_folders WHERE guild_id = $1 AND id = $2',
      [guildId, id],
    );
    await client.query('COMMIT');
    return (result.rowCount ?? 0) > 0;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}
