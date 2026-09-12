import type { Client } from 'discord.js';
import type { BotTarget } from '../config.js';
import { log } from '../infrastructure/logger.js';

export function handleClientReady(client: Client<true>, target: BotTarget): void {
  log('info', 'ready', { botId: client.user.id, target });
}
