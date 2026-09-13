// @ts-check

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * @param {unknown} value
 * @param {'development' | 'production'} environment
 */
function parseTunnel(value, environment) {
  if (
    !isRecord(value) ||
    typeof value.name !== 'string' ||
    value.name.length === 0 ||
    typeof value.id !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(value.id) ||
    typeof value.hostname !== 'string' ||
    !/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/u.test(value.hostname)
  ) {
    throw new Error(`Invalid ${environment} tunnel manifest entry`);
  }
  return { name: value.name, id: value.id, hostname: value.hostname };
}

/** @param {string} raw */
export function parseTunnelManifest(raw) {
  /** @type {unknown} */
  const parsed = JSON.parse(raw);
  if (!isRecord(parsed) || Object.keys(parsed).sort().join(',') !== 'development,production') {
    throw new Error('Tunnel manifest must define exactly development and production');
  }
  return {
    development: parseTunnel(parsed.development, 'development'),
    production: parseTunnel(parsed.production, 'production'),
  };
}

/** @param {unknown} value */
export function readTunnelIdFromToken(value) {
  if (!isRecord(value) || typeof value.t !== 'string') {
    throw new Error('Invalid tunnel token payload');
  }
  return value.t;
}
