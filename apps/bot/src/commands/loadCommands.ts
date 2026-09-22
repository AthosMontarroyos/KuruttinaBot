import { readdir } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { log } from '#bot/infrastructure/logger.js';
import type { ChatInputCommand, CommandAccess } from './types.js';

interface CommandModule {
  readonly command?: unknown;
}

function isPermissionList(value: unknown): value is readonly bigint[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'bigint');
}

const denialMessageKeys: readonly string[] = [
  'guildOnly', 'userUnavailable', 'userMissing', 'botUnavailable', 'botMissing',
];

function isDenialMessages(value: unknown): boolean {
  if (value === undefined) return true;
  if (typeof value !== 'object' || value === null) return false;
  return Object.entries(value).every(([key, text]) => denialMessageKeys.includes(key) && typeof text === 'string');
}

function isCommandAccess(value: unknown): value is CommandAccess {
  if (typeof value !== 'object' || value === null) return false;
  const access = value as {
    readonly kind?: unknown;
    readonly userPermissions?: unknown;
    readonly botPermissions?: unknown;
    readonly requireChannelSend?: unknown;
    readonly messages?: unknown;
  };
  if (access.kind === 'public') return true;
  if (access.kind !== 'guild') return false;
  return (
    isPermissionList(access.userPermissions) &&
    isPermissionList(access.botPermissions) &&
    (access.requireChannelSend === undefined || typeof access.requireChannelSend === 'boolean') &&
    isDenialMessages(access.messages)
  );
}

/**
 * Discord's default member gate must mirror the declared runtime user policy:
 * a public command declares no default gate, and a guild command's default
 * gate (when present) equals exactly its `userPermissions`.
 */
export function hasConsistentDefaultPermissions(command: ChatInputCommand): boolean {
  const configured = command.data.toJSON().default_member_permissions;
  if (command.access.kind === 'public') return configured == null;
  if (configured == null) return true;
  if (!/^\d+$/u.test(configured)) return false;
  const required = command.access.userPermissions.reduce((bits, permission) => bits | permission, 0n);
  return BigInt(configured) === required;
}

function isChatInputCommand(value: unknown): value is ChatInputCommand {
  if (typeof value !== 'object' || value === null) return false;

  const candidate = value as Partial<ChatInputCommand>;
  if (typeof candidate.execute !== 'function') return false;
  if (!isCommandAccess(candidate.access)) return false;
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
        entry.name !== `access${moduleExtension}` &&
        extname(entry.name) === moduleExtension &&
        !entry.name.endsWith('.d.ts'),
    )
    .map((entry) => pathToFileURL(join(entry.parentPath, entry.name)))
    .sort((left, right) => left.href.localeCompare(right.href));

  const commands: ChatInputCommand[] = [];
  for (const commandFile of commandFiles) {
    const module = (await import(commandFile.href)) as CommandModule;
    if (!isChatInputCommand(module.command) || !hasConsistentDefaultPermissions(module.command)) {
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
