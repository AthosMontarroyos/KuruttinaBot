import { readFileSync } from 'node:fs';
import { parse } from 'dotenv';
import pg from 'pg';
import { loadAppConfig } from '@kuruttina/config';
import { isDiscordId, readDatabaseConfig } from '@kuruttina/database';
import { migrate, initializeAccess } from '@kuruttina/database/admin';

/** @param {string} message */
const configurationError = (message) => Object.assign(new Error(message), { name: 'AppConfigurationError' });
const seedEnvNames = ['SEED_GUILD_ID', 'SEED_CREATOR_ID', 'SEED_DEV_ID'];

/** Snowflakes do cadastro inicial. Vêm do Doppler do ambiente, nunca do código.
 * @param {Record<string, string | undefined>} env */
function readSeedIds(env) {
  const guildId = env.SEED_GUILD_ID?.trim() ?? '';
  const creatorId = env.SEED_CREATOR_ID?.trim() ?? '';
  const devId = env.SEED_DEV_ID?.trim() ?? '';
  const missing = seedEnvNames.filter((name) => !env[name]?.trim());
  if (missing.length) throw configurationError(`Missing required configuration: ${missing.join(', ')}`);
  if (!isDiscordId(guildId) || !isDiscordId(creatorId) || !isDiscordId(devId) || creatorId === devId) {
    throw configurationError('SEED_GUILD_ID, SEED_CREATOR_ID and SEED_DEV_ID must be distinct Discord snowflakes');
  }
  return { guildId, creatorId, devId };
}

async function main() {
  const action = process.argv[2];
  const target = process.argv[3];
  if (!['migrate', 'seed'].includes(action ?? '') || !['development', 'production'].includes(target ?? '')) {
    throw configurationError('Usage: npm run database:migrate|database:seed -- development|production');
  }
  let local = {};
  try { local = parse(readFileSync(new URL('../../.env', import.meta.url))); }
  catch (error) { if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error; }
  const env = { ...local, ...process.env, APP_ENV: target };
  const seedIds = action === 'seed' ? readSeedIds(env) : null;
  const { appEnv } = loadAppConfig(env);
  const client = new pg.Client(readDatabaseConfig(env, appEnv, 'migration'));
  try {
    await client.connect();
    if (action === 'migrate') await migrate(client);
    else if (seedIds) await initializeAccess(client, appEnv, seedIds);
    else throw configurationError('Missing required configuration: SEED_GUILD_ID, SEED_CREATOR_ID, SEED_DEV_ID');
    console.log(`Database ${action} completed for ${appEnv}.`);
  } finally { await client.end(); }
}
main().catch((error) => {
  // Driver exceptions may contain credentials, SQL or connection details.
  if (error instanceof Error && error.name === 'AppConfigurationError') console.error(error.message);
  else console.error('Database operation failed. Check the target, migration credentials and database state.');
  process.exitCode = 1;
});
