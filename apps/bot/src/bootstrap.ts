import { Client, Events, GatewayIntentBits } from 'discord.js';
import { loadConfig } from '#bot/config.js';
import { handleClientReady } from '#bot/events/clientReady.js';
import { handleInteractionCreate } from '#bot/events/interactionCreate.js';
import { commandsHandler } from '#bot/handlers/CommandsHandler.js';
import { DeploymentsHandler } from '#bot/handlers/DeploymentsHandler.js';
import { verifyBotIdentity } from '#bot/infrastructure/discord/identity.js';
import { log } from '#bot/infrastructure/logger.js';

export async function startBot(): Promise<void> {
  const config = loadConfig();
  const deploymentsHandler = new DeploymentsHandler();
  const applicationId = await verifyBotIdentity(config.activeCredential.token, config.activeCredential.expectedBotId);

  if (config.autoSyncCommands) {
    await deploymentsHandler.run({ config, applicationId });
  }

  const client = new Client({
    intents: [GatewayIntentBits.Guilds],
    allowedMentions: { parse: [], repliedUser: false },
  });

  client.once(Events.ClientReady, (readyClient) => handleClientReady(readyClient, config.target));
  client.on(Events.InteractionCreate, (interaction) => handleInteractionCreate(interaction, commandsHandler));

  let stopping = false;
  const shutdown = (signal: string): void => {
    if (stopping) return;
    stopping = true;
    log('info', 'shutdown_started', { signal });
    client.destroy();
    setTimeout(() => process.exit(0), 5_000).unref();
  };

  process.once('SIGTERM', () => shutdown('SIGTERM'));
  process.once('SIGINT', () => shutdown('SIGINT'));

  await client.login(config.activeCredential.token);
}
