import path from 'path';
import dotenv from 'dotenv';
import { Client, GatewayIntentBits } from 'discord.js';

// Load root .env file
const rootDir = path.resolve(__dirname, '../../../../');
dotenv.config({ path: path.join(rootDir, '.env') });

async function deleteEmojiByName(emojiName: string): Promise<void> {
  const token = process.env.DISCORD_TOKEN;
  if (!token) {
    console.error('❌ DISCORD_TOKEN não encontrado no arquivo .env da raiz.');
    process.exit(1);
  }

  const client = new Client({ intents: [GatewayIntentBits.Guilds] });

  client.on('ready', async () => {
    try {
      if (!client.application) {
        throw new Error('client.application não está acessível no cliente.');
      }

      console.log(`🔄 Fetching Application Emojis...`);
      const appEmojis = await client.application.emojis.fetch();
      const target = appEmojis.find((e) => e.name?.toLowerCase() === emojiName.toLowerCase());

      if (target) {
        console.log(`🗑️ Deleting Application Emoji "${target.name}" (ID: ${target.id})...`);
        await client.application.emojis.delete(target.id);
        console.log(`✅ Emoji "${emojiName}" deletado com sucesso do Developer Portal.`);
      } else {
        console.log(`⚠️ Emoji "${emojiName}" não encontrado.`);
      }
    } catch (err: any) {
      console.error('❌ Erro ao deletar emoji:', err.message || err);
    } finally {
      client.destroy();
      process.exit(0);
    }
  });

  await client.login(token);
}

deleteEmojiByName('banana_divider');
