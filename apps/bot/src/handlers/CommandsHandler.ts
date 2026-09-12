import type {
  ChatInputCommandInteraction,
  RESTPostAPIApplicationCommandsJSONBody,
  SlashCommandBuilder,
} from 'discord.js';
import { pingCommand } from '../commands/public/ping.js';

interface ChatInputCommand {
  readonly data: Pick<SlashCommandBuilder, 'name' | 'toJSON'>;
  execute(interaction: ChatInputCommandInteraction): Promise<void>;
}

const commands = [pingCommand] satisfies readonly ChatInputCommand[];

export class CommandsHandler {
  private readonly commandsByName = new Map<string, ChatInputCommand>();

  constructor(registeredCommands: readonly ChatInputCommand[] = commands) {
    for (const command of registeredCommands) {
      if (this.commandsByName.has(command.data.name)) {
        throw new Error(`Duplicate chat input command: ${command.data.name}`);
      }

      this.commandsByName.set(command.data.name, command);
    }
  }

  payload(): RESTPostAPIApplicationCommandsJSONBody[] {
    return [...this.commandsByName.values()].map((command) => command.data.toJSON());
  }

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const command = this.commandsByName.get(interaction.commandName);

    if (!command) throw new Error(`Unknown command: ${interaction.commandName}`);

    await command.execute(interaction);
  }
}

export const commandsHandler = new CommandsHandler();
