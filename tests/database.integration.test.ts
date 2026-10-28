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
    // bot_settings, bot_staff, message_templates, message_components, message_deliveries (etapas 1C/1D) e message_template_folders.
    expect(policies.rows).toHaveLength(6);
    expect(policies.rows.every((row) => row.relrowsecurity && row.relforcerowsecurity)).toBe(true);
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
