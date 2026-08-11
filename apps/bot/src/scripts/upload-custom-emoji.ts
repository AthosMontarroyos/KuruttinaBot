import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { Client, GatewayIntentBits, Events } from 'discord.js';
import { getEmojiAppConfigs, EmojiAppConfig } from '../utils/multi-app-helper';
import { sanitizeEmojiName } from '@kuruttina/shared';

// Load root .env file
const rootDir = path.resolve(__dirname, '../../../../');
dotenv.config({ path: path.join(rootDir, '.env') });

function fileToDataUri(filePath: string): string {
  const fileBuffer = fs.readFileSync(filePath);
  const ext = path.extname(filePath).replace('.', '').toLowerCase();
  const mimeType = ext === 'gif' ? 'image/gif' : ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'image/png';
  return `data:${mimeType};base64,${fileBuffer.toString('base64')}`;
}

async function uploadToApp(
  appConfig: EmojiAppConfig,
  rawEmojiName: string,
  imagePath: string
): Promise<boolean> {
  const emojiName = sanitizeEmojiName(rawEmojiName);
  const client = new Client({ intents: [GatewayIntentBits.Guilds] });

  return new Promise<boolean>((resolve, reject) => {
    client.on(Events.ClientReady, async () => {
      try {
        if (!client.application) {
          throw new Error('client.application não está acessível no cliente.');
        }

        const existingEmojis = await client.application.emojis.fetch();
        const existing = existingEmojis.find((e) => e.name?.toLowerCase() === emojiName.toLowerCase());

        if (existing) {
          console.log(`⚠️ Emoji "${emojiName}" já existe na App #${appConfig.id} (${appConfig.name}) (ID: ${existing.id}).`);
          resolve(true);
          return;
        }

        if (existingEmojis.size >= 2000) {
          console.log(`⚠️ App #${appConfig.id} (${appConfig.name}) atingiu a cota máxima de 2.000 emojis da aplicação. Checando próxima app...`);
          resolve(false);
          return;
        }

        console.log(`🚀 Uploading new emoji "${emojiName}" para App #${appConfig.id} (${appConfig.name})...`);
        const dataUri = fileToDataUri(imagePath);

        const createdEmoji = await client.application.emojis.create({
          name: emojiName,
          attachment: dataUri,
        });

        console.log(`✅ Application Emoji "${createdEmoji.name}" criado com sucesso na App #${appConfig.id}!`);
        console.log(`   ID: ${createdEmoji.id}`);
        console.log(`   Format: ${createdEmoji.toString()}`);
        resolve(true);
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
 * Uploads a local image file as a new Application Emoji across configured bot applications.
 */
async function uploadApplicationEmoji(emojiName: string, imagePath: string, targetAppId?: number): Promise<void> {
  if (!fs.existsSync(imagePath)) {
    console.error(`❌ Arquivo de imagem não encontrado em: ${imagePath}`);
    process.exit(1);
  }

  const appConfigs = await getEmojiAppConfigs();
  const targetConfigs = targetAppId
    ? appConfigs.filter((c) => c.id === targetAppId)
    : appConfigs;

  if (targetConfigs.length === 0) {
    console.error(`❌ Nenhuma aplicação configurada para ID #${targetAppId}.`);
    process.exit(1);
  }

  let uploaded = false;
  for (const config of targetConfigs) {
    try {
      uploaded = await uploadToApp(config, emojiName, imagePath);
      if (uploaded) break;
    } catch (err: any) {
      console.error(`❌ Erro no upload para App #${config.id}:`, err.message || err);
    }
  }

  if (!uploaded) {
    console.error(`❌ Não foi possível fazer upload do emoji "${emojiName}". Todas as apps configuradas estão cheias.`);
  }

  process.exit(0);
}

// Target: Upload banana_divider emoji from Pictures/branding/banana_divider.png
const imageFile = path.join(rootDir, 'Pictures', 'branding', 'banana_divider.png');
uploadApplicationEmoji('banana_divider', imageFile);
