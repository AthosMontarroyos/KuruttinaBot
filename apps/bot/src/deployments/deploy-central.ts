import { randomUUID } from 'node:crypto';
import { loadCommands } from '#bot/commands/loadCommands.js';
import { loadConfig } from '#bot/config.js';
import { CommandsHandler } from '#bot/handlers/CommandsHandler.js';
import { verifyBotIdentity } from '#bot/infrastructure/discord/identity.js';
import { log } from '#bot/infrastructure/logger.js';
import { createCentralDeployment } from './central.js';

const correlationId = randomUUID();

async function deployCentral(): Promise<void> {
  const config = loadConfig();
  const commandsHandler = new CommandsHandler(await loadCommands(undefined, correlationId));
  const applicationId = await verifyBotIdentity(config.activeCredential.token, config.activeCredential.expectedBotId);
  await createCentralDeployment(commandsHandler).run({ config, applicationId, correlationId });
  log('success', 'central_commands_deployed', { applicationId, correlationId });
}

deployCentral().catch((error: unknown) => {
  log('error', 'central_command_deployment_failed', {
    correlationId,
    errorName: error instanceof Error ? error.name : 'UnknownError',
  });
  process.exitCode = 1;
});
