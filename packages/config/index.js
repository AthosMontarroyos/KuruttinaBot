// @ts-check

/** @typedef {'development' | 'production'} AppEnv */

/** @param {string} message */
const configurationError = (message) => Object.assign(new Error(message), { name: 'AppConfigurationError' });

/**
 * @param {Record<string, string | undefined>} [env]
 * @returns {Readonly<{ appEnv: AppEnv }>}
 */
export function loadAppConfig(env = process.env) {
  if (env.BOT_TARGET !== undefined) throw configurationError('BOT_TARGET was replaced by APP_ENV; remove BOT_TARGET');
  const appEnv = env.APP_ENV;
  if (appEnv !== 'development' && appEnv !== 'production') {
    throw configurationError('APP_ENV must be development or production');
  }
  return Object.freeze({ appEnv });
}

/**
 * @param {Record<string, string | undefined>} [env]
 * @returns {Readonly<{ appEnv: AppEnv, host: 'localhost', port: number, origin: string }>}
 */
export function loadLocalWebConfig(env = process.env) {
  const { appEnv } = loadAppConfig(env);
  const value = env.PORT ?? '3666';
  if (!/^[1-9][0-9]{0,4}$/.test(value) || Number(value) > 65535) {
    throw configurationError('PORT must be an integer from 1 to 65535');
  }
  return Object.freeze({ appEnv, host: 'localhost', port: Number(value), origin: `http://localhost:${value}` });
}
