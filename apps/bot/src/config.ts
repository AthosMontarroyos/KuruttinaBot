import { readDatabaseConfig } from '@kuruttina/database';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse } from 'dotenv';
import { loadAppConfig, type AppEnv } from '@kuruttina/config';

export type BotTarget = AppEnv;
export type BotCredential = Readonly<{ token: string; expectedBotId: string }>;
export type BotConfig = Readonly<{
  target: BotTarget;
  activeCredential: BotCredential;
  database: ReturnType<typeof readDatabaseConfig>;
}>;

const configurationError = (message: string): Error => Object.assign(new Error(message), { name: 'BotConfigurationError' });

const botEnvironmentNames = [
  'APP_ENV',
  'DISCORD_BOT_ID',
  'DISCORD_BOT_TOKEN',
  'DATABASE_URL',
  'DATABASE_CA',
] as const;

/** Mantém só as variáveis do bot. O sufixo de ambiente não escolhe o nome. */
export function selectBotEnvironment(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  return Object.fromEntries(botEnvironmentNames.flatMap((name) => (env[name] === undefined ? [] : [[name, env[name]]])));
}

/**
 * Carrega o `.env` do diretório de execução quando disponível.
 * Ausência do arquivo (`ENOENT`) retorna `{}`, independentemente de APP_ENV.
 * Outros erros de leitura (permissão, arquivo inacessível) são propagados.
 */
function readLocalEnvironment(): NodeJS.ProcessEnv {
  try {
    return parse(readFileSync(resolve(process.cwd(), '.env')));
  } catch (error: unknown) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return {};
    throw error;
  }
}

/**
 * Combina um `.env` local, se existir, com `process.env`.
 * `process.env` tem precedência. Doppler injeta os segredos nesse ambiente.
 * `selectBotEnvironment` então extrai apenas as chaves consumidas pelo bot.
 */
function loadBotEnvironment(): NodeJS.ProcessEnv {
  return selectBotEnvironment({ ...readLocalEnvironment(), ...process.env });
}

const required = (env: NodeJS.ProcessEnv, name: string): string => {
  const value = env[name]?.trim();
  if (!value) throw configurationError(`Missing required configuration: ${name}`);
  return value;
};

export function loadConfig(env: NodeJS.ProcessEnv = loadBotEnvironment()): BotConfig {
  const { appEnv: target } = loadAppConfig(env);
  return Object.freeze({
    target,
    activeCredential: readCredential(env),
    database: readDatabaseConfig(env, target),
  });
}

function readCredential(env: NodeJS.ProcessEnv): BotCredential {
  const expectedBotId = required(env, 'DISCORD_BOT_ID');
  if (!/^[1-9]\d{16,19}$/.test(expectedBotId)) throw configurationError('DISCORD_BOT_ID must be a Discord snowflake');
  return Object.freeze({ token: required(env, 'DISCORD_BOT_TOKEN'), expectedBotId });
}
