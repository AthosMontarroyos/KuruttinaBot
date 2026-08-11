import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { getEmojiAppConfigs, withAppClient, EmojiAppConfig } from '../../utils';
import { sanitizeEmojiName } from '@kuruttina/shared';

// Load root .env file
const rootDir = path.resolve(__dirname, '../../../../../');
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
  return withAppClient(appConfig.token, async (client: any) => {
    if (!client.application) {
      throw new Error('client.application não está acessível no cliente.');
    }

    const existingEmojis = await client.application.emojis.fetch();
    const existing = existingEmojis.find((e: any) => e.name?.toLowerCase() === emojiName.toLowerCase());

    if (existing) {
      console.log(`⚠️ Emoji "${emojiName}" já existe na App #${appConfig.id} (${appConfig.name}) (ID: ${existing.id}).`);
      return true;
    }

    if (existingEmojis.size >= 2000) {
      console.log(`⚠️ App #${appConfig.id} (${appConfig.name}) atingiu a cota máxima de 2.000 emojis da aplicação. Checando próxima app...`);
      return false;
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
    return true;
  });
}

/**
 * Uploads a local image file as a new Application Emoji across configured bot applications.
 */
async function main(): Promise<void> {
  const emojiName = process.argv[2]?.trim();
  const rawImagePath = process.argv[3]?.trim();
  const targetAppId = process.argv[4] ? parseInt(process.argv[4], 10) : undefined;

  if (!emojiName || !rawImagePath) {
    console.log('📌 Uso: npx ts-node src/scripts/upload-custom-emoji.ts <nome_do_emoji> <caminho_imagem> [app_id]');
    console.log('Exemplo: npx ts-node src/scripts/upload-custom-emoji.ts pink_butterfly_divider Pictures/branding/pink_butterfly_divider.png');
    process.exit(1);
  }

  const imagePath = path.isAbsolute(rawImagePath) ? rawImagePath : path.join(rootDir, rawImagePath);

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

main().catch((err) => {
  console.error('❌ Erro inesperado ao fazer upload de emoji:', err);
  process.exit(1);
});

