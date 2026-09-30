import { execFile } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createDatabase } from '@kuruttina/database';
import { initializeAccess, migrate } from '@kuruttina/database/admin';

const run = promisify(execFile);
const host = '127.0.0.1';
const ids = { guildId: '1422623678205657160', creatorId: '666948364507545600', devId: '1509331533348212808' };

async function availablePort(): Promise<number> {
  const server = createServer();
  try {
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, host, resolve);
    });
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Could not reserve a PostgreSQL test port');
    return address.port;
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

async function postgresBinaries(): Promise<{ initdb: string; pgCtl: string }> {
  let binaries = { initdb: 'initdb', pgCtl: 'pg_ctl' };
  try {
    const { stdout } = await run('pg_config', ['--bindir']);
    const bin = stdout.trim();
    if (bin) binaries = { initdb: join(bin, 'initdb'), pgCtl: join(bin, 'pg_ctl') };
  } catch { /* PostgreSQL binaries may already be on PATH without pg_config. */ }
  try {
    await Promise.all([run(binaries.initdb, ['--version']), run(binaries.pgCtl, ['--version'])]);
  } catch (error) {
    throw new Error('PostgreSQL is required for integration tests: add initdb and pg_ctl to PATH, or provide pg_config to locate them.', { cause: error });
  }
  return binaries;
}

async function startPostgres() {
  const binaries = await postgresBinaries();
  const root = await mkdtemp(join(tmpdir(), 'kuruttina-postgres-'));
  const data = join(root, 'data');
  const passwordFile = join(root, 'password');
  const adminPassword = randomBytes(32).toString('hex');
  const runtimePassword = randomBytes(32).toString('hex');
  let initialized = false;
  let started = false;
  try {
    await writeFile(passwordFile, `${adminPassword}\n`, { mode: 0o600 });
    await run(binaries.initdb, [
      '-D', data, '-U', 'postgres', '--auth-host=scram-sha-256',
      '--auth-local=trust', '--no-locale', '--encoding=UTF8', '--pwfile', passwordFile,
    ], { timeout: 30_000 });
    initialized = true;
    await rm(passwordFile, { force: true });
    let port = 0;
    for (let attempt = 0; attempt < 3; attempt++) {
      port = await availablePort();
      try {
        await run(binaries.pgCtl, [
          '-D', data, '-l', join(root, 'server.log'), '-o', `-h ${host} -p ${port} -k ${root}`, '-w', 'start',
        ], { timeout: 30_000 });
        started = true;
        break;
      } catch (error) {
        if (attempt === 2) throw error;
      }
    }
    return {
      adminConfig: { host, port, database: 'postgres', user: 'postgres', password: adminPassword },
      runtimeConfig: { host, port, database: 'postgres', user: 'kuruttina_bot', password: runtimePassword },
      async stop() {
        try {
          if (started) await run(binaries.pgCtl, ['-D', data, '-m', 'immediate', '-w', 'stop'], { timeout: 15_000 });
        } finally {
          await rm(root, { recursive: true, force: true });
        }
      },
    };
  } catch (error) {
    try {
      if (initialized) {
        await run(binaries.pgCtl, ['-D', data, '-m', 'immediate', '-w', 'stop'], { timeout: 15_000 }).catch(() => {});
      }
    } finally {
      await rm(root, { recursive: true, force: true });
    }
    throw error;
  }
}

describe('PostgreSQL runtime isolation', () => {
  let cluster: Awaited<ReturnType<typeof startPostgres>> | undefined;
  let admin: pg.Client;
  let runtime: pg.Client;
  let database: ReturnType<typeof createDatabase>;
  let runtimeConfig: Awaited<ReturnType<typeof startPostgres>>['runtimeConfig'];

  const stopOnInterrupt = () => { void dispose().finally(() => process.exit(130)); };
  const stopOnTerminate = () => { void dispose().finally(() => process.exit(143)); };
  async function dispose() {
    process.removeListener('SIGINT', stopOnInterrupt);
    process.removeListener('SIGTERM', stopOnTerminate);
    const currentCluster = cluster;
    cluster = undefined;
    await Promise.allSettled([admin?.end(), runtime?.end(), database?.close()]);
    await currentCluster?.stop();
  }

  beforeAll(async () => {
    cluster = await startPostgres();
    process.once('SIGINT', stopOnInterrupt);
    process.once('SIGTERM', stopOnTerminate);
    admin = new pg.Client(cluster.adminConfig);
    runtimeConfig = cluster.runtimeConfig;
    runtime = new pg.Client(runtimeConfig);
    database = createDatabase(runtimeConfig, 'development');
    try {
      await admin.connect();
      await migrate(admin);
      await migrate(admin);
      await admin.query(`ALTER ROLE kuruttina_bot PASSWORD ${pg.escapeLiteral(runtimeConfig.password)}`);
      await initializeAccess(admin, 'development', ids);
      await initializeAccess(admin, 'development', ids);
      await runtime.connect();
    } catch (error) {
      await dispose();
      throw error;
    }
  }, 120_000);
  afterAll(dispose, 30_000);

  it('loads the singleton, validates environment and queries both roles', async () => {
    expect(await database.getSettings()).toEqual({ devGuildId: ids.guildId, environment: 'development' });
    expect(await database.getStaffRole(ids.creatorId, ids.guildId)).toBe('creator');
    expect(await database.getStaffRole(ids.devId, ids.guildId)).toBe('dev');
    const report = vi.fn();
    const wrong = createDatabase(runtimeConfig, 'production', report);
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
