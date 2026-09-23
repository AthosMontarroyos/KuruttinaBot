import pg from 'pg';
export { readDatabaseConfig } from './config.js';
/** @typedef {'creator'|'dev'} StaffRole */
/** @typedef {{devGuildId: string, environment: 'development'|'production'}} BotSettings */
const snowflake = /^[1-9]\d{16,19}$/u;
/** @param {unknown} value */
export function isDiscordId(value) {
  return typeof value === 'string' && snowflake.test(value) && BigInt(value) <= 18446744073709551615n;
}
/** @param {import('pg').PoolConfig} config @param {'development'|'production'} environment @param {() => void} [onError] */
export function createDatabase(config, environment, onError = () => {}) {
  const pool = new pg.Pool({ ...config, max: 3, idleTimeoutMillis: 30000, connectionTimeoutMillis: 5000 });
  pool.on('error', () => onError());
  let closing = false;
  // Bound admitted work as well as connections, so an outage cannot grow the queue indefinitely.
  let pending = 0;
  /** @template T @param {(client: import('pg').PoolClient) => Promise<T>} work */
  async function connection(work) {
    if (closing || pending >= 12) throw new Error('Database unavailable');
    pending++;
    let client;
    try {
      client = await pool.connect();
      return await work(client);
    } catch (error) {
      onError();
      client?.release(true);
      client = undefined;
      throw error;
    } finally {
      client?.release();
      pending--;
    }
  }
  /** @param {import('pg').PoolClient} client @returns {Promise<BotSettings>} */
  async function settings(client) {
    const result = await client.query('SELECT dev_guild_id, environment FROM bot_private.bot_settings WHERE singleton = true');
    const row = result.rows[0];
    if (result.rows.length !== 1 || !isDiscordId(row?.dev_guild_id) || row?.environment !== environment) {
      throw new Error('Invalid database settings or environment');
    }
    return { devGuildId: row.dev_guild_id, environment };
  }
  return {
    getSettings: () => connection(settings),
    /** @param {string} userId @param {string} guildId @returns {Promise<StaffRole|null>} */
    getStaffRole: async (userId, guildId) => {
      if (!isDiscordId(userId) || !isDiscordId(guildId)) return null;
      return connection(async (client) => {
        await client.query('BEGIN READ ONLY');
        try {
          await client.query("SELECT set_config('app.discord_user_id', $1, true), set_config('app.guild_id', $2, true)", [userId, guildId]);
          const result = await client.query(
            `SELECT staff.role FROM bot_private.bot_staff AS staff
             JOIN bot_private.bot_settings AS settings ON settings.singleton = true
             WHERE staff.user_id = $1 AND staff.active = true
               AND settings.dev_guild_id = $2 AND settings.environment = $3`,
            [userId, guildId, environment],
          );
          const role = result.rows[0]?.role;
          if (result.rows.length > 1 || (role !== undefined && role !== 'creator' && role !== 'dev')) {
            throw new Error('Invalid staff role');
          }
          await client.query('COMMIT');
          return role ?? null;
        } catch (error) {
          try { await client.query('ROLLBACK'); } catch { /* connection() destroys the failed connection. */ }
          throw error;
        }
      });
    },
    close: async () => { closing = true; await pool.end(); },
  };
}
