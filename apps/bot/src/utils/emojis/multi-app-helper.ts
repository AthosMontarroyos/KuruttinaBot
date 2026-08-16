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
  category?: 'characters' | 'interactions' | string;
  categoria?: 'characters' | 'interactions' | string;
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
}

export function sanitizeFolderName(rawName: string): string {
  const clean = rawName.replace(/[^a-zA-Z0-9_-]/g, '');
  return clean || 'KuruttinaEmojiVault';
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
      reject(new Error(`Failed to log in client with token: ${err.message || err}`));
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
  customName?: string
): Promise<EmojiAppConfig> {
  return withAppClient(token, async (client) => {
    if (client.application) {
      try {
        await client.application.fetch();
      } catch {
        // Ignore fetch error if scope lacks full OAuth details
      }
    }

    const appName = customName || client.application?.name || client.user?.username || `AppVault${appIndex}`;
    const botTag = client.user?.tag || appName;
    const appId = client.application?.id || client.user?.id;

    // Primary app uses 'KuruttinaBotEmojis', secondary apps use clean bot name (e.g. 'ManosabaGirlsEmojis')
    const folderName = isPrimary ? 'KuruttinaBotEmojis' : sanitizeFolderName(appName);

    return {
      id: appIndex,
      name: appName,
      category: category || (isPrimary ? 'primary' : 'characters'),
      sanitizedFolderName: folderName,
      token,
      isPrimary,
      appId,
      botTag,
    };
  });
}

/**
 * Array Pipeline:
 * 1. Primary Bot (Kuruttina)
 * 2. Array of Secondary Bots (config/emoji-vaults.json or EMOJI_BOT_TOKENS)
 */
export async function getEmojiAppConfigs(): Promise<EmojiAppConfig[]> {
  const primaryToken = process.env.DISCORD_TOKEN;
  if (!primaryToken || isPlaceholderToken(primaryToken)) {
    console.error('❌ DISCORD_TOKEN not found in root .env file.');
    process.exit(1);
  }

  // Step 1: Start with Primary Bot (Kuruttina)
  const primaryApp = await discoverAppConfig(primaryToken, true, 1, 'primary');

  // Step 2: Load Secondary Bots from config/emoji-vaults.json or EMOJI_BOT_TOKENS
  const entries: { token: string; name?: string; category?: string }[] = [];

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
      const parsed = JSON.parse(content);
      const list: any[] = Array.isArray(parsed) ? parsed : [parsed];
      for (const item of list) {
        if (typeof item === 'string' && item && !isPlaceholderToken(item)) {
          entries.push({ token: item.trim() });
        } else if (typeof item === 'object' && item?.token && !isPlaceholderToken(item.token)) {
          entries.push({
            token: item.token.trim(),
            name: item.name || item.nome,
            category: item.category || item.categoria || 'characters',
          });
        }
      }
    } catch (err: any) {
      console.warn(`⚠️ Warning: Failed to parse ${targetFile}: ${err.message}`);
    }
  }

  // Fallback to process.env.EMOJI_BOT_TOKENS if no entries found from file
  if (entries.length === 0) {
    const rawTokens = (process.env.EMOJI_BOT_TOKENS || '').trim();

    if (rawTokens.startsWith('[') || rawTokens.startsWith('{')) {
      try {
        const parsed = JSON.parse(rawTokens);
        const list: any[] = Array.isArray(parsed) ? parsed : [parsed];
        for (const item of list) {
          if (typeof item === 'string' && item && !isPlaceholderToken(item)) {
            entries.push({ token: item.trim() });
          } else if (typeof item === 'object' && item?.token && !isPlaceholderToken(item.token)) {
            entries.push({
              token: item.token.trim(),
              name: item.name || item.nome,
              category: item.category || item.categoria || 'characters',
            });
          }
        }
      } catch {
        console.warn('⚠️ Could not parse EMOJI_BOT_TOKENS as JSON, falling back to comma-separated list.');
      }
    }

    if (entries.length === 0 && rawTokens.length > 0 && !rawTokens.startsWith('[') && !rawTokens.startsWith('{')) {
      const splitTokens = rawTokens
        .split(',')
        .map((t) => t.trim())
        .filter((t) => t.length > 0 && !isPlaceholderToken(t));

      for (const t of splitTokens) {
        entries.push({ token: t, category: 'characters' });
      }
    }
  }

  const secondaryApps: EmojiAppConfig[] = [];
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    try {
      const cfg = await discoverAppConfig(entry.token, false, i + 2, entry.category, entry.name);
      secondaryApps.push(cfg);
    } catch (err: any) {
      console.warn(`⚠️ Warning: Failed to load secondary bot #${i + 1} (${entry.name || 'unnamed'}): ${err.message}`);
    }
  }

  // Return Unified App Array: [PrimaryBot, ...SecondaryBots]
  return [primaryApp, ...secondaryApps];
}

