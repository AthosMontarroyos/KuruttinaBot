import 'dotenv/config';

export type BotTarget = 'development' | 'production';
export type BotCredential = Readonly<{ token: string; expectedBotId: string }>;
export type BotConfig = Readonly<{
  target: BotTarget;
  credentials: Readonly<{ development: BotCredential; production: BotCredential }>;
  activeCredential: BotCredential;
  autoSyncCommands: boolean;
}>;

const required = (env: NodeJS.ProcessEnv, name: string): string => {
  const value = env[name]?.trim();
  if (!value) throw new Error(`Missing required configuration: ${name}`);
  return value;
};

const parseBoolean = (value: string | undefined): boolean => {
  if (value === undefined || value === '') return false;
  if (value === 'true') return true;
  if (value === 'false') return false;
  throw new Error('AUTO_SYNC_COMMANDS must be true or false');
};

export function loadConfig(env: NodeJS.ProcessEnv = process.env): BotConfig {
  const target = required(env, 'BOT_TARGET');
  if (target !== 'development' && target !== 'production') throw new Error('BOT_TARGET must be development or production');
  const credentials = Object.freeze({
    development: readCredential(env, 'DEVELOPMENT'),
    production: readCredential(env, 'PRODUCTION'),
  });
  return Object.freeze({ target, credentials, activeCredential: credentials[target], autoSyncCommands: parseBoolean(env.AUTO_SYNC_COMMANDS) });
}

function readCredential(env: NodeJS.ProcessEnv, suffix: 'DEVELOPMENT' | 'PRODUCTION'): BotCredential {
  const idName = `DISCORD_BOT_ID_${suffix}`;
  const expectedBotId = required(env, idName);
  if (!/^\d{17,20}$/.test(expectedBotId)) throw new Error(`${idName} must be a Discord snowflake`);
  return Object.freeze({ token: required(env, `DISCORD_BOT_TOKEN_${suffix}`), expectedBotId });
}
