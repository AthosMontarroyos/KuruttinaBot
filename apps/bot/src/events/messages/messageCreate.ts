import type { Message } from 'discord.js';
import type { CommandsHandler } from '#bot/handlers/CommandsHandler.js';
import { log } from '#bot/infrastructure/logger.js';

type MessageCommandPort = Pick<Message, 'content' | 'id' | 'reply' | 'system' | 'webhookId'> & {
  readonly author: Pick<Message['author'], 'bot'>;
};

export async function handleMessageCreate(message: MessageCommandPort, commandsHandler: CommandsHandler): Promise<void> {
  if (message.author.bot || message.webhookId || message.system) return;
  const match = /^[kK]!([^\s]+)(?:\s|$)/u.exec(message.content);
  const commandName = match?.[1];
  if (!commandName || !commandsHandler.has(commandName)) return;

  try {
    await commandsHandler.execute(commandName, {
      acknowledge: async () => undefined,
      reply: async (content) => { await message.reply(content); },
    });
  } catch {
    // Do not log message content or upstream errors containing user input.
    log('error', 'prefix_command_failed', { command: commandName, messageId: message.id });
  }
}
