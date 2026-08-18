import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { Client, GatewayIntentBits, Events } from 'discord.js';

// Load root .env file
const rootDir = path.resolve(__dirname, '../../../../../');
dotenv.config({ path: path.join(rootDir, '.env') });

export interface EmojiVaultEntry {
  name?: string;
  nome?: string;
  key?: string;
  slug?: string;
  id?: string | number;
  aliases?: string[];
  alias?: string | string[];
  category?: 'characters' | 'interactions' | string;
  categoria?: 'characters' | 'interactions' | string;
  appId?: string;
  applicationId?: string;
  clientId?: string;
  botTag?: string;
  token: string;
}

export interface EmojiAppConfig {
  id: number;
  name: string;
  category?: string;
  sanitizedFolderName: string;
  token: string;
  isPrimary: boolean;
  appId?: string;
  botTag?: string;
  selector: string;
  aliases: string[];
}

export interface GetEmojiAppConfigsOptions {
  /** Avoid logging in to every app when only the configured options are needed. */
  discoverRemote?: boolean;
}

export interface EmojiAppMetadata {
  name?: string;
  category?: string;
  selector?: string;
  aliases?: string[];
  appId?: string;
  botTag?: string;
}

export function sanitizeFolderName(rawName: string): string {
  const clean = rawName.replace(/[^a-zA-Z0-9_-]/g, '');
  return clean || 'KuruttinaEmojiVault';
}

function asString(value: unknown): string | undefined {
  if (typeof value === 'string' || typeof value === 'number') {
    const normalized = String(value).trim();
    return normalized || undefined;
  }

  return undefined;
}

function asStringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(asString).filter((item): item is string => Boolean(item));
  }

  const singleValue = asString(value);
  return singleValue ? [singleValue] : [];
}

function uniqueStrings(values: Array<string | undefined>): string[] {
  return [
    ...new Set(
      values
        .map((value) => value?.trim())
        .filter((value): value is string => Boolean(value))
    ),
  ];
}

function createAppConfig(
  token: string,
  isPrimary: boolean,
  appIndex: number,
  metadata: EmojiAppMetadata = {}
): EmojiAppConfig {
  const name = metadata.name || (isPrimary ? 'Vault Principal' : 'AppVault' + appIndex);
  const selector = metadata.selector || (isPrimary ? 'principal' : sanitizeFolderName(name).toLowerCase());
  const folderName = isPrimary ? 'KuruttinaBotEmojis' : sanitizeFolderName(name);

  return {
    id: appIndex,
    name,
    category: metadata.category || (isPrimary ? 'primary' : 'characters'),
    sanitizedFolderName: folderName,
    token,
    isPrimary,
    appId: metadata.appId,
    botTag: metadata.botTag,
    selector,
    aliases: uniqueStrings([
      selector,
      ...(metadata.aliases || []),
      name,
      folderName,
      metadata.appId,
      String(appIndex),
      isPrimary ? 'principal' : undefined,
      isPrimary ? 'primary' : undefined,
      isPrimary ? 'main' : undefined,
    ]),
  };
}

function isPlaceholderToken(token: string): boolean {
  if (!token) return true;
  const lower = token.toLowerCase();
  return (
    lower.includes('your_discord_bot_token') ||
    lower.includes('your_aux_bot_token') ||
    lower.includes('aux_bot_token_3') ||
    lower.includes('aux_bot_token')
  );
}

/**
 * Safely executes an async action using an ephemeral Discord Client connected to a target bot app.
 * Guarantees client.destroy() is called in a finally block to prevent memory leaks and dangling sockets.
 */
export async function withAppClient<T>(
  token: string,
  fn: (client: Client) => Promise<T>
): Promise<T> {
  const client = new Client({ intents: [GatewayIntentBits.Guilds] });

  return new Promise<T>((resolve, reject) => {
    client.on(Events.ClientReady, async () => {
      try {
        const result = await fn(client);
        resolve(result);
      } catch (err) {
        reject(err);
      } finally {
        client.destroy();
      }
    });

    client.login(token).catch((err) => {
      reject(new Error('Failed to log in client with token: ' + (err.message || err)));
    });
  });
}

/**
 * Connects to Discord API to auto-discover Application Name, Bot Username, Application ID and Folder Name.
 */
export async function discoverAppConfig(
  token: string,
  isPrimary: boolean,
  appIndex: number,
  category?: string,
  customName?: string,
  metadata: EmojiAppMetadata = {}
): Promise<EmojiAppConfig> {
  return withAppClient(token, async (client) => {
    if (client.application) {
      try {
        await client.application.fetch();
      } catch {
        // Ignore fetch error if scope lacks full OAuth details
      }
    }

    const appName = customName || metadata.name || client.application?.name || client.user?.username || 'AppVault' + appIndex;
    const botTag = metadata.botTag || client.user?.tag || appName;
    const appId = metadata.appId || client.application?.id || client.user?.id;

    // Primary app uses 'KuruttinaBotEmojis', secondary apps use clean bot name (e.g. 'ManosabaGirlsEmojis')
    const folderName = isPrimary ? 'KuruttinaBotEmojis' : sanitizeFolderName(appName);

    return {
      id: appIndex,
      name: appName,
      category: metadata.category || category || (isPrimary ? 'primary' : 'characters'),
      sanitizedFolderName: folderName,
      token,
      isPrimary,
      appId,
      botTag,
      selector: metadata.selector || (isPrimary ? 'principal' : sanitizeFolderName(appName).toLowerCase()),
      aliases: uniqueStrings([
        metadata.selector,
        ...(metadata.aliases || []),
        appName,
        folderName,
        appId,
        String(appIndex),
        isPrimary ? 'principal' : undefined,
        isPrimary ? 'primary' : undefined,
        isPrimary ? 'main' : undefined,
      ]),
    };
  });
}

function parseVaultEntry(item: unknown): EmojiVaultEntry | null {
  if (typeof item === 'string') {
    const token = item.trim();
    return token && !isPlaceholderToken(token) ? { token } : null;
  }

  if (!item || typeof item !== 'object') return null;

  const raw = item as Record<string, unknown>;
  const token = asString(raw.token);
  if (!token || isPlaceholderToken(token)) return null;

  return {
    token,
    name: asString(raw.name),
    nome: asString(raw.nome),
    key: asString(raw.key),
    slug: asString(raw.slug),
    id: typeof raw.id === 'string' || typeof raw.id === 'number' ? raw.id : undefined,
    aliases: asStringList(raw.aliases),
    alias: raw.alias as string | string[] | undefined,
    category: asString(raw.category),
    categoria: asString(raw.categoria),
    appId: asString(raw.appId),
    applicationId: asString(raw.applicationId),
    clientId: asString(raw.clientId),
    botTag: asString(raw.botTag),
  };
}

function metadataFromEntry(entry: EmojiVaultEntry): EmojiAppMetadata {
  return {
    name: entry.name || entry.nome,
    category: entry.category || entry.categoria,
    selector: entry.key || entry.slug || asString(entry.id),
    aliases: [...(entry.aliases || []), ...asStringList(entry.alias)],
    appId: entry.appId || entry.applicationId || entry.clientId,
    botTag: entry.botTag,
  };
}

function readConfiguredEntries(): EmojiVaultEntry[] {
  const entries: EmojiVaultEntry[] = [];
  const configPath = path.join(rootDir, 'config/emoji-vaults.json');
  const rootConfigPath = path.join(rootDir, 'emoji-vaults.json');

  const targetFile = fs.existsSync(configPath)
    ? configPath
    : fs.existsSync(rootConfigPath)
    ? rootConfigPath
    : null;

  if (targetFile) {
    try {
      const content = fs.readFileSync(targetFile, 'utf-8').trim();
      const parsed: unknown = JSON.parse(content);
      const list: unknown[] = Array.isArray(parsed) ? parsed : [parsed];

      for (const item of list) {
        const entry = parseVaultEntry(item);
        if (entry) entries.push(entry);
      }
    } catch (err: any) {
      console.warn('⚠️ Warning: Failed to parse ' + targetFile + ': ' + err.message);
    }
  }

  // Fallback to process.env.EMOJI_BOT_TOKENS if no entries were found in the JSON file.
  if (entries.length === 0) {
    const rawTokens = (process.env.EMOJI_BOT_TOKENS || '').trim();

    if (rawTokens.startsWith('[') || rawTokens.startsWith('{')) {
      try {
        const parsed: unknown = JSON.parse(rawTokens);
        const list: unknown[] = Array.isArray(parsed) ? parsed : [parsed];
        for (const item of list) {
          const entry = parseVaultEntry(item);
          if (entry) entries.push(entry);
        }
      } catch {
        console.warn('⚠️ Could not parse EMOJI_BOT_TOKENS as JSON, falling back to comma-separated list.');
      }
    }

    if (entries.length === 0 && rawTokens.length > 0 && !rawTokens.startsWith('[') && !rawTokens.startsWith('{')) {
      for (const token of rawTokens.split(',')) {
        const entry = parseVaultEntry(token);
        if (entry) entries.push(entry);
      }
    }
  }

  return entries;
}

/**
 * Array Pipeline:
 * 1. Primary Bot (Kuruttina)
 * 2. Array of Secondary Bots (config/emoji-vaults.json or EMOJI_BOT_TOKENS)
 */
export async function getEmojiAppConfigs(
  options: GetEmojiAppConfigsOptions = {}
): Promise<EmojiAppConfig[]> {
  const primaryToken = process.env.DISCORD_TOKEN;
  if (!primaryToken || isPlaceholderToken(primaryToken)) {
    console.error('❌ DISCORD_TOKEN not found in root .env file.');
    process.exit(1);
  }

  const entries = readConfiguredEntries();
  const shouldDiscoverRemote = options.discoverRemote !== false;

  // The lightweight path avoids logging in to every app during autocomplete and command selection.
  const primaryApp = shouldDiscoverRemote
    ? await discoverAppConfig(primaryToken, true, 1, 'primary')
    : createAppConfig(primaryToken, true, 1, { category: 'primary' });

  const secondaryApps: EmojiAppConfig[] = [];
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const metadata = metadataFromEntry(entry);
    try {
      const cfg = shouldDiscoverRemote
        ? await discoverAppConfig(entry.token, false, i + 2, metadata.category, metadata.name, metadata)
        : createAppConfig(entry.token, false, i + 2, metadata);
      secondaryApps.push(cfg);
    } catch (err: any) {
      console.warn('⚠️ Warning: Failed to load secondary bot #' + (i + 1) + ' (' + (entry.name || entry.nome || 'unnamed') + '): ' + err.message);
    }
  }

  // Return Unified App Array: [PrimaryBot, ...SecondaryBots]
  return [primaryApp, ...secondaryApps];
}
