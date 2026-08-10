import path from 'path';
import dotenv from 'dotenv';
import { Client, GatewayIntentBits } from 'discord.js';

// Load root .env file
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

/**
 * Standardized Application Emoji Inspection Tool for Kuruttina.
 * Fetches and audits all custom emojis uploaded to Discord Developer Portal.
 */
async function inspectApplicationEmojis(): Promise<void> {
  const token = process.env.DISCORD_TOKEN;
  if (!token) {
    console.error('❌ DISCORD_TOKEN não encontrado no .env da raiz.');
    process.exit(1);
  }

  const client = new Client({ intents: [GatewayIntentBits.Guilds] });

  client.on('ready', async () => {
    console.log(`\n======================================================`);
    console.log(`⚡ Connected to Discord API as: ${client.user?.tag}`);
    console.log(`======================================================\n`);

    try {
      if (!client.application) {
        throw new Error('client.application não está disponível no cliente.');
      }

      const appEmojis = await client.application.emojis.fetch();
      console.log(`📦 Total Application Emojis in Developer Portal: ${appEmojis.size}\n`);

      if (appEmojis.size === 0) {
        console.log('⚠️ Nenhum Application Emoji cadastrado no Developer Portal.');
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

      console.log(`\n======================================================`);
      console.log(`✅ Inspeção de Emojis do Developer Portal concluída!`);
      console.log(`======================================================\n`);
    } catch (err: any) {
      console.error('❌ Erro ao buscar emojis do Developer Portal:', err.message || err);
    } finally {
      client.destroy();
      process.exit(0);
    }
  });

  await client.login(token);
}

inspectApplicationEmojis();
