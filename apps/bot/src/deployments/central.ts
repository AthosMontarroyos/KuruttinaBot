import type { CommandsHandler } from '#bot/handlers/CommandsHandler.js';
import { deployGlobalCommands } from '#bot/infrastructure/discord/commands.js';
import type { Deployment } from './types.js';

export function createCentralDeployment(commandsHandler: CommandsHandler): Deployment {
  return {
    name: 'central',
    run: async ({ config, applicationId }) => {
      await deployGlobalCommands(config.activeCredential.token, applicationId, commandsHandler.payload('global'));
    },
  };
}
