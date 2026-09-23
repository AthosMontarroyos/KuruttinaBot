import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createDatabase } from '@kuruttina/database';
import { initializeAccess, migrate } from '@kuruttina/database/admin';

const host = process.env.KURUTTINA_TEST_POSTGRES_HOST;
const ids = { guildId: '1422623678205657160', creatorId: '666948364507545600', devId: '1509331533348212808' };
describe.skipIf(!host)('PostgreSQL runtime isolation', () => {
  const admin = new pg.Client({ host, database: 'postgres', user: 'postgres' });
  const runtime = new pg.Client({ host, database: 'postgres', user: 'kuruttina_bot' });
  const database = createDatabase({ host, database: 'postgres', user: 'kuruttina_bot' }, 'development');

  beforeAll(async () => {
    if (!host?.startsWith('/tmp/kuruttina-postgres.')) throw new Error('Only disposable test clusters are allowed');
    await admin.connect();
    await migrate(admin);
    await migrate(admin);
    await initializeAccess(admin, 'development', ids);
    await initializeAccess(admin, 'development', ids);
    await runtime.connect();
  });
  afterAll(async () => { await Promise.allSettled([admin.end(), runtime.end(), database.close()]); });

  it('loads the singleton, validates environment and queries both roles', async () => {
    expect(await database.getSettings()).toEqual({ devGuildId: ids.guildId, environment: 'development' });
    expect(await database.getStaffRole(ids.creatorId, ids.guildId)).toBe('creator');
    expect(await database.getStaffRole(ids.devId, ids.guildId)).toBe('dev');
    const report = vi.fn();
    const wrong = createDatabase({ host, database: 'postgres', user: 'kuruttina_bot' }, 'production', report);
    try {
      await expect(wrong.getSettings()).rejects.toThrow('environment');
      expect(report).toHaveBeenCalledExactlyOnceWith({ operation: 'get_settings', stage: 'validate_settings', errorCode: 'ENVIRONMENT_MISMATCH', reason: 'environment_mismatch' });
      expect(await wrong.getStaffRole(ids.creatorId, ids.guildId)).toBeNull();
    } finally { await wrong.close(); }
  });
  it('denies absent, wrong, forged and cross-guild identities', async () => {
    for (const user of ['', '123456789012345678', "' OR true --"]) expect(await database.getStaffRole(user, ids.guildId)).toBeNull();
    expect(await database.getStaffRole(ids.creatorId, '123456789012345678')).toBeNull();
    expect((await runtime.query('SELECT * FROM bot_private.bot_staff')).rows).toEqual([]);
    await runtime.query('BEGIN');
    try {
      await runtime.query("SELECT set_config('app.discord_user_id', $1, true), set_config('app.guild_id', $2, true)", [ids.devId, ids.guildId]);
      expect((await runtime.query('SELECT user_id FROM bot_private.bot_staff')).rows).toEqual([{ user_id: ids.devId }]);
    } finally { await runtime.query('ROLLBACK'); }
    expect((await runtime.query('SELECT * FROM bot_private.bot_staff')).rows).toEqual([]);
  });
  it('observes revocation and guild changes on the next call', async () => {
    await admin.query('UPDATE bot_private.bot_staff SET active = false WHERE user_id = $1', [ids.devId]);
    try { expect(await database.getStaffRole(ids.devId, ids.guildId)).toBeNull(); }
    finally { await admin.query('UPDATE bot_private.bot_staff SET active = true WHERE user_id = $1', [ids.devId]); }
    await admin.query("UPDATE bot_private.bot_settings SET dev_guild_id = '123456789012345678'");
    try {
      expect(await database.getStaffRole(ids.creatorId, ids.guildId)).toBeNull();
      expect(await database.getStaffRole(ids.creatorId, '123456789012345678')).toBe('creator');
      await expect(initializeAccess(admin, 'development', ids)).rejects.toThrow('differs');
    } finally { await admin.query('UPDATE bot_private.bot_settings SET dev_guild_id = $1', [ids.guildId]); }
  });
  it('uses a real unprivileged login and denies writes, DDL and escalation', async () => {
    expect((await runtime.query('SELECT session_user')).rows[0].session_user).toBe('kuruttina_bot');
    for (const sql of [
      "UPDATE bot_private.bot_staff SET active = false",
      "INSERT INTO bot_private.bot_staff VALUES ('123456789012345678', 'dev', true)",
      'DELETE FROM bot_private.bot_settings',
      'CREATE TABLE bot_private.attack (id int)',
      'CREATE TABLE public.attack (id int)',
      'CREATE TEMP TABLE attack (id int)',
      'CREATE SCHEMA attack',
      'CREATE ROLE attack',
      'SET ROLE kuruttina_owner',
      'ALTER TABLE bot_private.bot_staff DISABLE ROW LEVEL SECURITY',
    ]) await expect(runtime.query(sql)).rejects.toThrow();
    await runtime.query('SET search_path = public, bot_private, pg_catalog');
    expect((await runtime.query('SELECT * FROM bot_private.bot_staff')).rows).toEqual([]);
  });
  it('enforces singleton, valid IDs, unique users and unique roles', async () => {
    for (const sql of [
      "INSERT INTO bot_private.bot_settings VALUES (false, '1422623678205657160', 'development')",
      "UPDATE bot_private.bot_settings SET dev_guild_id = '18446744073709551616'",
      "UPDATE bot_private.bot_settings SET environment = 'staging'",
      "INSERT INTO bot_private.bot_staff VALUES ('123456789012345678', 'creator', true)",
      "INSERT INTO bot_private.bot_staff VALUES ('666948364507545600', 'dev', true)",
      "UPDATE bot_private.bot_staff SET role = 'admin'",
      "UPDATE bot_private.bot_staff SET user_id = 'invalid'",
    ]) await expect(admin.query(sql)).rejects.toThrow();
  });
  it('locks down defaults for future tables and functions', async () => {
    await admin.query('BEGIN');
    try {
      await admin.query('SET LOCAL ROLE kuruttina_owner');
      await admin.query('CREATE TABLE bot_private.future_table (id int)');
      await admin.query('CREATE FUNCTION bot_private.future_function() RETURNS integer LANGUAGE sql AS $$ SELECT 1 $$');
      await admin.query('COMMIT');
      await expect(runtime.query('SELECT * FROM bot_private.future_table')).rejects.toThrow();
      await expect(runtime.query('SELECT bot_private.future_function()')).rejects.toThrow();
    } finally {
      await admin.query('ROLLBACK');
      await admin.query('DROP TABLE IF EXISTS bot_private.future_table');
      await admin.query('DROP FUNCTION IF EXISTS bot_private.future_function()');
    }
    const roles = await admin.query("SELECT rolsuper, rolcreatedb, rolcreaterole, rolbypassrls FROM pg_roles WHERE rolname = 'kuruttina_bot'");
    expect(roles.rows[0]).toEqual({ rolsuper: false, rolcreatedb: false, rolcreaterole: false, rolbypassrls: false });
  });
  it('does not grant new objects from the migration owner to runtime', async () => {
    const policies = await admin.query("SELECT relname, relrowsecurity, relforcerowsecurity FROM pg_class WHERE relnamespace = 'bot_private'::regnamespace AND relkind = 'r'");
    expect(policies.rows).toHaveLength(2);
    expect(policies.rows.every((row) => row.relrowsecurity && row.relforcerowsecurity)).toBe(true);
  });
});
