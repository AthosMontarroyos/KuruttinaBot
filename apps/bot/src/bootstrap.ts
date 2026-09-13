import { Client, Events, GatewayIntentBits, Options, Partials } from 'discord.js';
import { loadCommands } from '#bot/commands/loadCommands.js';
import { loadConfig } from '#bot/config.js';
import { createCentralDeployment } from '#bot/deployments/central.js';
import { handleClientReady } from '#bot/events/client/clientReady.js';
import { handleInteractionCreate } from '#bot/events/interactions/interactionCreate.js';
import { handleMessageCreate } from '#bot/events/messages/messageCreate.js';
import { CommandsHandler } from '#bot/handlers/CommandsHandler.js';
import { DeploymentsHandler } from '#bot/handlers/DeploymentsHandler.js';
import { verifyBotIdentity } from '#bot/infrastructure/discord/identity.js';
import { log } from '#bot/infrastructure/logger.js';

export async function startBot(correlationId: string): Promise<void> {
  const config = loadConfig();
  const registeredCommands = await loadCommands(undefined, correlationId);
  const commandsHandler = new CommandsHandler(registeredCommands);
  const deploymentsHandler = new DeploymentsHandler([createCentralDeployment(commandsHandler)]);
  const applicationId = await verifyBotIdentity(config.activeCredential.token, config.activeCredential.expectedBotId);

  if (config.autoSyncCommands) {
    await deploymentsHandler.run({ config, applicationId, correlationId });
  }

  const client = new Client({
    // Message content enables the fixed prefixes; DirectMessages preserves slash DM availability.
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.DirectMessages, GatewayIntentBits.MessageContent],
    partials: [Partials.Channel],
    makeCache: Options.cacheWithLimits({ ...Options.DefaultMakeCacheSettings, MessageManager: 0 }),
    allowedMentions: { parse: [], repliedUser: false },
  });

  client.once(Events.ClientReady, (readyClient) => handleClientReady(readyClient, config.target, correlationId));
  client.on(Events.InteractionCreate, (interaction) => { void handleInteractionCreate(interaction, commandsHandler); });
  client.on(Events.MessageCreate, (message) => { void handleMessageCreate(message, commandsHandler); });

  let stopping = false;
  const shutdown = (signal: string): void => {
    if (stopping) return;
    stopping = true;
    log('info', 'shutdown_started', { correlationId, signal });
    client.destroy();
    setTimeout(() => process.exit(0), 5_000).unref();
  };

  process.once('SIGTERM', () => shutdown('SIGTERM'));
  process.once('SIGINT', () => shutdown('SIGINT'));

  await client.login(config.activeCredential.token);
}
