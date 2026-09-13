import type { Message } from 'discord.js';
import type { CommandsHandler } from '#bot/handlers/CommandsHandler.js';
import { log } from '#bot/infrastructure/logger.js';

type MessageCommandPort = Pick<Message, 'content' | 'createdTimestamp' | 'id' | 'reply' | 'system' | 'webhookId'> & {
  readonly author: Pick<Message['author'], 'bot'>;
  readonly client: {
    readonly application: { readonly emojis: { fetch(): Promise<{ find(predicate: (emoji: { name: string | null }) => boolean): { toString(): string } | undefined }> } };
    readonly ws: { readonly ping: number };
  };
};

export async function handleMessageCreate(message: MessageCommandPort, commandsHandler: CommandsHandler): Promise<void> {
  if (message.author.bot || message.webhookId || message.system) return;
  const match = /^[kK]!([^\s]+)(?:\s|$)/u.exec(message.content);
  const commandName = match?.[1];
  if (!commandName || !commandsHandler.has(commandName)) return;
  let applicationEmojis: ReturnType<MessageCommandPort['client']['application']['emojis']['fetch']> | undefined;

  try {
    await commandsHandler.execute(commandName, {
      apiPing: Math.max(0, Date.now() - message.createdTimestamp),
      gatewayPing: Math.max(0, Math.round(message.client.ws.ping)),
      acknowledge: async () => undefined,
      emoji: async (name: string) => {
        const emojis = await (applicationEmojis ??= message.client.application.emojis.fetch());
        const emoji = emojis.find((candidate) => candidate.name === name);
        if (!emoji) throw new Error(`Application emoji unavailable: ${name}`);
        return emoji.toString();
      },
      reply: async (content) => { await message.reply(content); },
    });
  } catch {
    // Do not log message content or upstream errors containing user input.
    log('error', 'prefix_command_failed', { command: commandName, messageId: message.id });
  }
}
