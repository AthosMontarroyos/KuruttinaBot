/**
 * Transação curta. O trabalho não deve fazer chamadas externas.
 * Se o ROLLBACK falhar, o erro original continua sendo o que propaga:
 * `connection()` destrói a conexão que falhou.
 * @template T
 * @param {import('pg').PoolClient} client
 * @param {(client: import('pg').PoolClient) => Promise<T>} work
 * @returns {Promise<T>}
 */
async function runTransaction(client, work) {
  try {
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      /* connection() destrói a conexão que falhou. */
    }
    throw error;
  }
}

/**
 * Transação com `app.guild_id` local, para a RLS por servidor valer.
 * @template T
 * @param {import('pg').PoolClient} client
 * @param {string} guildId
 * @param {(client: import('pg').PoolClient) => Promise<T>} work
 * @returns {Promise<T>}
 */
export async function withGuildTransaction(client, guildId, work) {
  await client.query('BEGIN');
  return runTransaction(client, async (tx) => {
    await tx.query("SELECT set_config('app.guild_id', $1, true)", [guildId]);
    return work(tx);
  });
}

/**
 * Transação sem contexto de servidor (fila global do bot).
 * @template T
 * @param {import('pg').PoolClient} client
 * @param {(client: import('pg').PoolClient) => Promise<T>} work
 * @returns {Promise<T>}
 */
export async function withTransaction(client, work) {
  await client.query('BEGIN');
  return runTransaction(client, work);
}
