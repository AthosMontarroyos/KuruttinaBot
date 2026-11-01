import { Client, Events, GatewayIntentBits, Options, Partials } from 'discord.js';
import { createDatabase } from '@kuruttina/database';
import type { ComponentAction, MessageTemplate } from '@kuruttina/message-templates';
import { createEmojiImportService } from '#bot/application/emojis/importEmoji.js';
import { loadCommands } from '#bot/command-system/loadCommands.js';
import { loadConfig } from '#bot/config.js';
import { createCentralDeployment } from '#bot/deployments/central.js';
import { createGuildDeployment } from '#bot/deployments/guild.js';
import { handleClientReady } from '#bot/events/client/clientReady.js';
import { handleInteractionCreate } from '#bot/events/interactions/interactionCreate.js';
import { handleMemberEvent } from '#bot/events/members/memberEvents.js';
import { handleMessageCreate } from '#bot/events/messages/messageCreate.js';
import { CommandsHandler } from '#bot/command-system/CommandsHandler.js';
import { DeploymentsHandler } from '#bot/handlers/DeploymentsHandler.js';
import { verifyBotIdentity } from '#bot/infrastructure/discord/identity.js';
import { createDiscordEmojiAdapter } from '#bot/infrastructure/discord/emojis/emojiAdapter.js';
import { createEmojiLookup } from '#bot/infrastructure/discord/emojis/emojiLookup.js';
import type { ComponentActionPort } from '#bot/infrastructure/discord/messages/componentRouter.js';
import { createDeliveryPoller, type DeliveryDatabasePort } from '#bot/infrastructure/discord/messages/deliveryPoller.js';
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
      intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildMessages, GatewayIntentBits.DirectMessages, GatewayIntentBits.MessageContent],
      partials: [Partials.Channel],
      makeCache: Options.cacheWithLimits({ ...Options.DefaultMakeCacheSettings, MessageManager: 0 }),
      allowedMentions: { parse: [], repliedUser: false },
    });
    // Uma única fila. Emojis de servidor usam o client ativo e as mesmas
    // fábricas de download e processamento do workflow de produção. Application
    // Emojis do bot de produção entram só por esse workflow, sem este token.
    const emojiImport = createEmojiImportService({
      download: createDiscordImageDownloader(),
      processor: createSharpEmojiProcessor(),
      create: createDiscordEmojiAdapter(client),
    });
    const commandsHandler = new CommandsHandler(commands, database, emojiImport, createEmojiLookup(client));
    // Adapta `database.templates` ao formato que o roteador de componentes e o
    // poller de entregas esperam: o conteúdo persistido já passou pela
    // validação do motor de templates (etapa 1C), então o cast é seguro aqui.
    const componentPort: ComponentActionPort = {
      findComponent: async (guildId, customId) => {
        const component = await database.templates.findComponent(guildId, customId);
        return component ? { kind: component.kind, action: component.action as ComponentAction } : null;
      },
      getTemplate: async (guildId, name) => {
        const record = await database.templates.getContent(guildId, name);
        return record ? { content: record.content as MessageTemplate } : null;
      },
      getButtonConfig: (guildId, id) => database.customActionsConfig.getButton(guildId, id),
      getSelectConfig: (guildId, id) => database.customActionsConfig.getSelect(guildId, id),
    };
    const deliveryDatabasePort: DeliveryDatabasePort = {
      deliveries: database.deliveries,
      templates: { getTemplate: componentPort.getTemplate },
    };
    const deploymentsHandler = new DeploymentsHandler([
      createCentralDeployment(commandsHandler), createGuildDeployment(commandsHandler, database.getSettings),
    ]);
    log('info', 'identity_validation_started', { correlationId, target: config.target });
    const applicationId = await verifyBotIdentity(config.activeCredential.token, config.activeCredential.expectedBotId);
    log('success', 'identity_validated', { applicationId, correlationId });
    if (config.autoSyncCommands) await deploymentsHandler.run({ config, applicationId, correlationId });
    else log('info', 'command_sync_skipped', { correlationId });

    client.once(Events.ClientReady, (readyClient) => handleClientReady(readyClient, config.target, correlationId));
    client.on(Events.InteractionCreate, (interaction) => { void handleInteractionCreate(interaction, commandsHandler, componentPort); });
    client.on(Events.MessageCreate, (message) => { void handleMessageCreate(message, commandsHandler); });
    client.on(Events.GuildMemberAdd, (member) => { void handleMemberEvent('join', member, database); });
    client.on(Events.GuildMemberRemove, (member) => { void handleMemberEvent('leave', member, database); });
    log('info', 'events_loaded', {
      count: 5,
      events: [Events.ClientReady, Events.InteractionCreate, Events.MessageCreate, Events.GuildMemberAdd, Events.GuildMemberRemove].join(', '),
      correlationId,
    });
    // Poller da fila de entrega (etapa 1D): publica nos canais pedidos pelo site.
    const deliveryPoller = createDeliveryPoller(client, deliveryDatabasePort);

    let stopping = false;
    shutdownListener = (signal: string): void => {
      if (stopping) return;
      stopping = true;
      log('info', 'shutdown_started', { correlationId, signal });
      const deadline = setTimeout(() => process.exit(1), 5000);
      void (async () => {
        try {
          // Stop admission first, let accepted commands finish while Discord remains connected.
          deliveryPoller.stop();
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
