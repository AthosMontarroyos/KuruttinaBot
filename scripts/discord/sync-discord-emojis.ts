import { execFile } from 'node:child_process';
import { readFile, writeFile, mkdir, mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { loadConfig } from '../../apps/bot/src/config.ts';
import 'dotenv/config';

const API_BASE = 'https://discord.com/api/v10';
const CDN_BASE = 'https://cdn.discordapp.com/emojis';
const REQUEST_TIMEOUT_MS = 15_000;
const MAX_EMOJI_BYTES = 2 * 1024 * 1024;
const MAX_APPLICATION_EMOJI_BYTES = 256 * 1024;
const execFileAsync = promisify(execFile);

type Credential = { label: string; token: string; expectedBotId?: string };
type DiscordApplication = {
  id: string;
  name: string;
  owner?: { id?: string; username?: string };
  team?: { id: string; name: string } | null;
};
type DiscordEmoji = { id: string; name: string; animated?: boolean };
type SyncedEmoji = DiscordEmoji & { relativePath: string; sourceEmojiId?: string };
type SyncedApplication = { app: DiscordApplication; teamName: string; emojis: SyncedEmoji[] };
type PreviousMirrorEntry = { sourceEmojiId: string; targetEmojiId: string };

function assertRecord(value: unknown, context: string): asserts value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error(`${context} deve ser um objeto.`);
}

function discordErrorDetail(value: unknown, path = ''): string[] {
  if (Array.isArray(value)) return value.flatMap((item, index) => discordErrorDetail(item, `${path}[${index}]`));
  if (typeof value !== 'object' || value === null) return [];
  const record = value as Record<string, unknown>;
  const errorMarker = path.indexOf('._errors');
  const ownMessage = typeof record.message === 'string' && errorMarker >= 0
    ? [`${path.slice(0, errorMarker) || 'payload'}: ${record.message.slice(0, 160)}`]
    : [];
  return ownMessage.concat(Object.entries(record).flatMap(([key, item]) => discordErrorDetail(item, path ? `${path}.${key}` : key)));
}

export function safeSegment(value: string): string {
  const normalized = value.normalize('NFKC').replace(/[<>:"/\\|?*\u0000-\u001f]/gu, '-').replace(/[. ]+$/gu, '').trim();
  return (normalized || 'sem-nome').slice(0, 100);
}

export function parseVaults(value: unknown): Credential[] {
  assertRecord(value, 'config/emojis/emojis.local.json');
  if (!Array.isArray(value.vaults)) throw new Error('config/emojis/emojis.local.json precisa conter o array vaults.');
  return value.vaults.map((item, index) => {
    assertRecord(item, `vaults[${index}]`);
    const allowed = new Set(['token', 'nome', 'name', 'descricao', 'categoria']);
    const unexpected = Object.keys(item).filter((key) => !allowed.has(key));
    if (unexpected.length > 0) throw new Error(`vaults[${index}] possui campos desconhecidos: ${unexpected.join(', ')}.`);
    if (typeof item.token !== 'string' || item.token.trim() === '') throw new Error(`vaults[${index}].token e obrigatorio.`);
    const name = typeof item.nome === 'string' ? item.nome : item.name;
    if (typeof name !== 'string' || name.trim() === '') throw new Error(`vaults[${index}].nome e obrigatorio.`);
    return { label: `vault:${name.trim()}`, token: item.token };
  });
}

export function previousMirrorState(value: unknown, sourceApplicationId: string, targetApplicationId: string): Map<string, PreviousMirrorEntry> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return new Map();
  const applications = (value as Record<string, unknown>).applications;
  if (!Array.isArray(applications)) return new Map();
  const findApplication = (id: string): Record<string, unknown> | undefined => applications.find((item): item is Record<string, unknown> => (
    typeof item === 'object' && item !== null && !Array.isArray(item) && (item as Record<string, unknown>).applicationId === id
  ));
  const source = findApplication(sourceApplicationId);
  const target = findApplication(targetApplicationId);
  if (!source || !target || !Array.isArray(source.emojis) || !Array.isArray(target.emojis)) return new Map();
  const sourceIds = new Map<string, string>();
  for (const item of source.emojis) {
    if (typeof item !== 'object' || item === null || Array.isArray(item)) continue;
    const emoji = item as Record<string, unknown>;
    if (typeof emoji.name === 'string' && typeof emoji.id === 'string') sourceIds.set(emoji.name, emoji.id);
  }
  const result = new Map<string, PreviousMirrorEntry>();
  for (const item of target.emojis) {
    if (typeof item !== 'object' || item === null || Array.isArray(item)) continue;
    const emoji = item as Record<string, unknown>;
    if (typeof emoji.name !== 'string' || typeof emoji.id !== 'string') continue;
    const sourceEmojiId = typeof emoji.sourceEmojiId === 'string' ? emoji.sourceEmojiId : sourceIds.get(emoji.name);
    if (sourceEmojiId) result.set(emoji.name, { sourceEmojiId, targetEmojiId: emoji.id });
  }
  return result;
}

async function discordJson<T>(path: string, token: string): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bot ${token}`, 'User-Agent': 'KuruttinaBot emoji sync' },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) {
    let detail = '';
    try {
      const payload = await response.json() as { code?: unknown; message?: unknown; errors?: unknown };
      const code = typeof payload.code === 'number' ? ` codigo ${payload.code}` : '';
      const message = typeof payload.message === 'string' ? `: ${payload.message.slice(0, 200)}` : '';
      const validation = discordErrorDetail(payload.errors).join('; ');
      detail = `${code}${message}${validation ? ` (${validation})` : ''}`;
    } catch {
      // The status and route remain sufficient when Discord does not return JSON.
    }
    throw new Error(`Discord respondeu HTTP ${response.status}${detail} em ${path}.`);
  }
  return (await response.json()) as T;
}

async function discordMutation<T>(path: string, token: string, method: 'POST' | 'PATCH' | 'DELETE', body?: unknown): Promise<T | undefined> {
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bot ${token}`,
      'User-Agent': 'KuruttinaBot emoji sync',
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) {
    let detail = '';
    try {
      const payload = await response.json() as { code?: unknown; message?: unknown; errors?: unknown };
      const code = typeof payload.code === 'number' ? ` codigo ${payload.code}` : '';
      const message = typeof payload.message === 'string' ? `: ${payload.message.slice(0, 200)}` : '';
      const validation = discordErrorDetail(payload.errors).join('; ');
      detail = `${code}${message}${validation ? ` (${validation})` : ''}`;
    } catch {
      // The status and route remain sufficient when Discord does not return JSON.
    }
    throw new Error(`Discord respondeu HTTP ${response.status}${detail} em ${path}.`);
  }
  if (response.status === 204) return undefined;
  return (await response.json()) as T;
}

async function assertR2Available(projectRoot: string): Promise<string> {
  const rclone = join(projectRoot, '.tools', 'rclone', 'rclone.exe');
  try {
    await stat(rclone);
    await execFileAsync(rclone, ['lsd', 'kurrutina-r2:kurrutina-bot-pictures'], { timeout: REQUEST_TIMEOUT_MS, windowsHide: true });
  } catch {
    throw new Error('Cloudflare R2 nao esta acessivel pelo perfil kurrutina-r2. Verifique o rclone e a conexao.');
  }
  return rclone;
}

async function isR2MountActive(projectRoot: string): Promise<boolean> {
  const statePath = join(projectRoot, '.tools', 'r2-mount', 'rclone-state.json');
  try {
    const state = JSON.parse((await readFile(statePath, 'utf8')).replace(/^\uFEFF/u, '')) as unknown;
    assertRecord(state, 'estado da montagem R2');
    if (typeof state.pid !== 'number' || typeof state.mountPoint !== 'string') return false;
    if (resolve(state.mountPoint) !== resolve(projectRoot, 'R2')) return false;
    process.kill(state.pid, 0);
    await stat(join(projectRoot, 'R2'));
    return true;
  } catch {
    return false;
  }
}

async function ensureR2Mount(projectRoot: string): Promise<void> {
  if (await isR2MountActive(projectRoot)) {
    console.log('Bucket R2 inteiro ja esta montado em R2/.');
    return;
  }
  console.log('Bucket R2 inteiro nao esta montado; iniciando mount em R2/...');
  await execFileAsync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', join(projectRoot, 'scripts', 'r2', 'mount-r2-pictures.ps1')], {
    cwd: projectRoot,
    timeout: 30_000,
    windowsHide: true,
  });
  if (!(await isR2MountActive(projectRoot))) throw new Error('O mount do bucket R2 inteiro nao ficou ativo em R2/.');
  console.log('Bucket R2 inteiro montado em R2/.');
}

async function fetchEmojiBytes(emoji: DiscordEmoji): Promise<Uint8Array> {
  const url = `${CDN_BASE}/${emoji.id}.webp${emoji.animated ? '?animated=true' : ''}`;
  const response = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS), redirect: 'error' });
  if (!response.ok || !response.body) throw new Error(`Falha ao baixar emoji ${emoji.id}: HTTP ${response.status}.`);
  const declaredSize = Number(response.headers.get('content-length') ?? 0);
  if (declaredSize > MAX_EMOJI_BYTES) throw new Error(`Emoji ${emoji.id} excede o limite de 2 MiB.`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > MAX_EMOJI_BYTES) throw new Error(`Emoji ${emoji.id} excede o limite de 2 MiB.`);
  return bytes;
}

async function downloadEmoji(emoji: DiscordEmoji, destination: string): Promise<void> {
  await writeFile(destination, await fetchEmojiBytes(emoji));
}

function escapeHtml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

function pathToHtmlUrl(value: string): string {
  return value.split(/[\\/]/u).map(encodeURIComponent).join('/');
}

export function renderGallery(applications: SyncedApplication[]): string {
  const sections = applications.map(({ app, teamName, emojis }) => `<section><h2>${escapeHtml(teamName)} / ${escapeHtml(app.name)}</h2><div class="grid">${emojis.map((emoji) => `<figure><img src="${escapeHtml(pathToHtmlUrl(emoji.relativePath))}" loading="lazy" alt="${escapeHtml(emoji.name)}"><figcaption>:${escapeHtml(emoji.name)}:<small>${emoji.id}</small></figcaption></figure>`).join('')}</div></section>`).join('');
  return `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Emojis dos apps</title><style>body{font:16px system-ui;background:#111827;color:#f9fafb;margin:2rem}h1{margin-bottom:2rem}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:1rem}figure{margin:0;padding:1rem;background:#1f2937;border-radius:.75rem;text-align:center}img{width:72px;height:72px;object-fit:contain}figcaption{overflow-wrap:anywhere}small{display:block;color:#9ca3af;margin-top:.35rem;font-size:.7rem}</style><h1>Emojis dos apps Discord</h1>${sections}</html>`;
}

async function syncCredential(credential: Credential, root: string): Promise<SyncedApplication> {
  const currentUser = await discordJson<{ id?: string; bot?: boolean }>('/users/@me', credential.token);
  if (!currentUser.bot || typeof currentUser.id !== 'string') throw new Error(`${credential.label}: a credencial nao pertence a um bot.`);
  if (credential.expectedBotId && currentUser.id !== credential.expectedBotId) throw new Error(`${credential.label}: a identidade do bot nao corresponde ao ID configurado.`);
  const app = await discordJson<DiscordApplication>('/oauth2/applications/@me', credential.token);
  if (app.id !== currentUser.id || typeof app.name !== 'string') throw new Error(`${credential.label}: resposta de aplicacao inconsistente.`);
  const payload = await discordJson<{ items?: DiscordEmoji[] }>(`/applications/${app.id}/emojis`, credential.token);
  if (!Array.isArray(payload.items)) throw new Error(`${credential.label}: resposta de emojis invalida.`);
  const teamName = app.team?.name ?? `individual-${app.owner?.username ?? app.owner?.id ?? 'sem-proprietario'}`;
  const appDirectory = join(root, safeSegment(teamName), safeSegment(app.name));
  await mkdir(appDirectory, { recursive: true });
  const emojis: SyncedEmoji[] = [];
  for (const emoji of payload.items) {
    if (!/^\d{17,20}$/u.test(emoji.id) || typeof emoji.name !== 'string' || emoji.name.length === 0) throw new Error(`${credential.label}: emoji invalido retornado pelo Discord.`);
    const filename = `${safeSegment(emoji.name)}--${emoji.id}.webp`;
    await downloadEmoji(emoji, join(appDirectory, filename));
    emojis.push({ ...emoji, relativePath: join(safeSegment(teamName), safeSegment(app.name), filename) });
  }
  return { app, teamName, emojis };
}

export function bytesEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.byteLength !== right.byteLength) return false;
  return left.every((value, index) => value === right[index]);
}

async function prepareApplicationEmoji(emoji: DiscordEmoji, source: Uint8Array): Promise<Uint8Array> {
  if (source.byteLength <= MAX_APPLICATION_EMOJI_BYTES) return source;
  for (const size of [128, 112, 96, 80, 64]) {
    for (const quality of [80, 65, 50, 35, 20]) {
      const encoded = await sharp(source, { animated: Boolean(emoji.animated) })
        .resize(size, size, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality, effort: 6 })
        .toBuffer();
      if (encoded.byteLength <= MAX_APPLICATION_EMOJI_BYTES) return new Uint8Array(encoded);
    }
  }
  throw new Error(`${emoji.name}: nao foi possivel reduzir o emoji para 256 KiB.`);
}

async function applicationForCredential(credential: Credential): Promise<DiscordApplication> {
  const currentUser = await discordJson<{ id?: string; bot?: boolean }>('/users/@me', credential.token);
  if (!currentUser.bot || typeof currentUser.id !== 'string') throw new Error(`${credential.label}: a credencial nao pertence a um bot.`);
  if (credential.expectedBotId && currentUser.id !== credential.expectedBotId) throw new Error(`${credential.label}: a identidade do bot nao corresponde ao ID configurado.`);
  const app = await discordJson<DiscordApplication>('/oauth2/applications/@me', credential.token);
  if (app.id !== currentUser.id || typeof app.name !== 'string') throw new Error(`${credential.label}: resposta de aplicacao inconsistente.`);
  return app;
}

async function mirrorApplicationEmojis(
  source: SyncedApplication,
  targetCredential: Credential,
  stagingRoot: string,
  previousMirror: Map<string, PreviousMirrorEntry>,
): Promise<SyncedApplication> {
  const targetApp = await applicationForCredential(targetCredential);
  if (targetApp.id === source.app.id) throw new Error('As aplicacoes principal e de desenvolvimento precisam ser distintas.');
  const payload = await discordJson<{ items?: DiscordEmoji[] }>(`/applications/${targetApp.id}/emojis`, targetCredential.token);
  if (!Array.isArray(payload.items)) throw new Error(`${targetCredential.label}: resposta de emojis invalida.`);
  for (const emoji of payload.items) {
    if (!/^\d{17,20}$/u.test(emoji.id) || typeof emoji.name !== 'string' || emoji.name.length === 0) {
      throw new Error(`${targetCredential.label}: emoji invalido retornado pelo Discord.`);
    }
  }

  const sourceNames = new Set(source.emojis.map(({ name }) => name));
  const remainingTargets = [...payload.items];
  const mirrored: SyncedEmoji[] = [];

  for (const sourceEmoji of source.emojis) {
    const originalBytes = new Uint8Array(await readFile(join(stagingRoot, sourceEmoji.relativePath)));
    const sourceBytes = await prepareApplicationEmoji(sourceEmoji, originalBytes);
    const candidates = remainingTargets.filter(({ name }) => name === sourceEmoji.name);
    const previous = previousMirror.get(sourceEmoji.name);
    const sourceWasRecreated = previous !== undefined && previous.sourceEmojiId !== sourceEmoji.id;
    let matching: DiscordEmoji | undefined;
    for (const candidate of sourceWasRecreated ? [] : candidates) {
      if (Boolean(candidate.animated) !== Boolean(sourceEmoji.animated)) continue;
      if (bytesEqual(sourceBytes, await fetchEmojiBytes(candidate))) {
        matching = candidate;
        break;
      }
    }

    if (!matching) {
      const replaced = candidates[0];
      if (replaced) {
        await discordMutation(`/applications/${targetApp.id}/emojis/${replaced.id}`, targetCredential.token, 'PATCH', {
          name: `sync_old_${replaced.id.slice(-20)}`,
        });
      }
      try {
        try {
          matching = await discordMutation<DiscordEmoji>(`/applications/${targetApp.id}/emojis`, targetCredential.token, 'POST', {
            name: sourceEmoji.name,
            image: `data:image/webp;base64,${Buffer.from(sourceBytes).toString('base64')}`,
          });
        } catch (error: unknown) {
          const reason = error instanceof Error ? error.message : 'erro desconhecido';
          throw new Error(`${sourceEmoji.name}: ${reason}`);
        }
      } catch (error: unknown) {
        if (replaced) {
          try {
            await discordMutation(`/applications/${targetApp.id}/emojis/${replaced.id}`, targetCredential.token, 'PATCH', { name: sourceEmoji.name });
          } catch {
            throw new Error(`${targetCredential.label}: falha ao criar ${sourceEmoji.name} e restaurar o nome anterior.`);
          }
        }
        throw error;
      }
      if (!matching || !/^\d{17,20}$/u.test(matching.id) || matching.name !== sourceEmoji.name) {
        throw new Error(`${targetCredential.label}: emoji criado retornou uma resposta invalida.`);
      }
    }
    for (const candidate of candidates) {
      const index = remainingTargets.findIndex(({ id }) => id === candidate.id);
      if (index >= 0) remainingTargets.splice(index, 1);
      if (candidate.id !== matching.id) {
        await discordMutation(`/applications/${targetApp.id}/emojis/${candidate.id}`, targetCredential.token, 'DELETE');
      }
    }
    mirrored.push({ ...matching, relativePath: sourceEmoji.relativePath, sourceEmojiId: sourceEmoji.id });
  }

  for (const targetEmoji of remainingTargets) {
    if (!sourceNames.has(targetEmoji.name)) {
      await discordMutation(`/applications/${targetApp.id}/emojis/${targetEmoji.id}`, targetCredential.token, 'DELETE');
    }
  }

  const teamName = targetApp.team?.name ?? `individual-${targetApp.owner?.username ?? targetApp.owner?.id ?? 'sem-proprietario'}`;
  return { app: targetApp, teamName, emojis: mirrored };
}

export async function main(): Promise<void> {
  const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
  await ensureR2Mount(projectRoot);
  const rclone = await assertR2Available(projectRoot);
  const config = loadConfig(process.env);
  const vaultConfig = JSON.parse(await readFile(join(projectRoot, 'config', 'emojis', 'emojis.local.json'), 'utf8')) as unknown;
  const development: Credential = { label: 'development', token: config.credentials.development.token, expectedBotId: config.credentials.development.expectedBotId };
  const production: Credential = { label: 'production', token: config.credentials.production.token, expectedBotId: config.credentials.production.expectedBotId };
  const vaults = parseVaults(vaultConfig).filter(({ token }) => token !== development.token && token !== production.token);
  let previousManifest: unknown;
  try {
    previousManifest = JSON.parse(await readFile(join(projectRoot, 'R2', 'emojis', 'manifest.json'), 'utf8')) as unknown;
  } catch {
    previousManifest = undefined;
  }
  const previousMirror = previousMirrorState(
    previousManifest,
    config.credentials.production.expectedBotId,
    config.credentials.development.expectedBotId,
  );
  const stagingRoot = await mkdtemp(join(tmpdir(), 'kuruttina-emojis-'));
  try {
    const synced: SyncedApplication[] = [];
    process.stdout.write('Sincronizando production... ');
    const source = await syncCredential(production, stagingRoot);
    synced.push(source);
    console.log(`${source.emojis.length} emoji(s), Team: ${source.teamName}.`);

    process.stdout.write('Espelhando production em development... ');
    const developmentMirror = await mirrorApplicationEmojis(source, development, stagingRoot, previousMirror);
    synced.push(developmentMirror);
    console.log(`${developmentMirror.emojis.length} emoji(s), sem duplicar arquivos no R2.`);

    for (const credential of vaults) {
      process.stdout.write(`Sincronizando ${credential.label}... `);
      const result = await syncCredential(credential, stagingRoot);
      synced.push(result);
      console.log(`${result.emojis.length} emoji(s), Team: ${result.teamName}.`);
    }
    await writeFile(join(stagingRoot, 'index.html'), renderGallery(synced), 'utf8');
    await writeFile(join(stagingRoot, 'manifest.json'), `${JSON.stringify({ generatedAt: new Date().toISOString(), applications: synced.map(({ app, teamName, emojis }) => ({ team: teamName, applicationId: app.id, applicationName: app.name, emojis })) }, null, 2)}\n`, 'utf8');
    await execFileAsync(rclone, ['sync', stagingRoot, 'kurrutina-r2:kurrutina-bot-pictures/emojis', '--create-empty-src-dirs'], { timeout: 120_000, windowsHide: true });
    console.log('R2/emojis/ sincronizado; arquivos descartados foram removidos.');
  } finally {
    await rm(stagingRoot, { recursive: true, force: true });
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : 'Falha desconhecida ao sincronizar emojis.');
    process.exitCode = 1;
  });
}
