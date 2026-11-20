import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

const cli = 'packages/database/cli.js';

function run(args: string[], extra: NodeJS.ProcessEnv = {}) {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    DATABASE_MIGRATION_URL: 'not-a-url',
    DATABASE_CA: '',
    SEED_GUILD_ID: '',
    SEED_CREATOR_ID: '',
    SEED_DEV_ID: '',
    ...extra,
  };
  try {
    const stdout = execFileSync(process.execPath, [cli, ...args], { env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    return { status: 0, stdout, stderr: '' };
  } catch (error) {
    const failed = error as NodeJS.ErrnoException & { status?: number; stdout?: Buffer | string; stderr?: Buffer | string };
    return {
      status: failed.status ?? 1,
      stdout: String(failed.stdout ?? ''),
      stderr: String(failed.stderr ?? ''),
    };
  }
}

describe('database cli', () => {
  it('recusa o seed sem os snowflakes e não fala em falha de banco', () => {
    const result = run(['seed', 'development']);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('Missing required configuration: SEED_GUILD_ID, SEED_CREATOR_ID, SEED_DEV_ID');
    expect(result.stderr).not.toContain('Database operation failed');
    expect(result.stdout).toBe('');
  });

  it('recusa snowflake inválido ou creator igual ao dev', () => {
    const invalid = run(['seed', 'production'], {
      SEED_GUILD_ID: '100000000000000001',
      SEED_CREATOR_ID: 'nao-e-snowflake',
      SEED_DEV_ID: '100000000000000003',
    });
    expect(invalid.stderr).toContain('must be distinct Discord snowflakes');
    const samePerson = run(['seed', 'development'], {
      SEED_GUILD_ID: '100000000000000001',
      SEED_CREATOR_ID: '100000000000000002',
      SEED_DEV_ID: '100000000000000002',
    });
    expect(samePerson.stderr).toContain('must be distinct Discord snowflakes');
    expect(samePerson.stderr).not.toContain('100000000000000002');
  });

  it('com snowflakes válidos, o seed chega na credencial sem imprimir os ids', () => {
    const result = run(['seed', 'development'], {
      SEED_GUILD_ID: '100000000000000001',
      SEED_CREATOR_ID: '100000000000000002',
      SEED_DEV_ID: '100000000000000003',
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('Database operation failed. Check the target, migration credentials and database state.');
    expect(result.stderr).not.toContain('100000000000000001');
    expect(result.stdout).toBe('');
  });

  it('migrate não exige os snowflakes do seed', () => {
    const result = run(['migrate', 'production']);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('Database operation failed');
    expect(result.stderr).not.toContain('SEED_GUILD_ID');
  });

  it('argumento inválido mostra o uso e não a mensagem de banco', () => {
    const result = run(['seed']);
    expect(result.stderr).toContain('Usage: npm run database:migrate|database:seed -- development|production');
    expect(result.stderr).not.toContain('Database operation failed');
  });
});
