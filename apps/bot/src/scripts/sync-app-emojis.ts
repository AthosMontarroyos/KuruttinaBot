import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { Client, GatewayIntentBits, Events } from 'discord.js';
import { getEmojiAppConfigs, EmojiAppConfig } from '../utils/multi-app-helper';

// Load root .env file
const rootDir = path.resolve(__dirname, '../../../../');
dotenv.config({ path: path.join(rootDir, '.env') });

const ROOT_EMOJIS_DIR = path.join(rootDir, 'Pictures/emojis');
const PRIMARY_EMOJIS_DIR = path.join(ROOT_EMOJIS_DIR, 'KuruttinaBotEmojis');
const CATALOG_PATH = path.join(PRIMARY_EMOJIS_DIR, 'catalog.json');

const isForceDownload =
  process.argv.includes('--force') ||
  process.argv.includes('--fresh') ||
  process.argv.includes('-f');

export interface LocalEmojiCatalogEntry {
  name: string;
  id: string;
  format: string;
  animated: boolean;
  filename: string;
  localPath: string;
  cdnUrl: string;
  appIndex: number;
  appName: string;
  appFolder: string;
  appId?: string;
  updatedAt: string;
}

export interface EmojiCatalogFile {
  total: number;
  totalApps: number;
  lastSyncedAt: string;
  emojis: Record<string, LocalEmojiCatalogEntry>;
}

function ensureDirExists(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

async function downloadFile(url: string, destPath: string): Promise<void> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download image from ${url}: HTTP ${response.status}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  fs.writeFileSync(destPath, buffer);
}

function loadExistingCatalog(): EmojiCatalogFile | null {
  try {
    if (fs.existsSync(CATALOG_PATH)) {
      const content = fs.readFileSync(CATALOG_PATH, 'utf8');
      return JSON.parse(content);
    }
  } catch {
    // Ignore invalid JSON
  }
  return null;
}

async function syncEmojisForApp(
  appConfig: EmojiAppConfig,
  previousCatalog: EmojiCatalogFile | null,
  activeEmojiMap: Map<string, LocalEmojiCatalogEntry>,
  downloadedFilenamesPerFolder: Map<string, Set<string>>
): Promise<void> {
  const client = new Client({ intents: [GatewayIntentBits.Guilds] });
  const appDir = path.join(ROOT_EMOJIS_DIR, appConfig.sanitizedFolderName);
  ensureDirExists(appDir);

  if (!downloadedFilenamesPerFolder.has(appDir)) {
    downloadedFilenamesPerFolder.set(appDir, new Set<string>());
  }
  const folderDownloadedFiles = downloadedFilenamesPerFolder.get(appDir)!;

  await new Promise<void>((resolve, reject) => {
    client.on(Events.ClientReady, async () => {
      console.log(`\n======================================================`);
      console.log(`⚡ App #${appConfig.id} ("${appConfig.name}") connected as: ${client.user?.tag}`);
      console.log(`📂 Destination Folder: Pictures/emojis/${appConfig.sanitizedFolderName}/`);
      console.log(`======================================================`);

      try {
        if (!client.application) {
          throw new Error('client.application is not accessible on the client.');
        }

        console.log(`🔄 Fetching Application Emojis from Discord Developer Portal...`);
        const appEmojis = await client.application.emojis.fetch();
        console.log(`📦 Found ${appEmojis.size} Application Emojis for App #${appConfig.id}\n`);

        const applicationId = client.application.id;

        for (const emoji of appEmojis.values()) {
          if (!emoji.name || !emoji.id) continue;

          const ext = emoji.animated ? 'gif' : 'png';
          const filename = `${emoji.name}.${ext}`;
          const localFilePath = path.join(appDir, filename);
          // Add cache buster timestamp to prevent HTTP caching of updated image assets
          const cdnUrl = `https://cdn.discordapp.com/emojis/${emoji.id}.${ext}?size=256&quality=lossless&t=${Date.now()}`;
          const formatStr = emoji.toString();

          folderDownloadedFiles.add(filename);

          const key = emoji.name.toLowerCase();
          const prevEntry = previousCatalog?.emojis?.[key];
          const isReplaced = prevEntry && (prevEntry.id !== emoji.id || prevEntry.animated !== emoji.animated);

          if (isForceDownload || !fs.existsSync(localFilePath) || isReplaced) {
            if (isReplaced) {
              console.log(`🔄 Replaced emoji detected: "${emoji.name}" (ID changed: ${prevEntry.id} -> ${emoji.id})`);
              if (prevEntry.filename !== filename) {
                const oldFile = path.join(appDir, prevEntry.filename);
                if (fs.existsSync(oldFile)) fs.unlinkSync(oldFile);
              }
            }
            console.log(`⬇️ Downloading emoji: "${emoji.name}" (${ext.toUpperCase()}) [App #${appConfig.id}] -> ${filename}`);
            await downloadFile(cdnUrl, localFilePath);
          } else {
            console.log(`✅ Emoji up-to-date: "${emoji.name}" [App #${appConfig.id}] -> ${filename}`);
          }

          activeEmojiMap.set(key, {
            name: emoji.name,
            id: emoji.id,
            format: formatStr,
            animated: emoji.animated || false,
            filename,
            localPath: `Pictures/emojis/${appConfig.sanitizedFolderName}/${filename}`,
            cdnUrl: `https://cdn.discordapp.com/emojis/${emoji.id}.${ext}?size=256&quality=lossless`,
            appIndex: appConfig.id,
            appName: appConfig.name,
            appFolder: appConfig.sanitizedFolderName,
            appId: applicationId,
            updatedAt: new Date().toISOString(),
          });
        }

        resolve();
      } catch (err) {
        reject(err);
      } finally {
        client.destroy();
      }
    });

    client.login(appConfig.token).catch(reject);
  });
}

/**
 * Synchronizes Multi-App Discord Developer Portal Application Emojis into Pictures/emojis/{AppName}/
 */
async function syncApplicationEmojis(): Promise<void> {
  ensureDirExists(PRIMARY_EMOJIS_DIR);
  const previousCatalog = loadExistingCatalog();
  const appConfigs = await getEmojiAppConfigs();

  console.log(`\n🚀 Starting Multi-App Emoji Synchronization across ${appConfigs.length} Application(s)...`);
  if (isForceDownload) {
    console.log(`⚡ Force download mode enabled (--force). Re-downloading all images from Discord CDN...\n`);
  }

  const activeEmojiMap = new Map<string, LocalEmojiCatalogEntry>();
  const downloadedFilenamesPerFolder = new Map<string, Set<string>>();

  for (const appConfig of appConfigs) {
    try {
      await syncEmojisForApp(appConfig, previousCatalog, activeEmojiMap, downloadedFilenamesPerFolder);
    } catch (err: any) {
      console.error(`❌ Erro ao sincronizar App #${appConfig.id} (${appConfig.name}):`, err.message || err);
    }
  }

  // Prune discarded local emoji files across all app folders
  console.log('\n🧹 Checking for discarded emojis across application folders...');
  let totalDeletedCount = 0;

  for (const [folderPath, downloadedSet] of downloadedFilenamesPerFolder.entries()) {
    if (fs.existsSync(folderPath)) {
      const filesOnDisk = fs.readdirSync(folderPath);
      for (const file of filesOnDisk) {
        if (file === 'catalog.json') continue;
        if (!downloadedSet.has(file)) {
          const obsoletePath = path.join(folderPath, file);
          try {
            fs.unlinkSync(obsoletePath);
            const relativePath = path.relative(rootDir, obsoletePath);
            console.log(`🗑️ Removing discarded local emoji asset: ${relativePath}`);
            totalDeletedCount++;
          } catch {
            // Ignore deletion errors
          }
        }
      }
    }
  }

  if (totalDeletedCount === 0) {
    console.log('✨ No discarded local emojis or obsolete folders to remove.');
  }

  // Save catalog.json to primary folder
  const catalogData: EmojiCatalogFile = {
    total: activeEmojiMap.size,
    totalApps: appConfigs.length,
    lastSyncedAt: new Date().toISOString(),
    emojis: Object.fromEntries(activeEmojiMap.entries()),
  };

  fs.writeFileSync(CATALOG_PATH, JSON.stringify(catalogData, null, 2), 'utf8');
  console.log(`\n📄 Catalog updated: ${CATALOG_PATH}`);
  console.log(`\n======================================================`);
  console.log(`🎉 Multi-App Sync Complete! (${activeEmojiMap.size} active emojis across ${appConfigs.length} apps, ${totalDeletedCount} pruned)`);
  console.log(`======================================================\n`);
}

syncApplicationEmojis().catch((err) => {
  console.error('❌ Fatal error during emoji synchronization:', err);
  process.exit(1);
});
