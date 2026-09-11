import type { RESTPostAPIChatInputApplicationCommandsJSONBody } from 'discord.js';
import { pingCommand } from './ping.js';

export const chatInputCommands = [pingCommand] as const;

export const chatInputCommandPayload = (): RESTPostAPIChatInputApplicationCommandsJSONBody[] =>
  chatInputCommands.map((command) => command.toJSON());
