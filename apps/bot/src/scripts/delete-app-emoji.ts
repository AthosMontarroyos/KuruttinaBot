import path from 'path';
import dotenv from 'dotenv';
import { Client, GatewayIntentBits } from 'discord.js';
import { getEmojiAppConfigs, EmojiAppConfig } from '../utils/multi-app-helper';

// Load root .env file
const rootDir = path.resolve(__dirname, '../../../../');
dotenv.config({ path: path.join(rootDir, '.env') });

async function deleteFromApp(appConfig: EmojiAppConfig, emojiName: string): Promise<boolean> {
  const client = new Client({ intents: [GatewayIntentBits.Guilds] });

  return new Promise<boolean>((resolve, reject) => {
    client.on('ready', async () => {
      try {
        if (!client.application) {
          throw new Error('client.application não está acessível no cliente.');
        }

        const appEmojis = await client.application.emojis.fetch();
        const target = appEmojis.find((e) => e.name?.toLowerCase() === emojiName.toLowerCase());

        if (target) {
          console.log(`🗑️ Deleting Application Emoji "${target.name}" (ID: ${target.id}) na App #${appConfig.id} (${appConfig.name})...`);
          await client.application.emojis.delete(target.id);
          console.log(`✅ Emoji "${emojiName}" deletado com sucesso da App #${appConfig.id}.`);
          resolve(true);
        } else {
          resolve(false);
        }
      } catch (err) {
        reject(err);
      } finally {
        client.destroy();
      }
    });

    client.login(appConfig.token).catch(reject);
  });
}

async function deleteEmojiByName(emojiName: string): Promise<void> {
  const appConfigs = await getEmojiAppConfigs();
  let deleted = false;

  for (const config of appConfigs) {
    try {
      const res = await deleteFromApp(config, emojiName);
      if (res) {
        deleted = true;
        break;
      }
    } catch (err: any) {
      console.error(`❌ Erro ao buscar/deletar emoji na App #${config.id}:`, err.message || err);
    }
  }

  if (!deleted) {
    console.log(`⚠️ Emoji "${emojiName}" não foi encontrado em nenhuma das ${appConfigs.length} aplicações configuradas.`);
  }

  process.exit(0);
}

deleteEmojiByName('banana_divider');
