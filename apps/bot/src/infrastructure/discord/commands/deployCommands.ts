import { REST, Routes, type RESTPutAPIApplicationCommandsJSONBody } from 'discord.js';

export async function deployGlobalCommands(
  token: string,
  applicationId: string,
  commands: RESTPutAPIApplicationCommandsJSONBody,
): Promise<void> {
  const rest = new REST({ version: '10' }).setToken(token);
  await rest.put(Routes.applicationCommands(applicationId), { body: commands });
}

export async function deployGuildCommands(token: string, applicationId: string, guildId: string, commands: RESTPutAPIApplicationCommandsJSONBody): Promise<void> {
  const rest = new REST({ version: '10' }).setToken(token);
  await rest.put(Routes.applicationGuildCommands(applicationId, guildId), { body: commands });
}
