import type {
  ChatInputCommandInteraction,
  RESTPostAPIApplicationCommandsJSONBody,
  SlashCommandBuilder,
} from 'discord.js';
import { readdir } from 'node:fs/promises';
import { extname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { log } from '#bot/infrastructure/logger.js';

export interface ChatInputCommand {
  readonly data: Pick<SlashCommandBuilder, 'name' | 'toJSON'>;
  readonly prefixCommand: boolean;
  execute(interaction: ChatInputCommandInteraction): Promise<void>;
}

interface CommandModule {
  readonly command?: unknown;
}

function isChatInputCommand(value: unknown): value is ChatInputCommand {
  if (typeof value !== 'object' || value === null) return false;

  const candidate = value as Partial<ChatInputCommand>;
  if (typeof candidate.prefixCommand !== 'boolean' || typeof candidate.execute !== 'function') return false;
  if (typeof candidate.data !== 'object' || candidate.data === null) return false;

  const data = candidate.data as Partial<ChatInputCommand['data']> & { description?: unknown };
  return (
    typeof data.name === 'string' &&
    data.name.length > 0 &&
    typeof data.description === 'string' &&
    data.description.length > 0 &&
    typeof data.toJSON === 'function'
  );
}

export async function loadCommands(commandsDirectory = new URL('../commands/', import.meta.url)): Promise<ChatInputCommand[]> {
  const directoryPath = fileURLToPath(commandsDirectory);
  const entries = await readdir(directoryPath, { recursive: true, withFileTypes: true });
  const moduleExtension = extname(import.meta.url);
  const commandFiles = entries
    .filter((entry) => entry.isFile() && extname(entry.name) === moduleExtension && !entry.name.endsWith('.d.ts'))
    .map((entry) => pathToFileURL(`${entry.parentPath}/${entry.name}`))
    .sort((left, right) => left.href.localeCompare(right.href));

  const commands: ChatInputCommand[] = [];
  for (const commandFile of commandFiles) {
    const module = (await import(commandFile.href)) as CommandModule;
    if (!isChatInputCommand(module.command)) {
      throw new Error(`Invalid command module: ${fileURLToPath(commandFile)}`);
    }

    commands.push(module.command);
    log('info', 'command_loaded', {
      command: module.command.data.name,
      description: module.command.data.toJSON().description,
      prefixCommand: module.command.prefixCommand,
    });
  }

  return commands;
}

export class CommandsHandler {
  private readonly commandsByName = new Map<string, ChatInputCommand>();

  constructor(registeredCommands: readonly ChatInputCommand[]) {
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

export const commandsHandler = new CommandsHandler(await loadCommands());
