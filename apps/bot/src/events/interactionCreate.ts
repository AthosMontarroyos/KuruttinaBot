import type { Interaction } from 'discord.js';
import type { CommandsHandler } from '../handlers/CommandsHandler.js';
import { log } from '../infrastructure/logger.js';

export function handleInteractionCreate(interaction: Interaction, commandsHandler: CommandsHandler): void {
  if (!interaction.isChatInputCommand()) return;

  void commandsHandler.execute(interaction).catch((error: unknown) => {
    log('error', 'command_failed', {
      command: interaction.commandName,
      interactionId: interaction.id,
      message: error instanceof Error ? error.message : 'unknown error',
    });
  });
}
