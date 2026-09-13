import { readdir } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { log } from '#bot/infrastructure/logger.js';
import type { ChatInputCommand } from './types.js';

interface CommandModule {
  readonly command?: unknown;
}

function isChatInputCommand(value: unknown): value is ChatInputCommand {
  if (typeof value !== 'object' || value === null) return false;

  const candidate = value as Partial<ChatInputCommand>;
  if (typeof candidate.execute !== 'function') return false;
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

export async function loadCommands(
  commandsDirectory = new URL('./', import.meta.url),
  correlationId?: string,
): Promise<ChatInputCommand[]> {
  const directoryPath = fileURLToPath(commandsDirectory);
  const entries = await readdir(directoryPath, { recursive: true, withFileTypes: true });
  const moduleExtension = extname(import.meta.url);
  const commandFiles = entries
    .filter(
      (entry) =>
        entry.isFile() &&
        entry.name !== `loadCommands${moduleExtension}` &&
        entry.name !== `types${moduleExtension}` &&
        extname(entry.name) === moduleExtension &&
        !entry.name.endsWith('.d.ts'),
    )
    .map((entry) => pathToFileURL(join(entry.parentPath, entry.name)))
    .sort((left, right) => left.href.localeCompare(right.href));

  const commands: ChatInputCommand[] = [];
  for (const commandFile of commandFiles) {
    const module = (await import(commandFile.href)) as CommandModule;
    if (!isChatInputCommand(module.command)) {
      throw Object.assign(new Error(`Invalid command module: ${fileURLToPath(commandFile)}`), { name: 'CommandLoadError' });
    }
    commands.push(module.command);
    log('info', 'command_loaded', {
      command: module.command.data.name,
      ...(correlationId ? { correlationId } : {}),
      description: module.command.data.toJSON().description,
    });
  }

  return commands;
}
