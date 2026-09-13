import type { Client } from 'discord.js';
import type { BotTarget } from '#bot/config.js';
import { log } from '#bot/infrastructure/logger.js';

export function handleClientReady(client: Client<true>, target: BotTarget, correlationId: string): void {
  log('success', 'ready', { botId: client.user.id, botName: client.user.tag, correlationId, target });
}
