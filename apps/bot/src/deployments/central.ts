import type { CommandsHandler } from '#bot/command-system/CommandsHandler.js';
import { deployGlobalCommands } from '#bot/infrastructure/discord/commands/deployCommands.js';
import type { Deployment } from './types.js';

export function createCentralDeployment(commandsHandler: CommandsHandler): Deployment {
  return {
    name: 'central',
    run: async ({ config, applicationId, correlationId, force }) => {
      await deployGlobalCommands(config.activeCredential.token, applicationId, commandsHandler.payload('global'), {
        correlationId,
        ...(force ? { force } : {}),
      });
    },
  };
}
