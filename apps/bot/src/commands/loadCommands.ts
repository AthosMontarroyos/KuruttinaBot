import { readdir } from 'node:fs/promises';
import { extname, join, relative, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { log } from '#bot/infrastructure/logger.js';
import type { ChatInputCommand, CommandAccess } from './types.js';

/** Every module under this directory (at any depth) deploys only to the dev guild. */
const DEV_DIRECTORY = 'dev';

interface CommandModule {
  readonly command?: unknown;
}

function isPermissionList(value: unknown): value is readonly bigint[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'bigint');
}

const denialMessageKeys: readonly string[] = [
  'guildOnly', 'userUnavailable', 'userMissing', 'botUnavailable', 'botMissing',
];

/** Discord only accepts lowercase names for subcommands and groups. */
const routeSegmentPattern = /^[a-z0-9_-]{1,32}$/u;
/** Prefix aliases stay exact and may also be written in uppercase by their authors. */
const routeAliasPattern = /^[A-Za-z0-9_-]{1,64}$/u;

function isDenialMessages(value: unknown): boolean {
  if (value === undefined) return true;
  if (typeof value !== 'object' || value === null) return false;
  return Object.entries(value).every(([key, text]) => denialMessageKeys.includes(key) && typeof text === 'string');
}

function isCommandAccess(value: unknown): value is CommandAccess {
  if (typeof value !== 'object' || value === null) return false;
  const access = value as {
    readonly kind?: unknown;
    readonly minimumRole?: unknown;
    readonly userPermissions?: unknown;
    readonly botPermissions?: unknown;
    readonly requireChannelSend?: unknown;
    readonly messages?: unknown;
  };
  if (access.kind === 'public') return true;
  if (access.kind !== 'guild' && access.kind !== 'staff') return false;
  if (access.kind === 'staff' && access.minimumRole !== 'creator' && access.minimumRole !== 'dev') return false;
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

function isStringList(value: unknown, pattern: RegExp): value is readonly string[] {
  return Array.isArray(value) && value.length > 0 && value.every((item) => typeof item === 'string' && pattern.test(item));
}

function isCommandRoute(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return false;
  const route = value as { readonly path?: unknown; readonly aliases?: unknown; readonly execute?: unknown };
  return (
    typeof route.execute === 'function' &&
    isStringList(route.path, routeSegmentPattern) &&
    isStringList(route.aliases, routeAliasPattern)
  );
}

function hasUniqueRoutes(routes: readonly unknown[]): boolean {
  const paths = new Set(routes.map((route) => (route as { path: readonly string[] }).path.join('/')));
  const aliases = routes.flatMap((route) => [...(route as { aliases: readonly string[] }).aliases]);
  return paths.size === routes.length && new Set(aliases).size === aliases.length;
}

function isChatInputCommand(value: unknown): value is ChatInputCommand {
  if (typeof value !== 'object' || value === null) return false;

  const candidate = value as Partial<ChatInputCommand> & { readonly routes?: unknown; readonly scope?: unknown };
  if (!isCommandAccess(candidate.access)) return false;
  if (candidate.scope !== 'global' && candidate.scope !== 'dev-guild') return false;
  if (typeof candidate.data !== 'object' || candidate.data === null) return false;

  // Exactly one execution strategy: a root executor or a non-empty route table.
  if (candidate.routes !== undefined) {
    if (!Array.isArray(candidate.routes) || candidate.routes.length === 0) return false;
    if (!candidate.routes.every(isCommandRoute) || !hasUniqueRoutes(candidate.routes)) return false;
    if (candidate.execute !== undefined) return false;
  } else if (typeof candidate.execute !== 'function') {
    return false;
  }

  const data = candidate.data as Partial<ChatInputCommand['data']> & { description?: unknown };
  return (
    typeof data.name === 'string' &&
    data.name.length > 0 &&
    typeof data.description === 'string' &&
    data.description.length > 0 &&
    typeof data.toJSON === 'function'
  );
}

/**
 * The `dev/` folder (at any depth), the `dev-guild` publishing scope and the
 * `staff` policy are the same restriction written three times. The loader
 * rejects any module that does not agree on all three, so the whole folder is
 * always deployed exclusively to the registered development guild.
 */
function hasConsistentScopePlacement(command: ChatInputCommand, devFolder: boolean): boolean {
  const devScope = command.scope === 'dev-guild';
  const staffOnly = command.access.kind === 'staff';
  return devFolder ? devScope && staffOnly : !devScope && !staffOnly;
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
    .map((entry) => ({
      url: pathToFileURL(join(entry.parentPath, entry.name)),
      devFolder: relative(directoryPath, entry.parentPath).split(sep).includes(DEV_DIRECTORY),
    }))
    .sort((left, right) => left.url.href.localeCompare(right.url.href));

  const commands: ChatInputCommand[] = [];
  for (const commandFile of commandFiles) {
    const module = (await import(commandFile.url.href)) as CommandModule;
    const invalid =
      !isChatInputCommand(module.command) ||
      !hasConsistentDefaultPermissions(module.command) ||
      !hasConsistentScopePlacement(module.command, commandFile.devFolder);
    if (invalid) {
      throw Object.assign(new Error(`Invalid command module: ${fileURLToPath(commandFile.url)}`), { name: 'CommandLoadError' });
    }
    commands.push(module.command);
    log('info', 'command_loaded', {
      command: module.command.data.name,
      ...(correlationId ? { correlationId } : {}),
      scope: module.command.scope,
      description: module.command.data.toJSON().description,
    });
  }

  return commands;
}
