import path from 'path';
import dotenv from 'dotenv';
import { Client, GatewayIntentBits, Events } from 'discord.js';

// Load root .env file
const rootDir = path.resolve(__dirname, '../../../../');
dotenv.config({ path: path.join(rootDir, '.env') });

export interface EmojiAppConfig {
  id: number;
  name: string;
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
    lower.includes('aux_bot_token_3') ||
    lower.includes('aux_bot_token')
  );
}

/**
 * Connects to Discord API to auto-discover Application Name, Bot Username, Application ID and Folder Name.
 */
export async function discoverAppConfig(
  token: string,
  isPrimary: boolean,
  appIndex: number
): Promise<EmojiAppConfig> {
  const client = new Client({ intents: [GatewayIntentBits.Guilds] });

  return new Promise<EmojiAppConfig>((resolve, reject) => {
    client.on(Events.ClientReady, async () => {
      try {
        if (client.application) {
          try {
            await client.application.fetch();
          } catch {
            // Ignore fetch error if scope lacks full OAuth details
          }
        }

        const appName = client.application?.name || client.user?.username || `AppVault${appIndex}`;
        const botTag = client.user?.tag || appName;
        const appId = client.application?.id || client.user?.id;

        // Primary app uses 'KuruttinaBotEmojis', secondary apps use clean bot name (e.g. 'ManosabaGirlsEmojis')
        const folderName = isPrimary ? 'KuruttinaBotEmojis' : sanitizeFolderName(appName);

        const config: EmojiAppConfig = {
          id: appIndex,
          name: appName,
          sanitizedFolderName: folderName,
          token,
          isPrimary,
          appId,
          botTag,
        };

        resolve(config);
      } catch (err) {
        reject(err);
      } finally {
        client.destroy();
      }
    });

    client.login(token).catch((err) => {
      reject(new Error(`Failed to connect token for App #${appIndex}: ${err.message || err}`));
    });
  });
}

/**
 * Array Pipeline:
 * 1. Primary Bot (Kuruttina)
 * 2. Array of Secondary Bots (EMOJI_BOT_TOKENS) displaying each bot's name
 */
export async function getEmojiAppConfigs(): Promise<EmojiAppConfig[]> {
  const primaryToken = process.env.DISCORD_TOKEN;
  if (!primaryToken || isPlaceholderToken(primaryToken)) {
    console.error('❌ DISCORD_TOKEN not found in root .env file.');
    process.exit(1);
  }

  // Step 1: Start with Primary Bot (Kuruttina)
  const primaryApp = await discoverAppConfig(primaryToken, true, 1);

  // Step 2: Array of Secondary Bots from EMOJI_BOT_TOKENS
  const secondaryTokens = (process.env.EMOJI_BOT_TOKENS || '')
    .split(',')
    .map((t) => t.trim())
    .filter((t) => t.length > 0 && !isPlaceholderToken(t));

  const secondaryApps: EmojiAppConfig[] = [];
  for (let i = 0; i < secondaryTokens.length; i++) {
    try {
      const cfg = await discoverAppConfig(secondaryTokens[i], false, i + 2);
      secondaryApps.push(cfg);
    } catch (err: any) {
      console.warn(`⚠️ Warning: Failed to load secondary bot #${i + 1}: ${err.message}`);
    }
  }

  // Return Unified App Array: [PrimaryBot, ...SecondaryBots]
  return [primaryApp, ...secondaryApps];
}
