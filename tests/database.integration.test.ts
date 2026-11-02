import { execFile } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import pg from 'pg';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
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
  const sitePassword = randomBytes(32).toString('hex');
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
      siteConfig: { host, port, database: 'postgres', user: 'kuruttina_site', password: sitePassword },
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

/** Applies migrations older than `cut`, recording the same ledger `migrate` uses, so a later `migrate` runs only the rest. */
async function applyMigrationsBefore(client: pg.Client, cut: string): Promise<void> {
  const directory = new URL('../packages/database/supabase/migrations/', import.meta.url);
  const names = (await readdir(directory)).filter((entry) => entry.endsWith('.sql')).sort();
  const end = names.indexOf(cut);
  if (end < 0) throw new Error(`Migration ${cut} was not found`);
  await client.query('BEGIN');
  try {
    await client.query('SELECT pg_advisory_xact_lock(146455, 1)');
    await client.query('CREATE SCHEMA IF NOT EXISTS kuruttina_migrations');
    await client.query('REVOKE ALL ON SCHEMA kuruttina_migrations FROM PUBLIC');
    await client.query('CREATE TABLE IF NOT EXISTS kuruttina_migrations.applied (name text PRIMARY KEY, checksum text NOT NULL)');
    for (const name of names.slice(0, end)) {
      const sql = await readFile(new URL(name, directory), 'utf8');
      const checksum = createHash('sha256').update(sql).digest('hex');
      await client.query(sql);
      await client.query('INSERT INTO kuruttina_migrations.applied (name, checksum) VALUES ($1, $2)', [name, checksum]);
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

describe('PostgreSQL runtime isolation', () => {
  let cluster: Awaited<ReturnType<typeof startPostgres>> | undefined;
  let admin: pg.Client;
  let runtime: pg.Client;
  let siteRuntime: pg.Client;
  let database: ReturnType<typeof createDatabase>;
  let runtimeConfig: Awaited<ReturnType<typeof startPostgres>>['runtimeConfig'];

  const stopOnInterrupt = () => { void dispose().finally(() => process.exit(130)); };
  const stopOnTerminate = () => { void dispose().finally(() => process.exit(143)); };
  async function dispose() {
    process.removeListener('SIGINT', stopOnInterrupt);
    process.removeListener('SIGTERM', stopOnTerminate);
    const currentCluster = cluster;
    cluster = undefined;
    await Promise.allSettled([admin?.end(), runtime?.end(), siteRuntime?.end(), database?.close()]);
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
      await applyMigrationsBefore(admin, '20261102120000_dev_guilds.sql');
      await admin.query(
        'INSERT INTO bot_private.bot_settings (singleton, dev_guild_id, environment) VALUES (true, $1, $2)',
        [ids.guildId, 'development'],
      );
      await migrate(admin);
      const copied = await admin.query('SELECT guild_id FROM bot_private.bot_dev_guilds ORDER BY guild_id');
      if (copied.rows.length !== 1 || copied.rows[0]?.guild_id !== ids.guildId) throw new Error('Migration did not copy dev_guild_id');
      const legacyColumn = await admin.query(
        `SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'bot_private' AND table_name = 'bot_settings' AND column_name = 'dev_guild_id'`,
      );
      if (legacyColumn.rows.length !== 0) throw new Error('dev_guild_id column was not dropped');
      await migrate(admin);
      await admin.query(`ALTER ROLE kuruttina_bot PASSWORD ${pg.escapeLiteral(runtimeConfig.password)}`);
      await admin.query(`ALTER ROLE kuruttina_site PASSWORD ${pg.escapeLiteral(cluster.siteConfig.password)}`);
      await initializeAccess(admin, 'development', ids);
      await initializeAccess(admin, 'development', ids);
      await runtime.connect();
      siteRuntime = new pg.Client(cluster.siteConfig);
      await siteRuntime.connect();
    } catch (error) {
      await dispose();
      throw error;
    }
  }, 120_000);
  afterAll(dispose, 30_000);

  it('loads the singleton, validates environment and queries both roles', async () => {
    expect(await database.getSettings()).toEqual({ devGuildIds: [ids.guildId], environment: 'development' });
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
    await admin.query('DELETE FROM bot_private.bot_dev_guilds');
    await admin.query("INSERT INTO bot_private.bot_dev_guilds (guild_id) VALUES ('123456789012345678')");
    try {
      expect(await database.getStaffRole(ids.creatorId, ids.guildId)).toBeNull();
      expect(await database.getStaffRole(ids.creatorId, '123456789012345678')).toBe('creator');
      expect(await database.getSettings()).toEqual({ devGuildIds: ['123456789012345678'], environment: 'development' });
      await expect(initializeAccess(admin, 'development', ids)).rejects.toThrow('differs');
      expect((await admin.query('SELECT guild_id FROM bot_private.bot_dev_guilds')).rows).toEqual([{ guild_id: '123456789012345678' }]);
    } finally {
      await admin.query('DELETE FROM bot_private.bot_dev_guilds');
      await admin.query('INSERT INTO bot_private.bot_dev_guilds (guild_id) VALUES ($1)', [ids.guildId]);
    }
  });
  it('authorizes staff in every registered dev guild and in none when the set is empty', async () => {
    const second = '123456789012345678';
    await admin.query('INSERT INTO bot_private.bot_dev_guilds (guild_id) VALUES ($1)', [second]);
    try {
      expect(await database.getSettings()).toEqual({ devGuildIds: [second, ids.guildId].sort(), environment: 'development' });
      expect(await database.getStaffRole(ids.creatorId, ids.guildId)).toBe('creator');
      expect(await database.getStaffRole(ids.devId, second)).toBe('dev');
      expect(await database.getStaffRole(ids.creatorId, '223456789012345678')).toBeNull();
      await runtime.query('BEGIN');
      try {
        await runtime.query("SELECT set_config('app.discord_user_id', $1, true), set_config('app.guild_id', $2, true)", [ids.creatorId, second]);
        expect((await runtime.query('SELECT user_id FROM bot_private.bot_staff')).rows).toEqual([{ user_id: ids.creatorId }]);
      } finally { await runtime.query('ROLLBACK'); }
      await expect(initializeAccess(admin, 'development', ids)).rejects.toThrow('differs');
    } finally {
      await admin.query('DELETE FROM bot_private.bot_dev_guilds WHERE guild_id = $1', [second]);
    }
    await admin.query('DELETE FROM bot_private.bot_dev_guilds');
    try {
      expect(await database.getSettings()).toEqual({ devGuildIds: [], environment: 'development' });
      expect(await database.getStaffRole(ids.creatorId, ids.guildId)).toBeNull();
      await runtime.query('BEGIN');
      try {
        await runtime.query("SELECT set_config('app.discord_user_id', $1, true), set_config('app.guild_id', $2, true)", [ids.creatorId, ids.guildId]);
        expect((await runtime.query('SELECT user_id FROM bot_private.bot_staff')).rows).toEqual([]);
      } finally { await runtime.query('ROLLBACK'); }
      await expect(initializeAccess(admin, 'development', ids)).rejects.toThrow('differs');
      expect((await admin.query('SELECT guild_id FROM bot_private.bot_dev_guilds')).rows).toEqual([]);
    } finally {
      await admin.query('INSERT INTO bot_private.bot_dev_guilds (guild_id) VALUES ($1) ON CONFLICT DO NOTHING', [ids.guildId]);
    }
    expect((await runtime.query('SELECT guild_id FROM bot_private.bot_dev_guilds')).rows).toEqual([{ guild_id: ids.guildId }]);
    await expect(siteRuntime.query('SELECT guild_id FROM bot_private.bot_dev_guilds')).rejects.toThrow();
  });
  it('uses a real unprivileged login and denies writes, DDL and escalation', async () => {
    expect((await runtime.query('SELECT session_user')).rows[0].session_user).toBe('kuruttina_bot');
    for (const sql of [
      "UPDATE bot_private.bot_staff SET active = false",
      "INSERT INTO bot_private.bot_staff VALUES ('123456789012345678', 'dev', true)",
      'DELETE FROM bot_private.bot_settings',
      "INSERT INTO bot_private.bot_dev_guilds VALUES ('123456789012345678')",
      'DELETE FROM bot_private.bot_dev_guilds',
      "UPDATE bot_private.bot_dev_guilds SET guild_id = '123456789012345678'",
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
      "INSERT INTO bot_private.bot_settings VALUES (false, 'development')",
      "INSERT INTO bot_private.bot_dev_guilds (guild_id) VALUES ('18446744073709551616')",
      "INSERT INTO bot_private.bot_dev_guilds (guild_id) VALUES ('invalid')",
      'INSERT INTO bot_private.bot_dev_guilds (guild_id) VALUES (NULL)',
      `INSERT INTO bot_private.bot_dev_guilds (guild_id) VALUES ('${ids.guildId}')`,
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
    const policies = await admin.query(`
      SELECT relname, relrowsecurity, relforcerowsecurity
      FROM pg_class
      WHERE relnamespace = 'bot_private'::regnamespace AND relkind = 'r'
      ORDER BY relname
    `);
    // Inventário fechado das tabelas de bot_private. role_groups e role_group_roles
    // (20261030120000_role_groups.sql) seguem o mesmo isolamento: RLS habilitada e forçada,
    // sem grant para PUBLIC nem para as roles de API. member_event_messages
    // (20261101120000_member_event_messages.sql) também. bot_dev_guilds
    // (20261102120000_dev_guilds.sql) também: SELECT só para kuruttina_bot.
    // Uma tabela nova entra aqui pelo nome.
    const appTables = [
      'bot_dev_guilds',
      'bot_settings',
      'bot_staff',
      'custom_button_functions',
      'custom_buttons',
      'custom_select_option_functions',
      'custom_select_options',
      'custom_selects',
      'member_event_messages',
      'message_components',
      'message_deliveries',
      'message_template_folders',
      'message_templates',
      'role_group_roles',
      'role_groups',
    ];
    expect(policies.rows).toEqual(appTables.map((relname) => ({ relname, relrowsecurity: true, relforcerowsecurity: true })));

    const grants = await admin.query(`
      SELECT class.relname, COALESCE(grantee.rolname, 'PUBLIC') AS grantee, privilege.privilege_type, privilege.is_grantable
      FROM pg_class AS class
      CROSS JOIN LATERAL aclexplode(class.relacl) AS privilege
      LEFT JOIN pg_roles AS grantee ON grantee.oid = privilege.grantee
      WHERE class.relnamespace = 'bot_private'::regnamespace
        AND class.relkind = 'r'
        AND privilege.grantee IS DISTINCT FROM class.relowner
      ORDER BY class.relname, grantee, privilege.privilege_type
    `);
    const siteWrite = ['DELETE', 'INSERT', 'SELECT', 'UPDATE'];
    const tableGrants: Record<string, Partial<Record<'kuruttina_bot' | 'kuruttina_site', string[]>>> = {
      bot_dev_guilds: { kuruttina_bot: ['SELECT'] },
      bot_settings: { kuruttina_bot: ['SELECT'] },
      bot_staff: { kuruttina_bot: ['SELECT'] },
      custom_button_functions: { kuruttina_bot: ['SELECT'], kuruttina_site: siteWrite },
      custom_buttons: { kuruttina_bot: ['SELECT'], kuruttina_site: siteWrite },
      custom_select_option_functions: { kuruttina_bot: ['SELECT'], kuruttina_site: siteWrite },
      custom_select_options: { kuruttina_bot: ['SELECT'], kuruttina_site: siteWrite },
      custom_selects: { kuruttina_bot: ['SELECT'], kuruttina_site: siteWrite },
      member_event_messages: { kuruttina_bot: ['SELECT'], kuruttina_site: ['INSERT', 'SELECT', 'UPDATE'] },
      message_components: { kuruttina_bot: ['SELECT'], kuruttina_site: siteWrite },
      message_deliveries: { kuruttina_bot: ['SELECT', 'UPDATE'], kuruttina_site: ['INSERT', 'SELECT'] },
      message_template_folders: { kuruttina_site: siteWrite },
      message_templates: { kuruttina_bot: siteWrite, kuruttina_site: siteWrite },
      role_group_roles: { kuruttina_bot: ['SELECT'], kuruttina_site: ['DELETE', 'INSERT', 'SELECT'] },
      role_groups: { kuruttina_bot: ['SELECT'], kuruttina_site: siteWrite },
    };
    expect(Object.keys(tableGrants).sort()).toEqual(appTables);
    const expectedGrants = Object.entries(tableGrants).flatMap(([relname, roles]) => Object.entries(roles).flatMap(([grantee, privileges]) =>
      (privileges ?? []).map((privilege_type) => ({ relname, grantee, privilege_type, is_grantable: false })),
    )).sort((left, right) => left.relname.localeCompare(right.relname) || left.grantee.localeCompare(right.grantee) || left.privilege_type.localeCompare(right.privilege_type));
    expect(grants.rows).toEqual(expectedGrants);
  });
  it('lets the site read only the active dev user id', async () => {
    const migration = await readFile(new URL('../packages/database/supabase/migrations/20261029150000_site_active_dev_user_id.sql', import.meta.url), 'utf8');
    expect(migration).toContain('SECURITY DEFINER');
    expect(migration).toContain('SET search_path = pg_catalog');
    expect(migration).toContain('GRANT EXECUTE ON FUNCTION bot_private.active_dev_user_id() TO kuruttina_site');
    expect(migration).not.toContain('GRANT SELECT ON bot_private.bot_staff');
    for (const role of ['PUBLIC', 'anon', 'authenticated', 'service_role']) expect(migration).toContain(role);

    const definition = await admin.query(`
      SELECT p.prosecdef AS security_definer, p.proconfig, p.pronargs, pg_get_function_result(p.oid) AS result,
             owner.rolname AS owner, p.proacl::text AS acl
      FROM pg_proc AS p
      JOIN pg_namespace AS namespace ON namespace.oid = p.pronamespace
      JOIN pg_roles AS owner ON owner.oid = p.proowner
      WHERE namespace.nspname = 'bot_private' AND p.proname = 'active_dev_user_id'
    `);
    expect(definition.rows).toEqual([{
      security_definer: true,
      proconfig: ['search_path=pg_catalog'],
      pronargs: 0,
      result: 'text',
      owner: 'kuruttina_owner',
      acl: '{kuruttina_owner=X/kuruttina_owner,kuruttina_site=X/kuruttina_owner}',
    }]);
    for (const [role, allowed] of [['kuruttina_site', true], ['kuruttina_bot', false], ['public', false]] as const) {
      const privilege = await admin.query(
        "SELECT has_function_privilege($1, 'bot_private.active_dev_user_id()', 'EXECUTE') AS ok",
        [role],
      );
      expect(privilege.rows[0]?.ok).toBe(allowed);
    }
    for (const tableName of ['bot_private.bot_staff', 'bot_private.bot_dev_guilds', 'bot_private.bot_settings']) {
      for (const privilege of ['SELECT', 'INSERT', 'UPDATE', 'DELETE']) {
        const table = await admin.query('SELECT has_table_privilege($1, $2, $3) AS ok', ['kuruttina_site', tableName, privilege]);
        expect(table.rows[0]?.ok).toBe(false);
      }
    }
    expect((await siteRuntime.query('SELECT session_user AS role')).rows[0]?.role).toBe('kuruttina_site');
    expect((await siteRuntime.query('SELECT bot_private.active_dev_user_id() AS user_id')).rows).toEqual([{ user_id: ids.devId }]);
    const siteDatabase = createDatabase(cluster!.siteConfig, 'development');
    try {
      expect(await siteDatabase.getActiveDevUserId()).toBe(ids.devId);
      await admin.query("UPDATE bot_private.bot_staff SET active = false WHERE role = 'dev'");
      expect(await siteDatabase.getActiveDevUserId()).toBeNull();
      expect((await siteRuntime.query('SELECT bot_private.active_dev_user_id() AS user_id')).rows).toEqual([{ user_id: null }]);
    } finally {
      await admin.query("UPDATE bot_private.bot_staff SET active = true WHERE role = 'dev'");
      await siteDatabase.close();
    }
    expect((await siteRuntime.query('SELECT bot_private.active_dev_user_id() AS user_id')).rows).toEqual([{ user_id: ids.devId }]);
    await expect(runtime.query('SELECT bot_private.active_dev_user_id()')).rejects.toThrow();
    await expect(database.getActiveDevUserId()).rejects.toThrow();
    for (const sql of [
      'SELECT * FROM bot_private.bot_staff',
      'SELECT user_id FROM bot_private.bot_staff',
      'SELECT role FROM bot_private.bot_staff',
      "SELECT user_id FROM bot_private.bot_staff WHERE role = 'creator'",
    ]) await expect(siteRuntime.query(sql)).rejects.toThrow();
    await siteRuntime.query('SET search_path = pg_temp, public');
    try {
      expect((await siteRuntime.query('SELECT bot_private.active_dev_user_id() AS user_id')).rows).toEqual([{ user_id: ids.devId }]);
      await expect(siteRuntime.query('CREATE TEMP TABLE bot_staff (user_id text)')).rejects.toThrow();
    } finally {
      await siteRuntime.query('RESET search_path');
    }
    await admin.query('REVOKE EXECUTE ON FUNCTION bot_private.active_dev_user_id() FROM kuruttina_site');
    try {
      await expect(siteRuntime.query('SELECT bot_private.active_dev_user_id()')).rejects.toThrow();
    } finally {
      await admin.query('GRANT EXECUTE ON FUNCTION bot_private.active_dev_user_id() TO kuruttina_site');
    }
    expect((await siteRuntime.query('SELECT bot_private.active_dev_user_id() AS user_id')).rows).toEqual([{ user_id: ids.devId }]);
    for (const role of ['anon', 'authenticated', 'service_role']) await admin.query(`CREATE ROLE ${role} NOLOGIN`);
    try {
      for (const role of ['anon', 'authenticated', 'service_role']) {
        const fn = await admin.query("SELECT has_function_privilege($1, 'bot_private.active_dev_user_id()', 'EXECUTE') AS ok", [role]);
        const table = await admin.query("SELECT has_table_privilege($1, 'bot_private.bot_staff', 'SELECT') AS ok", [role]);
        const guilds = await admin.query("SELECT has_table_privilege($1, 'bot_private.bot_dev_guilds', 'SELECT') AS ok", [role]);
        expect(fn.rows[0]?.ok).toBe(false);
        expect(table.rows[0]?.ok).toBe(false);
        expect(guilds.rows[0]?.ok).toBe(false);
      }
    } finally {
      for (const role of ['service_role', 'authenticated', 'anon']) await admin.query(`DROP ROLE ${role}`);
    }
  });
});

describe('message template persistence (etapa 1C)', () => {
  let cluster: Awaited<ReturnType<typeof startPostgres>> | undefined;
  let admin: pg.Client;
  let site: ReturnType<typeof createDatabase>;
  let bot: ReturnType<typeof createDatabase>;

  const stopOnInterrupt = () => { void dispose().finally(() => process.exit(130)); };
  const stopOnTerminate = () => { void dispose().finally(() => process.exit(143)); };
  async function dispose() {
    process.removeListener('SIGINT', stopOnInterrupt);
    process.removeListener('SIGTERM', stopOnTerminate);
    const currentCluster = cluster;
    cluster = undefined;
    await Promise.allSettled([admin?.end(), site?.close(), bot?.close()]);
    await currentCluster?.stop();
  }

  beforeAll(async () => {
    cluster = await startPostgres();
    process.once('SIGINT', stopOnInterrupt);
    process.once('SIGTERM', stopOnTerminate);
    admin = new pg.Client(cluster.adminConfig);
    site = createDatabase(cluster.siteConfig, 'development');
    bot = createDatabase(cluster.runtimeConfig, 'development');
    try {
      await admin.connect();
      await migrate(admin);
      await admin.query(`ALTER ROLE kuruttina_bot PASSWORD ${pg.escapeLiteral(cluster.runtimeConfig.password)}`);
      await admin.query(`ALTER ROLE kuruttina_site PASSWORD ${pg.escapeLiteral(cluster.siteConfig.password)}`);
      await initializeAccess(admin, 'development', ids);
    } catch (error) {
      await dispose();
      throw error;
    }
  }, 120_000);
  afterAll(dispose, 30_000);

  it('cria, lê, lista, soma o uso e remove um template', async () => {
    expect(await site.templates.usage(ids.guildId)).toEqual({ templates: 0, buttons: 0, menus: 0 });
    const content = { title: 'Boas-vindas', buttons: [{ label: 'Entrar' }] };
    try {
      expect(await site.templates.create({
        guildId: ids.guildId, name: 'boas-vindas', content, buttonCount: 1, menuCount: 0, actorId: ids.creatorId,
      })).toEqual({ ok: true });

      const stored = await site.templates.get(ids.guildId, 'boas-vindas');
      expect(stored).toEqual(expect.objectContaining({
        name: 'boas-vindas', content, buttonCount: 1, menuCount: 0, version: 1, createdBy: ids.creatorId, updatedBy: ids.creatorId,
      }));
      expect(await site.templates.get(ids.guildId, 'inexistente')).toBeNull();
      expect(await site.templates.get('123456789012345678', 'boas-vindas')).toBeNull();

      const listed = await site.templates.list(ids.guildId);
      expect(listed).toEqual([expect.objectContaining({ name: 'boas-vindas', buttonCount: 1, menuCount: 0, version: 1 })]);
      expect(await site.templates.usage(ids.guildId)).toEqual({ templates: 1, buttons: 1, menus: 0 });

      expect(await site.templates.remove(ids.guildId, 'boas-vindas')).toBe(true);
      expect(await site.templates.remove(ids.guildId, 'boas-vindas')).toBe(false);
      expect(await site.templates.get(ids.guildId, 'boas-vindas')).toBeNull();
    } finally {
      await site.templates.remove(ids.guildId, 'boas-vindas');
    }
  });

  it('recusa limit acima de 25 e usa o cursor por nome', async () => {
    await expect(site.templates.list(ids.guildId, { limit: 26 })).rejects.toThrow('limit');
    for (const name of ['alfa', 'beta', 'gama']) {
      expect(await site.templates.create({
        guildId: ids.guildId, name, content: {}, buttonCount: 0, menuCount: 0, actorId: ids.creatorId,
      })).toEqual({ ok: true });
    }
    try {
      const page = await site.templates.list(ids.guildId, { limit: 2 });
      expect(page.map((row) => row.name)).toEqual(['alfa', 'beta']);
      const next = await site.templates.list(ids.guildId, { limit: 2, after: page[1]?.name ?? '' });
      expect(next.map((row) => row.name)).toEqual(['gama']);
    } finally {
      for (const name of ['alfa', 'beta', 'gama']) await site.templates.remove(ids.guildId, name);
    }
  });

  it('recusa nomes duplicados', async () => {
    expect(await site.templates.create({
      guildId: ids.guildId, name: 'duplicado', content: {}, buttonCount: 0, menuCount: 0, actorId: ids.creatorId,
    })).toEqual({ ok: true });
    try {
      expect(await site.templates.create({
        guildId: ids.guildId, name: 'duplicado', content: {}, buttonCount: 0, menuCount: 0, actorId: ids.creatorId,
      })).toEqual({ ok: false, code: 'duplicate' });
    } finally {
      await site.templates.remove(ids.guildId, 'duplicado');
    }
  });

  it('bloqueia a cota de botões e menus antes de passar de 50', async () => {
    expect(await site.templates.create({
      guildId: ids.guildId, name: 'cota-a', content: {}, buttonCount: 30, menuCount: 0, actorId: ids.creatorId,
    })).toEqual({ ok: true });
    try {
      expect(await site.templates.create({
        guildId: ids.guildId, name: 'cota-b', content: {}, buttonCount: 21, menuCount: 0, actorId: ids.creatorId,
      })).toEqual({ ok: false, code: 'quota' });
      expect(await site.templates.get(ids.guildId, 'cota-b')).toBeNull();
    } finally {
      await site.templates.remove(ids.guildId, 'cota-a');
    }
  });

  it('atualiza com concorrência otimista e distingue not_found de conflict', async () => {
    expect(await site.templates.update({
      guildId: ids.guildId, name: 'nao-existe', expectedVersion: 1, content: {}, buttonCount: 0, menuCount: 0, actorId: ids.creatorId,
    })).toEqual({ ok: false, code: 'not_found' });

    expect(await site.templates.create({
      guildId: ids.guildId, name: 'versionado', content: { v: 1 }, buttonCount: 0, menuCount: 0, actorId: ids.creatorId,
    })).toEqual({ ok: true });
    try {
      expect(await site.templates.update({
        guildId: ids.guildId, name: 'versionado', expectedVersion: 7, content: { v: 2 }, buttonCount: 0, menuCount: 0, actorId: ids.creatorId,
      })).toEqual({ ok: false, code: 'conflict' });

      expect(await site.templates.update({
        guildId: ids.guildId, name: 'versionado', expectedVersion: 1, content: { v: 2 }, buttonCount: 2, menuCount: 1, actorId: ids.devId,
      })).toEqual({ ok: true, version: 2 });

      const updated = await site.templates.get(ids.guildId, 'versionado');
      expect(updated).toEqual(expect.objectContaining({ content: { v: 2 }, buttonCount: 2, menuCount: 1, version: 2, updatedBy: ids.devId }));
    } finally {
      await site.templates.remove(ids.guildId, 'versionado');
    }
  });

  it('bloqueia a cota de 100 templates por servidor', async () => {
    await admin.query('BEGIN');
    try {
      await admin.query("SELECT set_config('app.guild_id', $1, true)", [ids.guildId]);
      await admin.query(
        `INSERT INTO bot_private.message_templates (guild_id, name, content, created_by, updated_by)
           SELECT $1, 'seed-' || seed, '{}'::jsonb, $2, $2 FROM generate_series(1, 100) AS seed`,
        [ids.guildId, ids.creatorId],
      );
      await admin.query('COMMIT');
    } catch (error) {
      await admin.query('ROLLBACK');
      throw error;
    }
    try {
      expect(await site.templates.usage(ids.guildId)).toEqual({ templates: 100, buttons: 0, menus: 0 });
      expect(await site.templates.create({
        guildId: ids.guildId, name: 'excedente', content: {}, buttonCount: 0, menuCount: 0, actorId: ids.creatorId,
      })).toEqual({ ok: false, code: 'quota' });
    } finally {
      await admin.query('DELETE FROM bot_private.message_templates WHERE guild_id = $1', [ids.guildId]);
    }
  }, 30_000);

  it('não permite a fuga entre servidores (RLS por guild_id)', async () => {
    const otherGuild = '123456789012345678';
    expect(await site.templates.create({
      guildId: ids.guildId, name: 'isolado', content: {}, buttonCount: 0, menuCount: 0, actorId: ids.creatorId,
    })).toEqual({ ok: true });
    try {
      expect(await site.templates.list(otherGuild)).toEqual([]);
      expect(await site.templates.usage(otherGuild)).toEqual({ templates: 0, buttons: 0, menus: 0 });
      expect(await site.templates.remove(otherGuild, 'isolado')).toBe(false);
      expect(await site.templates.get(ids.guildId, 'isolado')).not.toBeNull();
    } finally {
      await site.templates.remove(ids.guildId, 'isolado');
    }
  });

  it('sincroniza o mapa custom_id -> ação ao criar e ao editar (etapa 1D)', async () => {
    const replyAction = { type: 'reply', template: 'oi' };
    expect(await site.templates.create({
      guildId: ids.guildId, name: 'com-acao', content: {}, buttonCount: 1, menuCount: 0, actorId: ids.creatorId,
      components: [{ customId: 'kt:btn:a', kind: 'button', action: replyAction }],
    })).toEqual({ ok: true });
    try {
      expect(await site.templates.findComponent(ids.guildId, 'kt:btn:a')).toEqual({ kind: 'button', action: replyAction });

      // Editar reescreve o conjunto inteiro: o antigo custom_id deixa de existir.
      const editAction = { type: 'delete' };
      expect(await site.templates.update({
        guildId: ids.guildId, name: 'com-acao', expectedVersion: 1, content: {}, buttonCount: 1, menuCount: 0, actorId: ids.creatorId,
        components: [{ customId: 'kt:btn:b', kind: 'button', action: editAction }],
      })).toEqual({ ok: true, version: 2 });

      expect(await site.templates.findComponent(ids.guildId, 'kt:btn:a')).toBeNull();
      expect(await site.templates.findComponent(ids.guildId, 'kt:btn:b')).toEqual({ kind: 'button', action: editAction });
    } finally {
      await site.templates.remove(ids.guildId, 'com-acao');
    }
    expect(await site.templates.findComponent(ids.guildId, 'kt:btn:b')).toBeNull();
  });

  it('recusa custom_id duplicado entre templates do mesmo servidor', async () => {
    const action = { type: 'delete' };
    expect(await site.templates.create({
      guildId: ids.guildId, name: 'dono-a', content: {}, buttonCount: 1, menuCount: 0, actorId: ids.creatorId,
      components: [{ customId: 'kt:btn:unico', kind: 'button', action }],
    })).toEqual({ ok: true });
    try {
      expect(await site.templates.create({
        guildId: ids.guildId, name: 'dono-b', content: {}, buttonCount: 1, menuCount: 0, actorId: ids.creatorId,
        components: [{ customId: 'kt:btn:unico', kind: 'button', action }],
      })).toEqual({ ok: false, code: 'duplicate_custom_id' });
      expect(await site.templates.get(ids.guildId, 'dono-b')).toBeNull();
    } finally {
      await site.templates.remove(ids.guildId, 'dono-a');
    }
  });

  it('cria, lista, renomeia e apaga pastas, isoladas por servidor', async () => {
    expect(await site.folders.list(ids.guildId)).toEqual([]);
    const created = await site.folders.create({ guildId: ids.guildId, name: 'Eventos' });
    expect(created).toEqual({ ok: true, id: expect.any(Number) });
    const folderId = (created as { ok: true; id: number }).id;
    try {
      expect(await site.folders.create({ guildId: ids.guildId, name: 'Eventos' })).toEqual({ ok: false, code: 'duplicate' });

      const otherGuild = '123456789012345678';
      expect(await site.folders.list(otherGuild)).toEqual([]);
      expect(await site.folders.list(ids.guildId)).toEqual([
        expect.objectContaining({ id: folderId, name: 'Eventos' }),
      ]);

      expect(await site.folders.rename({ guildId: ids.guildId, id: folderId, name: 'Comunicados' })).toEqual({ ok: true });
      expect(await site.folders.rename({ guildId: otherGuild, id: folderId, name: 'Roubo' })).toEqual({ ok: false, code: 'not_found' });
      expect(await site.folders.list(ids.guildId)).toEqual([
        expect.objectContaining({ id: folderId, name: 'Comunicados' }),
      ]);
    } finally {
      expect(await site.folders.remove(ids.guildId, folderId)).toBe(true);
      expect(await site.folders.remove(ids.guildId, folderId)).toBe(false);
    }
  });

  it('list/get trazem folderId e folderName; pasta de outro servidor é rejeitada; apagar a pasta só desarquiva o template', async () => {
    const created = await site.folders.create({ guildId: ids.guildId, name: 'Com template' });
    const folderId = (created as { ok: true; id: number }).id;
    try {
      expect(await site.templates.create({
        guildId: ids.guildId, name: 'na-pasta', content: {}, buttonCount: 0, menuCount: 0, actorId: ids.creatorId, folderId,
      })).toEqual({ ok: true });
      try {
        expect(await site.templates.get(ids.guildId, 'na-pasta')).toEqual(
          expect.objectContaining({ folderId, folderName: 'Com template' }),
        );
        expect(await site.templates.list(ids.guildId)).toEqual([
          expect.objectContaining({ name: 'na-pasta', folderId, folderName: 'Com template' }),
        ]);

        const otherGuild = '123456789012345678';
        expect(await site.templates.create({
          guildId: otherGuild, name: 'fuga', content: {}, buttonCount: 0, menuCount: 0, actorId: ids.creatorId, folderId,
        })).toEqual({ ok: false, code: 'invalid_folder' });

        // Apagar a pasta desarquiva o template (ON DELETE SET NULL), nunca o apaga.
        expect(await site.folders.remove(ids.guildId, folderId)).toBe(true);
        expect(await site.templates.get(ids.guildId, 'na-pasta')).toEqual(
          expect.objectContaining({ folderId: null, folderName: null }),
        );
      } finally {
        await site.templates.remove(ids.guildId, 'na-pasta');
      }
    } finally {
      await site.folders.remove(ids.guildId, folderId).catch(() => {});
    }
  });

  it('findComponent não encontra custom_id inexistente ou de outro servidor', async () => {
    expect(await site.templates.findComponent(ids.guildId, 'kt:btn:nada')).toBeNull();
    const otherGuild = '123456789012345678';
    expect(await site.templates.create({
      guildId: ids.guildId, name: 'isolado-componente', content: {}, buttonCount: 1, menuCount: 0, actorId: ids.creatorId,
      components: [{ customId: 'kt:btn:isolado', kind: 'button', action: { type: 'delete' } }],
    })).toEqual({ ok: true });
    try {
      expect(await site.templates.findComponent(otherGuild, 'kt:btn:isolado')).toBeNull();
    } finally {
      await site.templates.remove(ids.guildId, 'isolado-componente');
    }
  });

  it('nega ao bot pastas e o join de pastas, e deixa ler o conteúdo e o custom_id', async () => {
    await expect(bot.folders.list(ids.guildId)).rejects.toMatchObject({ code: '42501' });
    await expect(bot.templates.get(ids.guildId, 'inexistente')).rejects.toMatchObject({ code: '42501' });

    const action = { type: 'delete' };
    expect(await site.templates.create({
      guildId: ids.guildId, name: 'leitura-bot', content: { title: 'oi' }, buttonCount: 1, menuCount: 0, actorId: ids.creatorId,
      components: [{ customId: 'kt:btn:leitura', kind: 'button', action }],
    })).toEqual({ ok: true });
    try {
      expect(await bot.templates.getContent(ids.guildId, 'leitura-bot')).toEqual({ content: { title: 'oi' } });
      expect(await bot.templates.findComponent(ids.guildId, 'kt:btn:leitura')).toEqual({ kind: 'button', action });
      await expect(bot.templates.get(ids.guildId, 'leitura-bot')).rejects.toMatchObject({ code: '42501' });
    } finally {
      await site.templates.remove(ids.guildId, 'leitura-bot');
    }
  });
});

describe('fila de entrega de mensagens (etapa 1D)', () => {
  let cluster: Awaited<ReturnType<typeof startPostgres>> | undefined;
  let admin: pg.Client;
  let site: ReturnType<typeof createDatabase>;
  let bot: ReturnType<typeof createDatabase>;

  const stopOnInterrupt = () => { void dispose().finally(() => process.exit(130)); };
  const stopOnTerminate = () => { void dispose().finally(() => process.exit(143)); };
  async function dispose() {
    process.removeListener('SIGINT', stopOnInterrupt);
    process.removeListener('SIGTERM', stopOnTerminate);
    const currentCluster = cluster;
    cluster = undefined;
    await Promise.allSettled([admin?.end(), site?.close(), bot?.close()]);
    await currentCluster?.stop();
  }

  beforeAll(async () => {
    cluster = await startPostgres();
    process.once('SIGINT', stopOnInterrupt);
    process.once('SIGTERM', stopOnTerminate);
    admin = new pg.Client(cluster.adminConfig);
    site = createDatabase(cluster.siteConfig, 'development');
    bot = createDatabase(cluster.runtimeConfig, 'development');
    try {
      await admin.connect();
      await migrate(admin);
      await admin.query(`ALTER ROLE kuruttina_bot PASSWORD ${pg.escapeLiteral(cluster.runtimeConfig.password)}`);
      await admin.query(`ALTER ROLE kuruttina_site PASSWORD ${pg.escapeLiteral(cluster.siteConfig.password)}`);
      await initializeAccess(admin, 'development', ids);
    } catch (error) {
      await dispose();
      throw error;
    }
  }, 120_000);
  afterAll(dispose, 30_000);

  it('nega ao bot inserir um pedido de entrega', async () => {
    await expect(bot.deliveries.create({
      guildId: ids.guildId, channelId: '666948364507545600', templateName: 'boas-vindas', requestedBy: ids.creatorId,
    })).rejects.toMatchObject({ code: '42501' });
  });

  it('pede o envio, o bot reivindica sem filtro de servidor e marca como enviado', async () => {
    expect(await site.deliveries.create({
      guildId: ids.guildId, channelId: '666948364507545600', templateName: 'boas-vindas', requestedBy: ids.creatorId,
    })).toEqual({ ok: true });

    const claimed = await bot.deliveries.claimPending(10);
    expect(claimed).toEqual([expect.objectContaining({ guildId: ids.guildId, channelId: '666948364507545600', templateName: 'boas-vindas' })]);

    expect(await bot.deliveries.markSent(claimed[0]!.id)).toBe(true);
    // Idempotente: um pedido já concluído não é marcado de novo.
    expect(await bot.deliveries.markSent(claimed[0]!.id)).toBe(false);
    expect(await bot.deliveries.claimPending(10)).toEqual([]);
  });

  it('marca como falhado com um código estável de erro', async () => {
    expect(await site.deliveries.create({
      guildId: ids.guildId, channelId: '666948364507545600', templateName: 'falha', requestedBy: ids.creatorId,
    })).toEqual({ ok: true });
    const [pending] = await bot.deliveries.claimPending(1);
    expect(await bot.deliveries.markFailed(pending!.id, 'channel_not_found')).toBe(true);
    expect(await bot.deliveries.markFailed(pending!.id, 'channel_not_found')).toBe(false);
  });

  it('bloqueia a cota de 20 pendências por servidor', async () => {
    for (let index = 0; index < 20; index++) {
      expect(await site.deliveries.create({
        guildId: ids.guildId, channelId: '666948364507545600', templateName: `fila-${index}`, requestedBy: ids.creatorId,
      })).toEqual({ ok: true });
    }
    try {
      expect(await site.deliveries.create({
        guildId: ids.guildId, channelId: '666948364507545600', templateName: 'excedente', requestedBy: ids.creatorId,
      })).toEqual({ ok: false, code: 'quota' });
    } finally {
      const pending = await bot.deliveries.claimPending(20);
      for (const item of pending) await bot.deliveries.markSent(item.id);
    }
  }, 30_000);
});

describe('ações personalizadas: botões e menus (site administra, bot só lê)', () => {
  let cluster: Awaited<ReturnType<typeof startPostgres>> | undefined;
  let admin: pg.Client;
  let site: ReturnType<typeof createDatabase>;
  let bot: ReturnType<typeof createDatabase>;
  const otherGuild = '123456789012345678';

  const stopOnInterrupt = () => { void dispose().finally(() => process.exit(130)); };
  const stopOnTerminate = () => { void dispose().finally(() => process.exit(143)); };
  async function dispose() {
    process.removeListener('SIGINT', stopOnInterrupt);
    process.removeListener('SIGTERM', stopOnTerminate);
    const currentCluster = cluster;
    cluster = undefined;
    await Promise.allSettled([admin?.end(), site?.close(), bot?.close()]);
    await currentCluster?.stop();
  }

  beforeAll(async () => {
    cluster = await startPostgres();
    process.once('SIGINT', stopOnInterrupt);
    process.once('SIGTERM', stopOnTerminate);
    admin = new pg.Client(cluster.adminConfig);
    site = createDatabase(cluster.siteConfig, 'development');
    bot = createDatabase(cluster.runtimeConfig, 'development');
    try {
      await admin.connect();
      await migrate(admin);
      await admin.query(`ALTER ROLE kuruttina_bot PASSWORD ${pg.escapeLiteral(cluster.runtimeConfig.password)}`);
      await admin.query(`ALTER ROLE kuruttina_site PASSWORD ${pg.escapeLiteral(cluster.siteConfig.password)}`);
      await initializeAccess(admin, 'development', ids);
    } catch (error) {
      await dispose();
      throw error;
    }
  }, 120_000);
  afterEach(async () => {
    await admin.query('DELETE FROM bot_private.custom_buttons WHERE guild_id = $1', [ids.guildId]);
    await admin.query('DELETE FROM bot_private.custom_selects WHERE guild_id = $1', [ids.guildId]);
  });
  afterAll(dispose, 30_000);

  it('cria, lista em ordem de nome e remove, separando botões e menus', async () => {
    expect(await site.customActions.create({ kind: 'buttons', guildId: ids.guildId, name: 'beta', actorId: ids.creatorId }))
      .toEqual({ ok: true, id: expect.any(Number), version: 1 });
    const alfa = await site.customActions.create({ kind: 'buttons', guildId: ids.guildId, name: 'alfa', actorId: ids.creatorId });
    expect(alfa).toEqual({ ok: true, id: expect.any(Number), version: 1 });
    expect(await site.customActions.create({ kind: 'selects', guildId: ids.guildId, name: 'cargos', actorId: ids.devId }))
      .toEqual({ ok: true, id: expect.any(Number), version: 1 });

    const buttons = await site.customActions.list('buttons', ids.guildId);
    expect(buttons.map((item) => item.name)).toEqual(['alfa', 'beta']);
    expect(buttons[0]).toEqual({ id: expect.any(Number), name: 'alfa', version: 1, createdAt: expect.any(Date), updatedAt: expect.any(Date) });
    expect(await site.customActions.list('selects', ids.guildId)).toEqual([expect.objectContaining({ name: 'cargos' })]);

    const alfaId = (alfa as { ok: true; id: number }).id;
    expect(await site.customActions.remove('buttons', ids.guildId, alfaId)).toEqual({ removed: true, unlinked: 0 });
    expect(await site.customActions.remove('buttons', ids.guildId, alfaId)).toEqual({ removed: false, unlinked: 0 });
    expect((await site.customActions.list('buttons', ids.guildId)).map((item) => item.name)).toEqual(['beta']);
  });

  it('recusa nome duplicado no mesmo tipo, mas aceita o mesmo nome no outro', async () => {
    expect(await site.customActions.create({ kind: 'buttons', guildId: ids.guildId, name: 'dup', actorId: ids.creatorId }))
      .toEqual({ ok: true, id: expect.any(Number), version: 1 });
    expect(await site.customActions.create({ kind: 'buttons', guildId: ids.guildId, name: 'dup', actorId: ids.creatorId }))
      .toEqual({ ok: false, code: 'duplicate' });
    expect(await site.customActions.create({ kind: 'selects', guildId: ids.guildId, name: 'dup', actorId: ids.creatorId }))
      .toEqual({ ok: true, id: expect.any(Number), version: 1 });
  });

  it('bloqueia a 51ª ação de cada tipo (cota de 50 por servidor)', async () => {
    for (const kind of ['buttons', 'selects'] as const) {
      for (let index = 0; index < 50; index++) {
        expect(await site.customActions.create({ kind, guildId: ids.guildId, name: `item-${index}`, actorId: ids.creatorId }))
          .toEqual({ ok: true, id: expect.any(Number), version: 1 });
      }
      expect(await site.customActions.create({ kind, guildId: ids.guildId, name: 'excedente', actorId: ids.creatorId }))
        .toEqual({ ok: false, code: 'quota' });
      expect(await site.customActions.list(kind, ids.guildId)).toHaveLength(50);
    }
  }, 60_000);

  it('isola os servidores: outro servidor não lista, não apaga e não vê a ação', async () => {
    const created = await site.customActions.create({ kind: 'buttons', guildId: ids.guildId, name: 'isolado', actorId: ids.creatorId });
    const id = (created as { ok: true; id: number }).id;
    expect(await site.customActions.list('buttons', otherGuild)).toEqual([]);
    expect(await site.customActions.remove('buttons', otherGuild, id)).toEqual({ removed: false, unlinked: 0 });
    expect(await site.customActions.list('buttons', ids.guildId)).toEqual([expect.objectContaining({ id, name: 'isolado' })]);
  });

  it('deixa o bot ler, mas nega criação e remoção', async () => {
    const created = await site.customActions.create({ kind: 'selects', guildId: ids.guildId, name: 'leitura-bot', actorId: ids.creatorId });
    const id = (created as { ok: true; id: number }).id;
    expect(await bot.customActions.list('selects', ids.guildId)).toEqual([expect.objectContaining({ id, name: 'leitura-bot' })]);
    await expect(bot.customActions.create({ kind: 'selects', guildId: ids.guildId, name: 'do-bot', actorId: ids.devId }))
      .rejects.toMatchObject({ code: '42501' });
    await expect(bot.customActions.remove('selects', ids.guildId, id)).rejects.toMatchObject({ code: '42501' });
    expect(await site.customActions.list('selects', ids.guildId)).toHaveLength(1);
  });
});

describe('configuração das ações personalizadas: funções de botões e opções de menus', () => {
  let cluster: Awaited<ReturnType<typeof startPostgres>> | undefined;
  let admin: pg.Client;
  let site: ReturnType<typeof createDatabase>;
  let bot: ReturnType<typeof createDatabase>;
  const otherGuild = '123456789012345678';

  const stopOnInterrupt = () => { void dispose().finally(() => process.exit(130)); };
  const stopOnTerminate = () => { void dispose().finally(() => process.exit(143)); };
  async function dispose() {
    process.removeListener('SIGINT', stopOnInterrupt);
    process.removeListener('SIGTERM', stopOnTerminate);
    const currentCluster = cluster;
    cluster = undefined;
    await Promise.allSettled([admin?.end(), site?.close(), bot?.close()]);
    await currentCluster?.stop();
  }
  async function createButton(name: string): Promise<number> {
    const created = await site.customActions.create({ kind: 'buttons', guildId: ids.guildId, name, actorId: ids.creatorId });
    return (created as { ok: true; id: number }).id;
  }
  async function createSelect(name: string): Promise<number> {
    const created = await site.customActions.create({ kind: 'selects', guildId: ids.guildId, name, actorId: ids.creatorId });
    return (created as { ok: true; id: number }).id;
  }

  beforeAll(async () => {
    cluster = await startPostgres();
    process.once('SIGINT', stopOnInterrupt);
    process.once('SIGTERM', stopOnTerminate);
    admin = new pg.Client(cluster.adminConfig);
    site = createDatabase(cluster.siteConfig, 'development');
    bot = createDatabase(cluster.runtimeConfig, 'development');
    try {
      await admin.connect();
      await migrate(admin);
      await admin.query(`ALTER ROLE kuruttina_bot PASSWORD ${pg.escapeLiteral(cluster.runtimeConfig.password)}`);
      await admin.query(`ALTER ROLE kuruttina_site PASSWORD ${pg.escapeLiteral(cluster.siteConfig.password)}`);
      await initializeAccess(admin, 'development', ids);
    } catch (error) {
      await dispose();
      throw error;
    }
  }, 120_000);
  afterEach(async () => {
    // A cascata apaga também as funções e as opções de cada ação.
    await admin.query('DELETE FROM bot_private.custom_buttons WHERE guild_id = $1', [ids.guildId]);
    await admin.query('DELETE FROM bot_private.custom_selects WHERE guild_id = $1', [ids.guildId]);
  });
  afterAll(dispose, 30_000);

  it('salva e lê a configuração de botão e de menu, preservando a ordem', async () => {
    const buttonId = await createButton('ordem');
    const functions = [
      { type: 'send_reply', config: { text: 'primeiro' } },
      { type: 'add_role', config: { roleId: '123456789012345678' } },
    ];
    expect(await site.customActionsConfig.saveButton({ guildId: ids.guildId, id: buttonId, expectedVersion: 1, functions, actorId: ids.creatorId }))
      .toEqual({ ok: true, version: 2 });
    expect(await bot.customActionsConfig.getButton(ids.guildId, buttonId)).toEqual({ id: buttonId, name: 'ordem', version: 2, functions });

    const selectId = await createSelect('menu-ordem');
    const options = [
      { key: 'zeta0001', label: 'Zeta', functions: [{ type: 'send_reply', config: { text: 'a' } }, { type: 'add_role', config: {} }] },
      { key: 'alfa0002', label: 'Alfa', functions: [] },
    ];
    expect(await site.customActionsConfig.saveSelect({ guildId: ids.guildId, id: selectId, expectedVersion: 1, keepSelection: true, options, actorId: ids.devId }))
      .toEqual({ ok: true, version: 2 });
    expect(await bot.customActionsConfig.getSelect(ids.guildId, selectId))
      .toEqual({ id: selectId, name: 'menu-ordem', version: 2, keepSelection: true, options });
  });

  it('salva e lê a chave de cada opção; chave repetida no mesmo menu é recusada pelo banco', async () => {
    const selectId = await createSelect('chaves');
    const options = [
      { key: 'a1b2c3', label: 'Sim', functions: [{ type: 'send_reply', config: { text: 'sim' } }] },
      { key: 'd4e5f6', label: 'Não', functions: [] },
    ];
    expect(await site.customActionsConfig.saveSelect({ guildId: ids.guildId, id: selectId, expectedVersion: 1, keepSelection: false, options, actorId: ids.creatorId }))
      .toEqual({ ok: true, version: 2 });
    expect(await bot.customActionsConfig.getSelect(ids.guildId, selectId))
      .toEqual({ id: selectId, name: 'chaves', version: 2, keepSelection: false, options });

    // A mesma chave em outro menu do mesmo servidor é permitida: a unicidade vale só dentro do menu.
    const otherSelectId = await createSelect('chaves-outro');
    expect(await site.customActionsConfig.saveSelect({ guildId: ids.guildId, id: otherSelectId, expectedVersion: 1, keepSelection: false, options: [{ key: 'a1b2c3', label: 'Sim', functions: [] }], actorId: ids.creatorId }))
      .toEqual({ ok: true, version: 2 });

    // Chave repetida dentro do mesmo menu: UNIQUE (select_id, option_key) recusa (23505) e nada muda, versão inclusive.
    const duplicated = [
      { key: 'a1b2c3', label: 'Sim', functions: [] },
      { key: 'a1b2c3', label: 'Não', functions: [] },
    ];
    await expect(site.customActionsConfig.saveSelect({ guildId: ids.guildId, id: selectId, expectedVersion: 2, keepSelection: true, options: duplicated, actorId: ids.creatorId }))
      .rejects.toMatchObject({ code: '23505' });
    expect(await bot.customActionsConfig.getSelect(ids.guildId, selectId))
      .toEqual({ id: selectId, name: 'chaves', version: 2, keepSelection: false, options });
  });

  it('recusa versão antiga e linha inexistente, sem alterar nada', async () => {
    const buttonId = await createButton('versao');
    const first = [{ type: 'send_reply', config: { text: 'original' } }];
    expect(await site.customActionsConfig.saveButton({ guildId: ids.guildId, id: buttonId, expectedVersion: 1, functions: first, actorId: ids.creatorId }))
      .toEqual({ ok: true, version: 2 });
    expect(await site.customActionsConfig.saveButton({ guildId: ids.guildId, id: buttonId, expectedVersion: 1, functions: [], actorId: ids.creatorId }))
      .toEqual({ ok: false, code: 'conflict' });
    expect(await bot.customActionsConfig.getButton(ids.guildId, buttonId)).toEqual({ id: buttonId, name: 'versao', version: 2, functions: first });

    const removedId = await createButton('apagado');
    expect(await site.customActions.remove('buttons', ids.guildId, removedId)).toEqual({ removed: true, unlinked: 0 });
    expect(await site.customActionsConfig.saveButton({ guildId: ids.guildId, id: removedId, expectedVersion: 1, functions: [], actorId: ids.creatorId }))
      .toEqual({ ok: false, code: 'not_found' });

    const selectId = await createSelect('versao-menu');
    expect(await site.customActionsConfig.saveSelect({ guildId: ids.guildId, id: selectId, expectedVersion: 7, keepSelection: true, options: [], actorId: ids.creatorId }))
      .toEqual({ ok: false, code: 'conflict' });
  });

  it('o banco recusa a 26ª opção e a 11ª função, e não grava nada', async () => {
    const selectId = await createSelect('limite-opcoes');
    const twentySix = Array.from({ length: 26 }, (_, index) => ({ key: `opc${String(index + 1).padStart(5, '0')}`, label: `Opção ${index + 1}`, functions: [] }));
    await expect(site.customActionsConfig.saveSelect({ guildId: ids.guildId, id: selectId, expectedVersion: 1, keepSelection: false, options: twentySix, actorId: ids.creatorId }))
      .rejects.toMatchObject({ code: '23514' });
    expect(await bot.customActionsConfig.getSelect(ids.guildId, selectId))
      .toEqual({ id: selectId, name: 'limite-opcoes', version: 1, keepSelection: false, options: [] });

    const buttonId = await createButton('limite-funcoes');
    const eleven = Array.from({ length: 11 }, () => ({ type: 'send_reply', config: {} }));
    await expect(site.customActionsConfig.saveButton({ guildId: ids.guildId, id: buttonId, expectedVersion: 1, functions: eleven, actorId: ids.creatorId }))
      .rejects.toMatchObject({ code: '23514' });
    expect(await bot.customActionsConfig.getButton(ids.guildId, buttonId)).toEqual({ id: buttonId, name: 'limite-funcoes', version: 1, functions: [] });
  });

  it('deixa o bot ler a configuração, mas nega gravá-la', async () => {
    const buttonId = await createButton('so-leitura');
    const functions = [{ type: 'send_reply', config: { text: 'oi' } }];
    await site.customActionsConfig.saveButton({ guildId: ids.guildId, id: buttonId, expectedVersion: 1, functions, actorId: ids.creatorId });
    expect(await bot.customActionsConfig.getButton(ids.guildId, buttonId)).toEqual(expect.objectContaining({ functions }));
    await expect(bot.customActionsConfig.saveButton({ guildId: ids.guildId, id: buttonId, expectedVersion: 2, functions: [], actorId: ids.devId }))
      .rejects.toMatchObject({ code: '42501' });
    expect(await site.customActionsConfig.getButton(ids.guildId, buttonId)).toEqual(expect.objectContaining({ version: 2, functions }));
  });

  it('isola os servidores: outro servidor não lê nem grava a configuração', async () => {
    const buttonId = await createButton('isolado');
    const selectId = await createSelect('isolado-menu');
    const functions = [{ type: 'send_reply', config: { text: 'meu' } }];
    await site.customActionsConfig.saveButton({ guildId: ids.guildId, id: buttonId, expectedVersion: 1, functions, actorId: ids.creatorId });
    expect(await site.customActionsConfig.getButton(otherGuild, buttonId)).toBeNull();
    expect(await site.customActionsConfig.getSelect(otherGuild, selectId)).toBeNull();
    expect(await site.customActionsConfig.saveButton({ guildId: otherGuild, id: buttonId, expectedVersion: 2, functions: [], actorId: ids.creatorId }))
      .toEqual({ ok: false, code: 'not_found' });
    expect(await site.customActionsConfig.getButton(ids.guildId, buttonId)).toEqual(expect.objectContaining({ version: 2, functions }));
  });

  it('apagar o botão apaga as funções dele (cascata)', async () => {
    const buttonId = await createButton('apagar');
    await site.customActionsConfig.saveButton({
      guildId: ids.guildId,
      id: buttonId,
      expectedVersion: 1,
      functions: [{ type: 'send_reply', config: {} }, { type: 'add_role', config: {} }],
      actorId: ids.creatorId,
    });
    const countFunctions = async () => Number((await admin.query(
      'SELECT count(*) AS total FROM bot_private.custom_button_functions WHERE button_id = $1',
      [buttonId],
    )).rows[0].total);
    expect(await countFunctions()).toBe(2);
    expect(await site.customActions.remove('buttons', ids.guildId, buttonId)).toEqual({ removed: true, unlinked: 0 });
    expect(await countFunctions()).toBe(0);
  });
});

describe('apagar uma ação desvincula os modelos do servidor que a referenciam', () => {
  let cluster: Awaited<ReturnType<typeof startPostgres>> | undefined;
  let admin: pg.Client;
  let site: ReturnType<typeof createDatabase>;
  let unlinkComponent: (typeof import('@kuruttina/message-templates'))['unlinkComponent'];
  const otherGuild = '123456789012345678';

  const stopOnInterrupt = () => { void dispose().finally(() => process.exit(130)); };
  const stopOnTerminate = () => { void dispose().finally(() => process.exit(143)); };
  async function dispose() {
    process.removeListener('SIGINT', stopOnInterrupt);
    process.removeListener('SIGTERM', stopOnTerminate);
    const currentCluster = cluster;
    cluster = undefined;
    await Promise.allSettled([admin?.end(), site?.close()]);
    await currentCluster?.stop();
  }
  async function createButton(guildId: string, name: string): Promise<number> {
    const created = await site.customActions.create({ kind: 'buttons', guildId, name, actorId: ids.creatorId });
    return (created as { ok: true; id: number }).id;
  }
  async function createSelect(guildId: string, name: string): Promise<number> {
    const created = await site.customActions.create({ kind: 'selects', guildId, name, actorId: ids.creatorId });
    return (created as { ok: true; id: number }).id;
  }

  beforeAll(async () => {
    cluster = await startPostgres();
    process.once('SIGINT', stopOnInterrupt);
    process.once('SIGTERM', stopOnTerminate);
    admin = new pg.Client(cluster.adminConfig);
    site = createDatabase(cluster.siteConfig, 'development');
    ({ unlinkComponent } = await import('@kuruttina/message-templates'));
    try {
      await admin.connect();
      await migrate(admin);
      await admin.query(`ALTER ROLE kuruttina_bot PASSWORD ${pg.escapeLiteral(cluster.runtimeConfig.password)}`);
      await admin.query(`ALTER ROLE kuruttina_site PASSWORD ${pg.escapeLiteral(cluster.siteConfig.password)}`);
      await initializeAccess(admin, 'development', ids);
    } catch (error) {
      await dispose();
      throw error;
    }
  }, 120_000);
  afterEach(async () => {
    await admin.query('DELETE FROM bot_private.message_templates WHERE guild_id = ANY($1::text[])', [[ids.guildId, otherGuild]]);
    await admin.query('DELETE FROM bot_private.custom_buttons WHERE guild_id = ANY($1::text[])', [[ids.guildId, otherGuild]]);
    await admin.query('DELETE FROM bot_private.custom_selects WHERE guild_id = ANY($1::text[])', [[ids.guildId, otherGuild]]);
  });
  afterAll(dispose, 30_000);

  it('apagar um botão tira a referência só dos modelos do servidor que o usam, soma a versão e não mexe nos demais', async () => {
    const removedId = await createButton(ids.guildId, 'apagar');
    const keptId = await createButton(ids.guildId, 'manter');
    const otherServerButtonId = await createButton(otherGuild, 'outro-servidor');

    const first = { content: 'Primeiro', embeds: [], components: [{ kind: 'buttons', buttons: [
      { style: 'primary', label: 'Apagar', customId: 'apagar', component: removedId },
      { style: 'secondary', label: 'Manter', customId: 'manter', component: keptId },
      { style: 'link', label: 'Site', url: 'https://example.com' },
    ] }] };
    const second = { content: 'Segundo', embeds: [], components: [{ kind: 'buttons', buttons: [
      { style: 'danger', label: 'Apagar', customId: 'apagar2', component: removedId },
    ] }] };
    const onlyKept = { content: 'Só o outro', embeds: [], components: [{ kind: 'buttons', buttons: [
      { style: 'secondary', label: 'Manter', customId: 'manter2', component: keptId },
    ] }] };
    const otherServer = { content: 'Outro servidor', embeds: [], components: [{ kind: 'buttons', buttons: [
      { style: 'danger', label: 'Apagar', customId: 'apagar3', component: removedId },
    ] }] };
    expect(await site.templates.create({ guildId: ids.guildId, name: 'modelo-a', content: first, buttonCount: 3, menuCount: 0, actorId: ids.creatorId }))
      .toEqual({ ok: true });
    expect(await site.templates.create({ guildId: ids.guildId, name: 'modelo-b', content: second, buttonCount: 1, menuCount: 0, actorId: ids.creatorId }))
      .toEqual({ ok: true });
    expect(await site.templates.create({ guildId: ids.guildId, name: 'modelo-c', content: onlyKept, buttonCount: 1, menuCount: 0, actorId: ids.creatorId }))
      .toEqual({ ok: true });
    expect(await site.templates.create({ guildId: otherGuild, name: 'modelo-fora', content: otherServer, buttonCount: 1, menuCount: 0, actorId: ids.creatorId }))
      .toEqual({ ok: true });

    expect(await site.customActions.remove('buttons', ids.guildId, removedId, unlinkComponent, ids.devId))
      .toEqual({ removed: true, unlinked: 2 });

    // Reescrito: o botão continua, sem `component`; o botão de outro Component e o link ficam como estavam.
    expect(await site.templates.get(ids.guildId, 'modelo-a')).toEqual(expect.objectContaining({
      version: 2,
      updatedBy: ids.devId,
      content: { content: 'Primeiro', embeds: [], components: [{ kind: 'buttons', buttons: [
        { style: 'primary', label: 'Apagar', customId: 'apagar' },
        { style: 'secondary', label: 'Manter', customId: 'manter', component: keptId },
        { style: 'link', label: 'Site', url: 'https://example.com' },
      ] }] },
    }));
    expect(await site.templates.get(ids.guildId, 'modelo-b')).toEqual(expect.objectContaining({
      version: 2,
      updatedBy: ids.devId,
      content: { content: 'Segundo', embeds: [], components: [{ kind: 'buttons', buttons: [
        { style: 'danger', label: 'Apagar', customId: 'apagar2' },
      ] }] },
    }));
    // Modelo que só usa outro Component: intacto (versão e conteúdo).
    expect(await site.templates.get(ids.guildId, 'modelo-c')).toEqual(expect.objectContaining({ version: 1, updatedBy: ids.creatorId, content: onlyKept }));
    // Modelo de outro servidor, com o mesmo id numérico: intacto.
    expect(await site.templates.get(otherGuild, 'modelo-fora')).toEqual(expect.objectContaining({ version: 1, updatedBy: ids.creatorId, content: otherServer }));
    // O Component de outro servidor continua existindo.
    expect(await site.customActions.list('buttons', otherGuild)).toEqual([expect.objectContaining({ id: otherServerButtonId })]);
  });

  it('apagar um menu tira component e componentOption das opções, e não mexe em outro menu', async () => {
    const removedId = await createSelect(ids.guildId, 'cargos');
    const keptId = await createSelect(ids.guildId, 'cores');

    const withRemoved = { content: 'Cargos', embeds: [], components: [{ kind: 'select', menu: {
      customId: 'cargos', component: removedId,
      options: [
        { label: 'Sim', value: 'sim', componentOption: 'a1b2c3' },
        { label: 'Não', value: 'nao', componentOption: 'd4e5f6' },
      ],
    } }] };
    const withKept = { content: 'Cores', embeds: [], components: [{ kind: 'select', menu: {
      customId: 'cores', component: keptId,
      options: [{ label: 'Azul', value: 'azul', componentOption: 'g7h8i9' }],
    } }] };
    expect(await site.templates.create({ guildId: ids.guildId, name: 'modelo-menu', content: withRemoved, buttonCount: 0, menuCount: 1, actorId: ids.creatorId }))
      .toEqual({ ok: true });
    expect(await site.templates.create({ guildId: ids.guildId, name: 'modelo-cores', content: withKept, buttonCount: 0, menuCount: 1, actorId: ids.creatorId }))
      .toEqual({ ok: true });

    expect(await site.customActions.remove('selects', ids.guildId, removedId, unlinkComponent, ids.devId))
      .toEqual({ removed: true, unlinked: 1 });

    expect(await site.templates.get(ids.guildId, 'modelo-menu')).toEqual(expect.objectContaining({
      version: 2,
      updatedBy: ids.devId,
      content: { content: 'Cargos', embeds: [], components: [{ kind: 'select', menu: {
        customId: 'cargos',
        options: [{ label: 'Sim', value: 'sim' }, { label: 'Não', value: 'nao' }],
      } }] },
    }));
    expect(await site.templates.get(ids.guildId, 'modelo-cores')).toEqual(expect.objectContaining({ version: 1, content: withKept }));
  });

  it('sem modelos que usem a ação, só apaga e devolve 0; id inexistente e outro servidor não mudam nada', async () => {
    const soloId = await createButton(ids.guildId, 'sozinho');
    const strangerId = await createButton(ids.guildId, 'desconhecido');
    const solo = { content: 'Sem referência', embeds: [], components: [{ kind: 'buttons', buttons: [
      { style: 'primary', label: 'Nada', customId: 'nada' },
    ] }] };
    const referencingOther = { content: 'Vinculado', embeds: [], components: [{ kind: 'buttons', buttons: [
      { style: 'primary', label: 'Fora', customId: 'fora', component: strangerId },
    ] }] };
    expect(await site.templates.create({ guildId: ids.guildId, name: 'modelo-solto', content: solo, buttonCount: 1, menuCount: 0, actorId: ids.creatorId }))
      .toEqual({ ok: true });
    // O modelo de outro servidor aponta para o id numérico de um Component deste servidor.
    expect(await site.templates.create({ guildId: otherGuild, name: 'modelo-vinculado', content: referencingOther, buttonCount: 1, menuCount: 0, actorId: ids.creatorId }))
      .toEqual({ ok: true });

    expect(await site.customActions.remove('buttons', ids.guildId, soloId, unlinkComponent, ids.devId))
      .toEqual({ removed: true, unlinked: 0 });
    expect(await site.customActions.remove('buttons', ids.guildId, soloId, unlinkComponent, ids.devId))
      .toEqual({ removed: false, unlinked: 0 });
    expect(await site.customActions.remove('buttons', ids.guildId, 999_999, unlinkComponent, ids.devId))
      .toEqual({ removed: false, unlinked: 0 });
    // Outro servidor não apaga o Component deste (e não reescreve modelo nenhum).
    expect(await site.customActions.remove('buttons', otherGuild, strangerId, unlinkComponent, ids.devId))
      .toEqual({ removed: false, unlinked: 0 });

    expect(await site.templates.get(ids.guildId, 'modelo-solto')).toEqual(expect.objectContaining({ version: 1, content: solo }));
    expect(await site.templates.get(otherGuild, 'modelo-vinculado')).toEqual(expect.objectContaining({ version: 1, content: referencingOther }));
    expect(await site.customActions.list('buttons', ids.guildId)).toEqual([expect.objectContaining({ id: strangerId })]);
  });

  it('sem a função de reescrita, apaga e deixa o modelo como estava', async () => {
    const buttonId = await createButton(ids.guildId, 'legado');
    const content = { content: 'Legado', embeds: [], components: [{ kind: 'buttons', buttons: [
      { style: 'primary', label: 'Legado', customId: 'legado', component: buttonId },
    ] }] };
    expect(await site.templates.create({ guildId: ids.guildId, name: 'modelo-legado', content, buttonCount: 1, menuCount: 0, actorId: ids.creatorId }))
      .toEqual({ ok: true });

    expect(await site.customActions.remove('buttons', ids.guildId, buttonId)).toEqual({ removed: true, unlinked: 0 });
    expect(await site.templates.get(ids.guildId, 'modelo-legado')).toEqual(expect.objectContaining({ version: 1, content }));
  });
});
