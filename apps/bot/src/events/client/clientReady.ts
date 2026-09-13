import type { Client } from 'discord.js';
import type { BotTarget } from '#bot/config.js';
import { log } from '#bot/infrastructure/logger.js';

export function handleClientReady(client: Client<true>, target: BotTarget, correlationId: string): void {
  log('info', 'ready', { botId: client.user.id, correlationId, target });
}
