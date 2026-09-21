import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from '#bot/config.js';
import { createR2Client } from '../r2/client.mjs';

const DISCORD_API = 'https://discord.com/api/v10';
const DISCORD_CDN = 'https://cdn.discordapp.com/emojis';
const R2_PREFIX = 'emojis/';
const REQUEST_TIMEOUT_MS = 15_000;
const MAX_RETRIES = 5;
const MAX_APPLICATION_EMOJI_BYTES = 256 * 1024;

type Credential = Readonly<{ token: string; expectedBotId: string }>;
type DiscordApplication = Readonly<{ id: string; name: string }>;
type DiscordEmoji = Readonly<{ id: string; name: string; animated?: boolean }>;
type EmojiAsset = Readonly<{ emoji: DiscordEmoji; bytes: Uint8Array; filename: string; contentType: string }>;

export function emojiFilename(emoji: DiscordEmoji): string {
  if (!/^[A-Za-z0-9_]{2,32}$/u.test(emoji.name)) throw new Error(`Nome de emoji invalido retornado pelo Discord: ${emoji.name}`);
  if (!/^\d{17,20}$/u.test(emoji.id)) throw new Error(`ID de emoji invalido retornado pelo Discord: ${emoji.id}`);
  return `${emoji.name}.${emoji.animated ? 'gif' : 'png'}`;
}

export function bytesEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.byteLength !== right.byteLength) return false;
  return left.every((value, index) => value === right[index]);
}

export function emojiContentChanged(
  sourceBytes: Uint8Array,
  sourceAnimated: boolean,
  targetBytes: Uint8Array,
  targetAnimated: boolean,
): boolean {
  return sourceAnimated !== targetAnimated || !bytesEqual(sourceBytes, targetBytes);
}

async function requestWithRateLimit(url: string, init: RequestInit): Promise<Response> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    const response = await fetch(url, { ...init, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    if (response.status !== 429) return response;
    if (attempt === MAX_RETRIES) throw new Error(`Limite de requisicoes excedido apos ${MAX_RETRIES + 1} tentativas.`);
    const payload = await response.clone().json().catch(() => ({})) as { retry_after?: unknown };
    const retrySeconds = typeof payload.retry_after === 'number' ? payload.retry_after : 1;
    await new Promise((resolvePromise) => setTimeout(resolvePromise, Math.min(Math.max(retrySeconds, 0.25), 30) * 1_000));
  }
  throw new Error('Falha inesperada no controle de rate limit.');
}

async function discordRequest<T>(path: string, token: string, init: RequestInit = {}): Promise<T> {
  const response = await requestWithRateLimit(`${DISCORD_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bot ${token}`,
      'User-Agent': 'KuruttinaBot emoji sync',
      ...(init.body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...init.headers,
    },
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({})) as { code?: unknown; message?: unknown };
    const message = typeof payload.message === 'string' ? `: ${payload.message.slice(0, 160)}` : '';
    throw new Error(`Discord HTTP ${response.status}${message} em ${path}.`);
  }
  if (response.status === 204) return undefined as T;
  return await response.json() as T;
}

async function validatedApplication(credential: Credential, label: string): Promise<DiscordApplication> {
  const user = await discordRequest<{ id?: string; bot?: boolean }>('/users/@me', credential.token);
  if (!user.bot || user.id !== credential.expectedBotId) throw new Error(`${label}: identidade do bot nao corresponde ao ID configurado.`);
  const application = await discordRequest<DiscordApplication>('/oauth2/applications/@me', credential.token);
  if (application.id !== user.id || !application.name) throw new Error(`${label}: resposta de aplicacao inconsistente.`);
  return application;
}

async function listApplicationEmojis(applicationId: string, token: string): Promise<DiscordEmoji[]> {
  const payload = await discordRequest<{ items?: DiscordEmoji[] }>(`/applications/${applicationId}/emojis`, token);
  if (!Array.isArray(payload.items)) throw new Error('Discord retornou uma lista de emojis invalida.');
  payload.items.forEach(emojiFilename);
  return payload.items;
}

async function fetchEmojiAsset(emoji: DiscordEmoji): Promise<EmojiAsset> {
  const extension = emoji.animated ? 'gif' : 'png';
  const response = await fetch(`${DISCORD_CDN}/${emoji.id}.${extension}?size=128&quality=lossless`, {
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    redirect: 'error',
  });
  if (!response.ok) throw new Error(`${emoji.name}: CDN do Discord respondeu HTTP ${response.status}.`);
  const declaredSize = Number(response.headers.get('content-length') ?? 0);
  if (declaredSize > MAX_APPLICATION_EMOJI_BYTES) throw new Error(`${emoji.name}: excede o limite de 256 KiB de Application Emoji.`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > MAX_APPLICATION_EMOJI_BYTES) throw new Error(`${emoji.name}: excede o limite de 256 KiB de Application Emoji.`);
  return { emoji, bytes, filename: emojiFilename(emoji), contentType: emoji.animated ? 'image/gif' : 'image/png' };
}

async function sourceAssets(credential: Credential): Promise<{ application: DiscordApplication; assets: EmojiAsset[] }> {
  const application = await validatedApplication(credential, 'production');
  const emojis = await listApplicationEmojis(application.id, credential.token);
  const assets: EmojiAsset[] = [];
  for (const emoji of emojis) assets.push(await fetchEmojiAsset(emoji));
  return { application, assets };
}

function asRequestBody(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

export async function replaceR2Emojis(assets: readonly EmojiAsset[], r2 = createR2Client()): Promise<void> {
  const expectedKeys = new Set(assets.map(({ filename }) => `${R2_PREFIX}${filename}`));
  for (const asset of assets) await r2.put(`${R2_PREFIX}${asset.filename}`, asRequestBody(asset.bytes), asset.contentType);
  // Finish pagination before deleting so mutations cannot invalidate the cursor.
  const obsolete: string[] = [];
  for await (const object of r2.list(R2_PREFIX)) {
    if (object.key.startsWith(R2_PREFIX) && !expectedKeys.has(object.key)) obsolete.push(object.key);
  }
  for (const key of obsolete) await r2.delete(key);
}

async function mirrorToDevelopment(assets: readonly EmojiAsset[], credential: Credential): Promise<void> {
  const application = await validatedApplication(credential, 'development');
  const existing = await listApplicationEmojis(application.id, credential.token);
  const remaining = new Map(existing.map((emoji) => [emoji.name, emoji]));

  for (const asset of assets) {
    const current = remaining.get(asset.emoji.name);
    remaining.delete(asset.emoji.name);
    if (current) {
      const currentAsset = await fetchEmojiAsset(current);
      if (!emojiContentChanged(
        asset.bytes,
        Boolean(asset.emoji.animated),
        currentAsset.bytes,
        Boolean(current.animated),
      )) continue;
    }

    const temporaryName = `sync_${asset.emoji.id.slice(-20)}`.slice(0, 32);
    const created = await discordRequest<DiscordEmoji>(`/applications/${application.id}/emojis`, credential.token, {
      method: 'POST',
      body: JSON.stringify({
        name: current ? temporaryName : asset.emoji.name,
        image: `data:${asset.contentType};base64,${Buffer.from(asset.bytes).toString('base64')}`,
      }),
    });
    if (current) {
      await discordRequest<void>(`/applications/${application.id}/emojis/${current.id}`, credential.token, { method: 'DELETE' });
      await discordRequest<DiscordEmoji>(`/applications/${application.id}/emojis/${created.id}`, credential.token, {
        method: 'PATCH',
        body: JSON.stringify({ name: asset.emoji.name }),
      });
    }
  }

  for (const emoji of remaining.values()) {
    await discordRequest<void>(`/applications/${application.id}/emojis/${emoji.id}`, credential.token, { method: 'DELETE' });
  }
}

export async function main(mode: 'r2' | 'all' = 'all'): Promise<void> {
  const config = loadConfig();
  const r2 = createR2Client();
  const { application, assets } = await sourceAssets(config.credentials.production);
  console.log(`Origem ${application.name}: ${assets.length} emoji(s).`);
  await replaceR2Emojis(assets, r2);
  console.log(`R2/emojis/ substituido integralmente com ${assets.length} arquivo(s), sem subpastas.`);
  if (mode === 'all') {
    await mirrorToDevelopment(assets, config.credentials.development);
    console.log(`BotDev espelhado com ${assets.length} emoji(s) do bot principal.`);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const mode = process.argv[2] === 'r2' ? 'r2' : 'all';
  main(mode).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : 'Falha desconhecida ao sincronizar emojis.');
    process.exitCode = 1;
  });
}
