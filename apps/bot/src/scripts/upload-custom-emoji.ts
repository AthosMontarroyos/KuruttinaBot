import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { Client, GatewayIntentBits } from 'discord.js';

// Load root .env file
const rootDir = path.resolve(__dirname, '../../../../');
dotenv.config({ path: path.join(rootDir, '.env') });

/**
 * Converts a local image file to a base64 Data URI string.
 */
function fileToDataUri(filePath: string): string {
  const fileBuffer = fs.readFileSync(filePath);
  const ext = path.extname(filePath).replace('.', '').toLowerCase();
  const mimeType = ext === 'gif' ? 'image/gif' : ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'image/png';
  return `data:${mimeType};base64,${fileBuffer.toString('base64')}`;
}

/**
 * Uploads a local image file as a new Application Emoji to the Discord Developer Portal.
 */
async function uploadApplicationEmoji(emojiName: string, imagePath: string): Promise<void> {
  const token = process.env.DISCORD_TOKEN;
  if (!token) {
    console.error('❌ DISCORD_TOKEN não encontrado no arquivo .env da raiz.');
    process.exit(1);
  }

  if (!fs.existsSync(imagePath)) {
    console.error(`❌ Arquivo de imagem não encontrado em: ${imagePath}`);
    process.exit(1);
  }

  const client = new Client({ intents: [GatewayIntentBits.Guilds] });

  client.on('ready', async () => {
    console.log(`\n======================================================`);
    console.log(`⚡ Connected to Discord API as: ${client.user?.tag}`);
    console.log(`======================================================\n`);

    try {
      if (!client.application) {
        throw new Error('client.application não está acessível no cliente.');
      }

      console.log(`🔄 Checking existing Application Emojis...`);
      const existingEmojis = await client.application.emojis.fetch();
      const existing = existingEmojis.find((e) => e.name?.toLowerCase() === emojiName.toLowerCase());

      if (existing) {
        console.log(`⚠️ Application Emoji "${emojiName}" já existe no Developer Portal (ID: ${existing.id}).`);
      } else {
        console.log(`🚀 Uploading new Application Emoji "${emojiName}" to Discord Developer Portal...`);
        const dataUri = fileToDataUri(imagePath);

        const createdEmoji = await client.application.emojis.create({
          name: emojiName,
          attachment: dataUri,
        });

        console.log(`✅ Application Emoji "${createdEmoji.name}" criado com sucesso!`);
        console.log(`   ID: ${createdEmoji.id}`);
        console.log(`   Format: ${createdEmoji.toString()}`);
      }
    } catch (err: any) {
      console.error('❌ Erro ao enviar Application Emoji:', err.message || err);
    } finally {
      client.destroy();
      process.exit(0);
    }
  });

  await client.login(token);
}

// Target: Upload banana_divider emoji from Pictures/branding/banana_divider.png
const imageFile = path.join(rootDir, 'Pictures', 'branding', 'banana_divider.png');
uploadApplicationEmoji('banana_divider', imageFile);
