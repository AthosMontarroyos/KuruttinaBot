import { Client, Events, GatewayIntentBits, Options, Partials } from 'discord.js';
import { createDatabase } from '@kuruttina/database';
import { createEmojiImportService } from '#bot/application/emojis/importEmoji.js';
import { loadCommands } from '#bot/command-system/loadCommands.js';
import { loadConfig } from '#bot/config.js';
import { createCentralDeployment } from '#bot/deployments/central.js';
import { createGuildDeployment } from '#bot/deployments/guild.js';
import { handleClientReady } from '#bot/events/client/clientReady.js';
import { handleInteractionCreate } from '#bot/events/interactions/interactionCreate.js';
import { handleMessageCreate } from '#bot/events/messages/messageCreate.js';
import { CommandsHandler } from '#bot/command-system/CommandsHandler.js';
import { DeploymentsHandler } from '#bot/handlers/DeploymentsHandler.js';
import { verifyBotIdentity } from '#bot/infrastructure/discord/identity.js';
import { createDiscordEmojiAdapter } from '#bot/infrastructure/discord/emojis/emojiAdapter.js';
import { createProductionApplicationEmojiWriter } from '#bot/infrastructure/discord/emojis/productionApplicationEmojis.js';
import { createDiscordImageDownloader } from '#bot/infrastructure/images/downloadDiscordImage.js';
import { createSharpEmojiProcessor } from '#bot/infrastructure/images/sharpEmojiProcessor.js';
import { configureLogger, log } from '#bot/infrastructure/logging/logger.js';

export async function startBot(correlationId: string): Promise<void> {
  const config = loadConfig();
  configureLogger(config.target);
  log('success', 'config_loaded', { target: config.target, autoSyncCommands: config.autoSyncCommands });
  const database = createDatabase(config.database, config.target, (diagnostic) => log('error', 'database_connection_failed', { correlationId, ...diagnostic }));
  let client: Client | undefined;
  let shutdownListener: ((signal: string) => void) | undefined;
  try {
    await database.getSettings();
    const commands = await loadCommands(undefined, correlationId);
    client = new Client({
      intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.DirectMessages, GatewayIntentBits.MessageContent],
      partials: [Partials.Channel],
      makeCache: Options.cacheWithLimits({ ...Options.DefaultMakeCacheSettings, MessageManager: 0 }),
      allowedMentions: { parse: [], repliedUser: false },
    });
    // Uma única fila. Emojis de servidor usam o client ativo; Application Emojis
    // vão sempre para a aplicação de produção, sem Gateway dessa credencial.
    const productionEmojis = createProductionApplicationEmojiWriter(config.credentials.production);
    const emojiImport = createEmojiImportService({
      download: createDiscordImageDownloader(),
      processor: createSharpEmojiProcessor(),
      create: createDiscordEmojiAdapter(client, productionEmojis),
    });
    const commandsHandler = new CommandsHandler(commands, database, emojiImport);
    const deploymentsHandler = new DeploymentsHandler([
      createCentralDeployment(commandsHandler), createGuildDeployment(commandsHandler, database.getSettings),
    ]);
    log('info', 'identity_validation_started', { correlationId, target: config.target });
    const applicationId = await verifyBotIdentity(config.activeCredential.token, config.activeCredential.expectedBotId);
    log('success', 'identity_validated', { applicationId, correlationId });
    if (config.autoSyncCommands) await deploymentsHandler.run({ config, applicationId, correlationId });
    else log('info', 'command_sync_skipped', { correlationId });

    client.once(Events.ClientReady, (readyClient) => handleClientReady(readyClient, config.target, correlationId));
    client.on(Events.InteractionCreate, (interaction) => { void handleInteractionCreate(interaction, commandsHandler); });
    client.on(Events.MessageCreate, (message) => { void handleMessageCreate(message, commandsHandler); });
    log('info', 'events_loaded', { count: 3, events: [Events.ClientReady, Events.InteractionCreate, Events.MessageCreate].join(', '), correlationId });

    let stopping = false;
    shutdownListener = (signal: string): void => {
      if (stopping) return;
      stopping = true;
      log('info', 'shutdown_started', { correlationId, signal });
      const deadline = setTimeout(() => process.exit(1), 5000);
      void (async () => {
        try {
          // Stop admission first, let accepted commands finish while Discord remains connected.
          await commandsHandler.stop();
          await client?.destroy();
          await database.close();
          clearTimeout(deadline);
          log('success', 'shutdown_completed', { correlationId, signal });
        } catch {
          log('error', 'shutdown_failed', { correlationId });
          process.exitCode = 1;
        }
      })();
    };
    process.once('SIGTERM', shutdownListener);
    process.once('SIGINT', shutdownListener);
    log('info', 'gateway_connecting', { correlationId });
    await client.login(config.activeCredential.token);
  } catch (error) {
    if (shutdownListener) {
      process.off('SIGTERM', shutdownListener);
      process.off('SIGINT', shutdownListener);
    }
    try { await client?.destroy(); } finally { await database.close(); }
    throw error;
  }
}
