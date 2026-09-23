/** @typedef {'development' | 'production'} Environment */
/** @param {NodeJS.ProcessEnv} env @param {Environment} target @param {'runtime'|'migration'} [purpose] */
export function readDatabaseConfig(env, target, purpose = 'runtime') {
  const suffix = target.toUpperCase();
  const name = `${purpose === 'runtime' ? 'DATABASE_URL' : 'DATABASE_MIGRATION_URL'}_${suffix}`;
  const invalid = () => Object.assign(new Error(`Invalid or missing ${name}`), { name: 'DatabaseConfigurationError' });
  let url;
  try { url = new URL(env[name] ?? ''); } catch { throw invalid(); }
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.hostname || !url.username ||
      !url.password || !url.pathname.slice(1) || url.search || url.hash) throw invalid();
  let user, password, database;
  try {
    user = decodeURIComponent(url.username);
    password = decodeURIComponent(url.password);
    database = decodeURIComponent(url.pathname.slice(1));
  } catch { throw invalid(); }
  if (purpose === 'runtime' && !/^kuruttina_bot(?:\.[a-z0-9]+)?$/u.test(user)) throw invalid();
  const local = ['localhost', '127.0.0.1', '[::1]', 'postgres'].includes(url.hostname);
  if (local && target !== 'development') throw invalid();
  const caValue = env[`DATABASE_CA_CERT_${suffix}`];
  const ca = caValue?.trim() || undefined;
  if (ca !== undefined && !ca.includes('-----BEGIN CERTIFICATE-----')) throw invalid();
  return Object.freeze({
    host: url.hostname.replace(/^\[|\]$/gu, ''), port: Number(url.port || 5432),
    user, password, database,
    ssl: local ? false : { rejectUnauthorized: true, ...(ca ? { ca } : {}) },
    connectionTimeoutMillis: 5000, statement_timeout: 5000,
    idle_in_transaction_session_timeout: 5000,
    options: '-c search_path=pg_catalog,bot_private',
  });
}
