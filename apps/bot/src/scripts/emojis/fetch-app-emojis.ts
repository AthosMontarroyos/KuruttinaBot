import path from 'path';
import dotenv from 'dotenv';
import { Client, GatewayIntentBits, Events } from 'discord.js';
import { getEmojiAppConfigs, EmojiAppConfig } from '../../utils';

// Load root .env file
dotenv.config({ path: path.resolve(__dirname, '../../../../../.env') });

async function inspectAppEmojis(appConfig: EmojiAppConfig): Promise<void> {
  const client = new Client({ intents: [GatewayIntentBits.Guilds] });

  await new Promise<void>((resolve, reject) => {
    client.on(Events.ClientReady, async () => {
      console.log(`\n======================================================`);
      console.log(`⚡ App #${appConfig.id} (${appConfig.name}) | Bot: ${client.user?.tag}`);
      console.log(`======================================================`);

      try {
        if (!client.application) {
          throw new Error('client.application não está disponível no cliente.');
        }

        const appEmojis = await client.application.emojis.fetch();
        const staticCount = appEmojis.filter((e) => !e.animated).size;
        const animCount = appEmojis.filter((e) => e.animated).size;

        console.log(`📦 Emojis in App #${appConfig.id}: Total ${appEmojis.size}/2000 (Static: ${staticCount} | Animated: ${animCount})\n`);

        if (appEmojis.size === 0) {
          console.log('⚠️ Nenhum Application Emoji cadastrado nesta aplicação.');
        } else {
          const sortedEmojis = Array.from(appEmojis.values()).sort((a, b) =>
            (a.name || '').localeCompare(b.name || '')
          );

          sortedEmojis.forEach((e, idx) => {
            const typeLabel = e.animated ? 'ANIMATED (GIF/APNG)' : 'STATIC (PNG/WEBP)';
            console.log(
              `  ${String(idx + 1).padStart(2, ' ')}. Name: "${e.name?.padEnd(14, ' ')}" | ID: "${e.id}" | Format: ${e.toString().padEnd(35, ' ')} | Type: ${typeLabel}`
            );
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
 * Standardized Multi-App Application Emoji Inspection Tool for Kuruttina.
 */
async function inspectAllApplicationEmojis(): Promise<void> {
  const appConfigs = await getEmojiAppConfigs();
  console.log(`\n🔍 Inspecting Application Emojis across ${appConfigs.length} configured bot app(s)...`);

  for (const config of appConfigs) {
    try {
      await inspectAppEmojis(config);
    } catch (err: any) {
      console.error(`❌ Erro ao inspecionar App #${config.id} (${config.name}):`, err.message || err);
    }
  }

  console.log(`\n======================================================`);
  console.log(`✅ Inspeção Multi-App de Emojis concluída!`);
  console.log(`======================================================\n`);
  process.exit(0);
}

inspectAllApplicationEmojis();
