import path from 'path';
import dotenv from 'dotenv';
import { getEmojiAppConfigs, withAppClient, EmojiAppConfig } from '../utils/multi-app-helper';

// Load root .env file
const rootDir = path.resolve(__dirname, '../../../../');
dotenv.config({ path: path.join(rootDir, '.env') });

async function deleteFromApp(appConfig: EmojiAppConfig, emojiName: string): Promise<boolean> {
  return withAppClient(appConfig.token, async (client) => {
    if (!client.application) {
      throw new Error('client.application não está acessível no cliente.');
    }

    const appEmojis = await client.application.emojis.fetch();
    const target = appEmojis.find((e) => e.name?.toLowerCase() === emojiName.toLowerCase());

    if (target) {
      console.log(`🗑️ Deleting Application Emoji "${target.name}" (ID: ${target.id}) na App #${appConfig.id} (${appConfig.name})...`);
      await client.application.emojis.delete(target.id);
      console.log(`✅ Emoji "${emojiName}" deletado com sucesso da App #${appConfig.id}.`);
      return true;
    }
    return false;
  });
}

async function main(): Promise<void> {
  const emojiName = process.argv[2]?.trim();

  if (!emojiName) {
    console.log('📌 Uso: npx ts-node src/scripts/delete-app-emoji.ts <nome_do_emoji>');
    console.log('Exemplo: npx ts-node src/scripts/delete-app-emoji.ts pink_butterfly_divider');
    process.exit(1);
  }

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

main().catch((err) => {
  console.error('❌ Erro inesperado ao deletar emoji:', err);
  process.exit(1);
});

