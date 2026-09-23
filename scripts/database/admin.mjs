import { readFileSync } from 'node:fs';
import { parse } from 'dotenv';
import pg from 'pg';
import { loadAppConfig } from '@kuruttina/config';
import { readDatabaseConfig } from '@kuruttina/database';
import { migrate, initializeAccess } from '@kuruttina/database/admin';

async function main() {
  const action = process.argv[2];
  const target = process.argv[3];
  if (!['migrate', 'seed'].includes(action ?? '') || !['development', 'production'].includes(target ?? '')) {
    throw new Error('Usage: npm run database:migrate|database:seed -- development|production');
  }
  let local = {};
  try { local = parse(readFileSync(new URL('../../.env', import.meta.url))); }
  catch (error) { if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error; }
  const env = { ...local, ...process.env, APP_ENV: target };
  const { appEnv } = loadAppConfig(env);
  const client = new pg.Client(readDatabaseConfig(env, appEnv, 'migration'));
  try {
    await client.connect();
    if (action === 'migrate') await migrate(client);
    else await initializeAccess(client, appEnv, {
      guildId: '1422623678205657160', creatorId: '666948364507545600', devId: '1509331533348212808',
    });
    console.log(`Database ${action} completed for ${appEnv}.`);
  } finally { await client.end(); }
}
main().catch(() => {
  // Driver exceptions may contain credentials, SQL or connection details.
  console.error('Database operation failed. Check the target, migration credentials and database state.');
  process.exitCode = 1;
});
