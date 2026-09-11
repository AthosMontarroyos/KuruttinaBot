import { Client, Events, GatewayIntentBits } from 'discord.js';
import { loadConfig } from './config.js';
import { CommandsHandler } from './handlers/CommandsHandler.js';
import { DeploymentsHandler } from './handlers/DeploymentsHandler.js';
import { verifyBotIdentity } from './infrastructure/discord/identity.js';
import { log } from './infrastructure/logger.js';

export async function startBot(): Promise<void> {
  const config = loadConfig();
  const commandsHandler = new CommandsHandler();
  const deploymentsHandler = new DeploymentsHandler();
  const applicationId = await verifyBotIdentity(config.activeCredential.token, config.activeCredential.expectedBotId);

  if (config.autoSyncCommands) {
    await deploymentsHandler.run({ config, applicationId });
  }

  const client = new Client({
    intents: [GatewayIntentBits.Guilds],
    allowedMentions: { parse: [], repliedUser: false },
  });

  client.once(Events.ClientReady, (readyClient) => {
    log('info', 'ready', { botId: readyClient.user.id, target: config.target });
  });

  client.on('interactionCreate', (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    void commandsHandler.execute(interaction).catch((error: unknown) => {
      log('error', 'command_failed', {
        command: interaction.commandName,
        interactionId: interaction.id,
        message: error instanceof Error ? error.message : 'unknown error',
      });
    });
  });

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
