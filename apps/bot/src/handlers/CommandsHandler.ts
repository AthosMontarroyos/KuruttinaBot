import type { ChatInputCommandInteraction } from 'discord.js';
import { executePing } from '../commands/chat-input/ping.js';

export class CommandsHandler {
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (interaction.commandName === 'ping') {
      await executePing(interaction);
      return;
    }

    throw new Error(`Unknown command: ${interaction.commandName}`);
  }
}
