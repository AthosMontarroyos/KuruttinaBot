export function loadAppConfig(env = process.env) {
  if (env.BOT_TARGET !== undefined) throw new Error('BOT_TARGET was replaced by APP_ENV; remove BOT_TARGET');
  const appEnv = env.APP_ENV;
  if (appEnv !== 'development' && appEnv !== 'production') {
    throw new Error('APP_ENV must be development or production');
  }
  return Object.freeze({ appEnv });
}

export function loadLocalWebConfig(env = process.env) {
  const { appEnv } = loadAppConfig(env);
  const value = env.PORT ?? '3666';
  if (!/^[1-9][0-9]{0,4}$/.test(value) || Number(value) > 65535) {
    throw new Error('PORT must be an integer from 1 to 65535');
  }
  return Object.freeze({ appEnv, host: 'localhost', port: Number(value), origin: `http://localhost:${value}` });
}
