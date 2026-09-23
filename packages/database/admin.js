import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { isDiscordId } from './index.js';
/** Run once per release with a migration connection, never with bot credentials.
 * @param {import('pg').Client} client */
export async function migrate(client) {
  await client.query('BEGIN');
  try {
    await client.query("SELECT pg_advisory_xact_lock(146455, 1)");
    await client.query('CREATE SCHEMA IF NOT EXISTS kuruttina_migrations');
    await client.query('REVOKE ALL ON SCHEMA kuruttina_migrations FROM PUBLIC');
    await client.query('CREATE TABLE IF NOT EXISTS kuruttina_migrations.applied (name text PRIMARY KEY, checksum text NOT NULL)');
    const directory = new URL('./supabase/migrations/', import.meta.url);
    for (const name of (await readdir(directory)).filter((entry) => entry.endsWith('.sql')).sort()) {
      const sql = await readFile(new URL(name, directory), 'utf8');
      const checksum = createHash('sha256').update(sql).digest('hex');
      const existing = await client.query('SELECT checksum FROM kuruttina_migrations.applied WHERE name = $1', [name]);
      if (existing.rows.length) {
        if (existing.rows[0].checksum !== checksum) throw new Error('Applied migration checksum mismatch');
        continue;
      }
      await client.query(sql);
      await client.query('INSERT INTO kuruttina_migrations.applied (name, checksum) VALUES ($1, $2)', [name, checksum]);
    }
    await client.query('COMMIT');
  } catch (error) { await client.query('ROLLBACK'); throw error; }
}
/** Initial registration is idempotent, but never overwrites later administrative changes.
 * @param {import('pg').Client} client
 * @param {'development'|'production'} environment
 * @param {{guildId:string, creatorId:string, devId:string}} ids */
export async function initializeAccess(client, environment, ids) {
  if (![ids.guildId, ids.creatorId, ids.devId].every(isDiscordId) || ids.creatorId === ids.devId) throw new Error('Invalid initial IDs');
  if (!['development', 'production'].includes(environment)) throw new Error('Invalid environment');
  await client.query('BEGIN');
  try {
    await client.query('SELECT pg_advisory_xact_lock(146455, 2)');
    await client.query(
      'INSERT INTO bot_private.bot_settings (singleton, dev_guild_id, environment) VALUES (true, $1, $2) ON CONFLICT DO NOTHING',
      [ids.guildId, environment],
    );
    for (const [role, id] of [['creator', ids.creatorId], ['dev', ids.devId]]) {
      await client.query('INSERT INTO bot_private.bot_staff (user_id, role, active) VALUES ($1, $2, true) ON CONFLICT DO NOTHING', [id, role]);
    }
    const settings = await client.query('SELECT dev_guild_id, environment FROM bot_private.bot_settings WHERE singleton');
    const staff = await client.query('SELECT user_id, role, active FROM bot_private.bot_staff ORDER BY role');
    if (settings.rows[0]?.dev_guild_id !== ids.guildId || settings.rows[0]?.environment !== environment ||
        staff.rows.length !== 2 || staff.rows[0]?.user_id !== ids.creatorId || staff.rows[1]?.user_id !== ids.devId ||
        staff.rows.some((row) => row.active !== true)) throw new Error('Existing registration differs; use an explicit administrative update');
    await client.query('COMMIT');
  } catch (error) { await client.query('ROLLBACK'); throw error; }
}
