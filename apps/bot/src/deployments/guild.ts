import type { BotSettings } from '@kuruttina/database';
import type { CommandsHandler } from '#bot/handlers/CommandsHandler.js';
import { deployGuildCommands } from '#bot/infrastructure/discord/commands.js';
import type { Deployment } from './types.js';

export function createGuildDeployment(handler: CommandsHandler, getSettings: () => Promise<BotSettings>): Deployment {
  return {
    name: 'staff-guild',
    run: async ({ config, applicationId }) => {
      const settings = await getSettings();
      await deployGuildCommands(config.activeCredential.token, applicationId, settings.devGuildId, handler.payload('dev-guild'));
    },
  };
}
