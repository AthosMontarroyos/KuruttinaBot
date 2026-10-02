import { randomUUID } from 'node:crypto';
import { createDatabase } from '@kuruttina/database';
import { loadCommands } from '#bot/command-system/loadCommands.js';
import { loadConfig } from '#bot/config.js';
import { CommandsHandler } from '#bot/command-system/CommandsHandler.js';
import { DeploymentsHandler } from '#bot/handlers/DeploymentsHandler.js';
import { verifyBotIdentity } from '#bot/infrastructure/discord/identity.js';
import { log } from '#bot/infrastructure/logging/logger.js';
import { createCentralDeployment } from './central.js';
import { createGuildDeployment } from './guild.js';

const correlationId = randomUUID();
async function deployCentral(): Promise<void> {
  const config = loadConfig();
  const database = createDatabase(config.database, config.target, (diagnostic) => log('error', 'database_connection_failed', { correlationId, ...diagnostic }));
  try {
    await database.getSettings();
    const handler = new CommandsHandler(await loadCommands(undefined, correlationId), database);
    const applicationId = await verifyBotIdentity(config.activeCredential.token, config.activeCredential.expectedBotId);
    await new DeploymentsHandler([createCentralDeployment(handler), createGuildDeployment(handler, database.getSettings)])
      .run({ config, applicationId, correlationId });
    log('success', 'central_commands_deployed', { applicationId, correlationId });
  } finally { await database.close(); }
}
deployCentral().catch((error: unknown) => {
  log('error', 'central_command_deployment_failed', { correlationId, errorName: error instanceof Error ? error.name : 'UnknownError' });
  process.exitCode = 1;
});
