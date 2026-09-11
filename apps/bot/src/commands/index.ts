import type { RESTPostAPIApplicationCommandsJSONBody } from 'discord.js';
import { chatInputCommandPayload } from './chat-input/index.js';
import { messageContextCommands } from './message-context/index.js';
import { userContextCommands } from './user-context/index.js';

export const commandPayload = (): RESTPostAPIApplicationCommandsJSONBody[] => [
  ...chatInputCommandPayload(),
  ...userContextCommands,
  ...messageContextCommands,
];
