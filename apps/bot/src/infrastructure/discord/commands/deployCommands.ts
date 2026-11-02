import { REST, Routes, type RESTPutAPIApplicationCommandsJSONBody } from 'discord.js';
import { syncCommands, type CommandRegistry, type SyncOptions } from './syncCommands.js';

function registryFor(rest: REST, route: `/${string}`): CommandRegistry {
  return {
    fetch: async () => (await rest.get(route)) as readonly Record<string, unknown>[],
    replace: async (commands) => { await rest.put(route, { body: commands }); },
  };
}

/** Syncs the global set: publishes only when a command was added, edited or removed. */
export async function deployGlobalCommands(
  token: string,
  applicationId: string,
  commands: RESTPutAPIApplicationCommandsJSONBody,
  options?: SyncOptions,
): Promise<void> {
  const rest = new REST({ version: '10' }).setToken(token);
  await syncCommands(registryFor(rest, Routes.applicationCommands(applicationId)), commands, { scope: 'global', ...options });
}

/** Syncs the staff guild set, with the same differences-only rule. */
export async function deployGuildCommands(
  token: string,
  applicationId: string,
  guildId: string,
  commands: RESTPutAPIApplicationCommandsJSONBody,
  options?: SyncOptions,
): Promise<void> {
  const rest = new REST({ version: '10' }).setToken(token);
  await syncCommands(registryFor(rest, Routes.applicationGuildCommands(applicationId, guildId)), commands, { scope: 'staff-guild', ...options });
}
