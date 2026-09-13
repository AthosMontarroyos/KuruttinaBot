import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse } from 'dotenv';
import { loadAppConfig, type AppEnv } from '@kuruttina/config';

export type BotTarget = AppEnv;
export type BotCredential = Readonly<{ token: string; expectedBotId: string }>;
export type BotConfig = Readonly<{
  target: BotTarget;
  credentials: Readonly<{ development: BotCredential; production: BotCredential }>;
  activeCredential: BotCredential;
  autoSyncCommands: boolean;
}>;

const configurationError = (message: string): Error => Object.assign(new Error(message), { name: 'BotConfigurationError' });

const botEnvironmentNames = [
  'APP_ENV',
  'AUTO_SYNC_COMMANDS',
  'DISCORD_BOT_ID_DEVELOPMENT',
  'DISCORD_BOT_ID_PRODUCTION',
  'DISCORD_BOT_TOKEN_DEVELOPMENT',
  'DISCORD_BOT_TOKEN_PRODUCTION',
] as const;

export function selectBotEnvironment(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  return Object.fromEntries(
    botEnvironmentNames.flatMap((name) => (env[name] === undefined ? [] : [[name, env[name]]])),
  );
}

function readLocalEnvironment(): NodeJS.ProcessEnv {
  try {
    return parse(readFileSync(resolve(process.cwd(), '.env')));
  } catch (error: unknown) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return {};
    throw error;
  }
}

function loadBotEnvironment(): NodeJS.ProcessEnv {
  return selectBotEnvironment({ ...readLocalEnvironment(), ...process.env });
}

const required = (env: NodeJS.ProcessEnv, name: string): string => {
  const value = env[name]?.trim();
  if (!value) throw configurationError(`Missing required configuration: ${name}`);
  return value;
};

const parseBoolean = (value: string | undefined): boolean => {
  if (value === undefined) return false;
  if (value === 'true') return true;
  if (value === 'false') return false;
  throw configurationError('AUTO_SYNC_COMMANDS must be true or false');
};

export function loadConfig(env: NodeJS.ProcessEnv = loadBotEnvironment()): BotConfig {
  const { appEnv: target } = loadAppConfig(env);
  const credentials = Object.freeze({
    development: readCredential(env, 'DEVELOPMENT'),
    production: readCredential(env, 'PRODUCTION'),
  });
  return Object.freeze({
    target,
    credentials,
    activeCredential: credentials[target],
    autoSyncCommands: parseBoolean(env.AUTO_SYNC_COMMANDS),
  });
}

function readCredential(env: NodeJS.ProcessEnv, suffix: 'DEVELOPMENT' | 'PRODUCTION'): BotCredential {
  const idName = `DISCORD_BOT_ID_${suffix}`;
  const expectedBotId = required(env, idName);
  if (!/^[1-9]\d{16,19}$/.test(expectedBotId)) throw configurationError(`${idName} must be a Discord snowflake`);
  return Object.freeze({ token: required(env, `DISCORD_BOT_TOKEN_${suffix}`), expectedBotId });
}
