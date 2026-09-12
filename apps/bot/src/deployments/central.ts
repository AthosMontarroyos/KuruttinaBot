import { commandsHandler } from '#bot/handlers/CommandsHandler.js';
import { deployGlobalCommands } from '#bot/infrastructure/discord/commands.js';
import type { Deployment } from './types.js';

export const centralDeployment: Deployment = {
  name: 'central',
  run: async ({ config, applicationId }) => {
    await deployGlobalCommands(config.activeCredential.token, applicationId, commandsHandler.payload());
  },
};
