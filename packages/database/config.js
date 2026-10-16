import { X509Certificate } from 'node:crypto';

/** @param {string | undefined} value @param {string} name */
function readCertificate(value, name) {
  if (!value?.trim()) return undefined;
  const invalid = () => Object.assign(new Error('Invalid ' + name), { name: 'DatabaseConfigurationError' });
  if (value.length > 65536) throw invalid();
  let pem = value.trim();
  if ((pem.startsWith("'") && pem.endsWith("'")) || (pem.startsWith('"') && pem.endsWith('"'))) pem = pem.slice(1, -1).trim();
  pem = pem.replace(/\\r\\n|\\n|\\r/gu, '\n');
  const pattern = /-----BEGIN CERTIFICATE-----([A-Za-z0-9+/=\s]+)-----END CERTIFICATE-----/gu;
  const blocks = [...pem.matchAll(pattern)];
  if (!blocks.length || pem.replace(pattern, '').trim()) throw invalid();
  return blocks.map((block) => {
    if (block[1] === undefined) throw invalid();
    const body = block[1].replace(/\s/gu, '');
    if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u.test(body)) throw invalid();
    const normalized = '-----BEGIN CERTIFICATE-----\n' + (body.match(/.{1,64}/gu) ?? []).join('\n') + '\n-----END CERTIFICATE-----\n';
    try { new X509Certificate(normalized); } catch { throw invalid(); }
    return normalized;
  }).join('');
}
/** @typedef {'development' | 'production'} Environment */
/** @param {NodeJS.ProcessEnv} env @param {Environment} target @param {'runtime'|'migration'} [purpose] */
export function readDatabaseConfig(env, target, purpose = 'runtime') {
  const name = purpose === 'runtime' ? 'DATABASE_URL' : 'DATABASE_MIGRATION_URL';
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
  const ca = readCertificate(env.DATABASE_CA, 'DATABASE_CA');
  return Object.freeze({
    host: url.hostname.replace(/^\[|\]$/gu, ''), port: Number(url.port || 5432),
    user, password, database,
    ssl: local ? false : { rejectUnauthorized: true, ...(ca ? { ca } : {}) },
    connectionTimeoutMillis: 5000, statement_timeout: 5000,
    idle_in_transaction_session_timeout: 5000,
    options: '-c search_path=pg_catalog,bot_private',
  });
}
