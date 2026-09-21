// @ts-check
import { readFileSync } from 'node:fs';
import { parse } from 'dotenv';

const bucket = 'kurrutina-bot-pictures';
const apiBase = 'https://api.cloudflare.com/client/v4';

/** @typedef {{ key: string, size: number, last_modified?: string, etag?: string, http_metadata?: { content_type?: string } }} R2Object */

/** @param {NodeJS.ProcessEnv} [environment] */
export function loadR2Config(environment) {
  if (environment === undefined) {
    let local = {};
    try {
      local = parse(readFileSync(new URL('../../.env', import.meta.url)));
    } catch (error) {
      if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error;
    }
    environment = { ...local, ...process.env };
  }
  const accountId = environment.CLOUDFLARE_ACCOUNT_ID?.trim();
  const apiToken = environment.CLOUDFLARE_API_TOKEN?.trim();
  if (!accountId || !apiToken) throw new Error('CLOUDFLARE_ACCOUNT_ID e CLOUDFLARE_API_TOKEN sao obrigatorios.');
  return { accountId, apiToken };
}

/** @param {unknown} value @returns {value is Record<string, unknown>} */
function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** @param {unknown} value @returns {R2Object} */
function parseObject(value) {
  if (!isRecord(value) || typeof value.key !== 'string' || typeof value.size !== 'number' || !Number.isFinite(value.size) || value.size < 0) {
    throw new Error('Cloudflare retornou um objeto R2 invalido.');
  }
  return {
    key: value.key,
    size: value.size,
    ...(typeof value.last_modified === 'string' ? { last_modified: value.last_modified } : {}),
    ...(typeof value.etag === 'string' ? { etag: value.etag } : {}),
    ...(isRecord(value.http_metadata) && typeof value.http_metadata.content_type === 'string'
      ? { http_metadata: { content_type: value.http_metadata.content_type } } : {}),
  };
}

/** @param {ReturnType<typeof loadR2Config>} [config] */
export function createR2Client(config = loadR2Config()) {
  const objectsUrl = `${apiBase}/accounts/${config.accountId}/r2/buckets/${bucket}/objects`;

  /** @param {string} url @param {RequestInit} [options] */
  async function request(url, options = {}) {
    const headers = new Headers(options.headers);
    headers.set('Authorization', `Bearer ${config.apiToken}`);
    return fetch(url, { ...options, headers, signal: options.signal ?? AbortSignal.timeout(15_000) });
  }

  /** @param {string} url @param {RequestInit} [options] */
  async function jsonRequest(url, options = {}) {
    for (let attempt = 0; ; attempt++) {
      const response = await request(url, options);
      if (response.status === 429 && attempt < 5) {
        const retryAfter = response.headers.get('retry-after');
        const seconds = Number(retryAfter);
        const delay = retryAfter === null ? 1000 * 2 ** attempt + Math.random() * 250
          : Number.isFinite(seconds) ? seconds * 1000 : Date.parse(retryAfter) - Date.now();
        await response.body?.cancel();
        if (!Number.isFinite(delay) || delay > 30_000) throw new Error('Cloudflare R2: limite de requisicoes; tente novamente mais tarde.');
        await new Promise((resolve) => setTimeout(resolve, Math.max(delay, 250)));
        continue;
      }
      /** @type {unknown} */
      const payload = await response.json().catch(() => undefined);
      if (!response.ok || !isRecord(payload) || payload.success !== true) {
        throw new Error(`Cloudflare R2: HTTP ${response.status}; operacao recusada.`);
      }
      return payload;
    }
  }

  /** @param {string} key */
  const objectUrl = (key) => `${objectsUrl}/${key.split('/').map(encodeURIComponent).join('/')}`;

  return {
    /** @param {string} [prefix] @returns {AsyncGenerator<R2Object>} */
    async *list(prefix = '') {
      let cursor = '';
      do {
        const url = new URL(objectsUrl);
        if (prefix) url.searchParams.set('prefix', prefix);
        if (cursor) url.searchParams.set('cursor', cursor);
        const payload = await jsonRequest(url.href);
        if (!Array.isArray(payload.result)) throw new Error('Cloudflare retornou uma listagem R2 invalida.');
        for (const object of payload.result) yield parseObject(object);
        const info = payload.result_info;
        if (!isRecord(info) || info.is_truncated !== true) break;
        if (typeof info.cursor !== 'string' || !info.cursor || info.cursor === cursor) throw new Error('Cloudflare retornou um cursor R2 invalido.');
        cursor = info.cursor;
      } while (cursor);
    },
    /** @param {string} key */
    async info(key) {
      return parseObject((await jsonRequest(objectUrl(key))).result);
    },
    /** @param {string} key @param {ArrayBuffer} body @param {string} contentType */
    async put(key, body, contentType) {
      await jsonRequest(objectUrl(key), { method: 'PUT', headers: { 'Content-Type': contentType }, body });
    },
    /** @param {string} key */
    async delete(key) {
      await jsonRequest(objectUrl(key), { method: 'DELETE' });
    },
    // WebDAV streams raw bodies; these requests must not be replayed automatically.
    /** @param {string} key @param {RequestInit} [options] */
    request(key, options) {
      return request(objectUrl(key), options);
    },
  };
}
