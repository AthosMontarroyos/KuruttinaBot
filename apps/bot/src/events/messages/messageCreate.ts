import type { Message } from 'discord.js';
import type { CommandsHandler } from '#bot/handlers/CommandsHandler.js';
import { createChannelContext, createEmojiResolver, type CommandClientPort } from '#bot/infrastructure/discord/commandContext.js';
import { log } from '#bot/infrastructure/logger.js';

type MessageCommandPort = Pick<Message, 'content' | 'createdTimestamp' | 'id' | 'reply' | 'system' | 'webhookId'> & {
  readonly author: Pick<Message['author'], 'bot' | 'id'>;
  readonly client: CommandClientPort;
  readonly member?: Message['member'];
  readonly channel?: Message['channel'];
};

export async function handleMessageCreate(message: MessageCommandPort, commandsHandler: CommandsHandler): Promise<void> {
  if (message.author.bot || message.webhookId || message.system) return;
  const match = /^[kK]!([^\s]+)(?:\s|$)/u.exec(message.content);
  const commandName = match?.[1];
  if (!commandName || !commandsHandler.has(commandName)) return;
  const rawArgs = message.content.slice(message.content.indexOf(commandName) + commandName.length).trim();

  try {
    const memberPermissions = message.channel && !message.channel.isDMBased()
      ? message.member?.permissionsIn(message.channel)
      : undefined;
    await commandsHandler.execute(commandName, {
      ...createChannelContext(message.channel, memberPermissions),
      apiPing: Math.max(0, Date.now() - message.createdTimestamp),
      gatewayPing: Math.max(0, Math.round(message.client.ws.ping)),
      acknowledge: async () => undefined,
      emoji: createEmojiResolver(message.client.application),
      reply: async (content) => { await message.reply({ ...typeof content === 'string' ? { content } : content, failIfNotExists: false }); },
      rawArgs,
      commandMessageId: message.id,
    });
  } catch {
    // Do not log message content or upstream errors containing user input.
    log('error', 'prefix_command_failed', { command: commandName, messageId: message.id });
  }
}
