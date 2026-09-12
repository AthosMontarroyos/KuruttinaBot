import { loadConfig } from '#bot/config.js';
import { verifyBotIdentity } from '#bot/infrastructure/discord/identity.js';
import { log } from '#bot/infrastructure/logger.js';
import { centralDeployment } from './central.js';

async function deployCentral(): Promise<void> {
  const config = loadConfig();
  const applicationId = await verifyBotIdentity(config.activeCredential.token, config.activeCredential.expectedBotId);
  await centralDeployment.run({ config, applicationId });
  log('info', 'central_commands_deployed', { applicationId });
}

deployCentral().catch((error: unknown) => {
  log('error', 'central_command_deployment_failed', {
    message: error instanceof Error ? error.message : 'unknown error',
  });
  process.exitCode = 1;
});
