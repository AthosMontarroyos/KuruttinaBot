import type { Message } from 'discord.js';
import type { CommandsHandler } from '#bot/handlers/CommandsHandler.js';
import { log } from '#bot/infrastructure/logger.js';

export function handleMessageCreate(message: Message, commandsHandler: CommandsHandler): void {
  void commandsHandler.executeMessage(message).catch(() => {
    // Do not log message content or upstream errors containing user input.
    log('error', 'prefix_command_failed', { messageId: message.id });
  });
}
