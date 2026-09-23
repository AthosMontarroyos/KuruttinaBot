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
