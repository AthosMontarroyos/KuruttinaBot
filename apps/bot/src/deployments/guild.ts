import type { BotSettings } from '@kuruttina/database';
import type { CommandsHandler } from '#bot/command-system/CommandsHandler.js';
import { deployGuildCommands } from '#bot/infrastructure/discord/commands/deployCommands.js';
import { log } from '#bot/infrastructure/logging/logger.js';
import type { Deployment } from './types.js';

/** RESTJSONErrorCodes.MissingAccess — the bot is not a member of the guild. */
const MISSING_ACCESS = 50001;
/** RESTJSONErrorCodes.UnknownGuild — the guild id does not exist. */
const UNKNOWN_GUILD = 10004;
const SKIPPED_GUILD_SYNC_CODES = new Set<number>([MISSING_ACCESS, UNKNOWN_GUILD]);

function skippedGuildSyncCode(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null || !('code' in error) || typeof error.code !== 'number') return undefined;
  return SKIPPED_GUILD_SYNC_CODES.has(error.code) ? error.code : undefined;
}

export function createGuildDeployment(handler: CommandsHandler, getSettings: () => Promise<BotSettings>): Deployment {
  return {
    name: 'staff-guild',
    run: async ({ config, applicationId, correlationId, force }) => {
      const settings = await getSettings();
      const commands = handler.payload('dev-guild');
      for (const guildId of settings.devGuildIds) {
        try {
          await deployGuildCommands(config.activeCredential.token, applicationId, guildId, commands, {
            correlationId,
            ...(force ? { force } : {}),
          });
        } catch (error) {
          const errorCode = skippedGuildSyncCode(error);
          if (errorCode === undefined) throw error;
          log('warn', 'staff_guild_sync_skipped', { correlationId, guildId, errorCode });
        }
      }
    },
  };
}
