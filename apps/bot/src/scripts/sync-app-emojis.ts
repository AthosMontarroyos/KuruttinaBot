import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { Client, GatewayIntentBits } from 'discord.js';

// Load root .env file
const rootDir = path.resolve(__dirname, '../../../../');
dotenv.config({ path: path.join(rootDir, '.env') });

const EMOJIS_DIR = path.join(rootDir, 'Pictures', 'emojis');
const CATALOG_PATH = path.join(EMOJIS_DIR, 'catalog.json');

export interface LocalEmojiCatalogEntry {
  name: string;
  id: string;
  format: string;
  animated: boolean;
  filename: string;
  localPath: string;
  cdnUrl: string;
  updatedAt: string;
}

export interface EmojiCatalogFile {
  total: number;
  lastSyncedAt: string;
  emojis: Record<string, LocalEmojiCatalogEntry>;
}

/**
 * Ensures the target directory exists.
 */
function ensureDirExists(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Downloads an image from a URL to a local destination file.
 */
async function downloadFile(url: string, destPath: string): Promise<void> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download image from ${url}: HTTP ${response.status}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  fs.writeFileSync(destPath, buffer);
}

/**
 * Reads existing catalog.json if available.
 */
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

/**
 * Synchronizes Discord Developer Portal Application Emojis into Pictures/emojis/
 */
async function syncApplicationEmojis(): Promise<void> {
  const token = process.env.DISCORD_TOKEN;
  if (!token) {
    console.error('❌ DISCORD_TOKEN não encontrado no arquivo .env da raiz.');
    process.exit(1);
  }

  ensureDirExists(EMOJIS_DIR);
  const previousCatalog = loadExistingCatalog();

  const client = new Client({ intents: [GatewayIntentBits.Guilds] });

  client.on('ready', async () => {
    console.log(`\n======================================================`);
    console.log(`⚡ Connected to Discord API as: ${client.user?.tag}`);
    console.log(`======================================================\n`);

    try {
      if (!client.application) {
        throw new Error('client.application não está acessível no cliente.');
      }

      console.log('🔄 Fetching Application Emojis from Discord Developer Portal...');
      const appEmojis = await client.application.emojis.fetch();
      console.log(`📦 Total Application Emojis found on Discord API: ${appEmojis.size}\n`);

      const activeEmojiMap = new Map<string, LocalEmojiCatalogEntry>();
      const currentFiles = fs.readdirSync(EMOJIS_DIR);
      const downloadedFilenames = new Set<string>();

      // 1. Download & Sync active Developer Portal Emojis
      for (const emoji of appEmojis.values()) {
        if (!emoji.name || !emoji.id) continue;

        const ext = emoji.animated ? 'gif' : 'png';
        const filename = `${emoji.name}.${ext}`;
        const localFilePath = path.join(EMOJIS_DIR, filename);
        const cdnUrl = `https://cdn.discordapp.com/emojis/${emoji.id}.${ext}?size=256&quality=lossless`;
        const formatStr = emoji.toString();

        downloadedFilenames.add(filename);

        const key = emoji.name.toLowerCase();
        const prevEntry = previousCatalog?.emojis?.[key];
        const isReplaced = prevEntry && (prevEntry.id !== emoji.id || prevEntry.animated !== emoji.animated);

        // Download if file does not exist locally OR if emoji was re-uploaded (new ID/format)
        if (!fs.existsSync(localFilePath) || isReplaced) {
          if (isReplaced) {
            console.log(`🔄 Replaced emoji detected: "${emoji.name}" (ID changed: ${prevEntry.id} -> ${emoji.id})`);
            // Clean old file if format changed (.png -> .gif or vice-versa)
            if (prevEntry.filename !== filename) {
              const oldFile = path.join(EMOJIS_DIR, prevEntry.filename);
              if (fs.existsSync(oldFile)) fs.unlinkSync(oldFile);
            }
          }
          console.log(`⬇️ Downloading emoji: "${emoji.name}" (${ext.toUpperCase()}) -> ${filename}`);
          await downloadFile(cdnUrl, localFilePath);
        } else {
          console.log(`✅ Emoji up-to-date: "${emoji.name}" -> ${filename}`);
        }

        activeEmojiMap.set(key, {
          name: emoji.name,
          id: emoji.id,
          format: formatStr,
          animated: emoji.animated || false,
          filename,
          localPath: `Pictures/emojis/${filename}`,
          cdnUrl,
          updatedAt: new Date().toISOString(),
        });
      }

      // 2. Prune discarded local emoji files (Clean Sync)
      console.log('\n🧹 Checking for discarded emojis to clean up...');
      let deletedCount = 0;
      for (const file of currentFiles) {
        if (file === 'catalog.json' || file.startsWith('.')) continue;

        if (!downloadedFilenames.has(file)) {
          const fileToDelete = path.join(EMOJIS_DIR, file);
          console.log(`🗑️ Removing discarded local emoji asset: ${file}`);
          fs.unlinkSync(fileToDelete);
          deletedCount++;
        }
      }

      if (deletedCount === 0) {
        console.log('✨ No discarded local emojis to remove.');
      }

      // 3. Write catalog.json Metadata Index
      const catalogData: EmojiCatalogFile = {
        total: activeEmojiMap.size,
        lastSyncedAt: new Date().toISOString(),
        emojis: Object.fromEntries(activeEmojiMap.entries()),
      };

      fs.writeFileSync(CATALOG_PATH, JSON.stringify(catalogData, null, 2), 'utf8');
      console.log(`\n📄 Catalog updated: ${CATALOG_PATH}`);

      console.log(`\n======================================================`);
      console.log(`🎉 Synchronization Complete! (${activeEmojiMap.size} active, ${deletedCount} pruned)`);
      console.log(`======================================================\n`);
    } catch (err: any) {
      console.error('❌ Erro na sincronização dos Application Emojis:', err.message || err);
    } finally {
      client.destroy();
      process.exit(0);
    }
  });

  await client.login(token);
}

syncApplicationEmojis();
