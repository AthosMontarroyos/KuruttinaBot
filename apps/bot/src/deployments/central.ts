import { commandPayload } from '../commands/index.js';
import { deployGlobalCommands } from '../infrastructure/discord/commands.js';
import type { Deployment } from './types.js';

export const centralDeployment: Deployment = {
  name: 'central',
  run: async ({ config, applicationId }) => {
    await deployGlobalCommands(config.activeCredential.token, applicationId, commandPayload());
  },
};
