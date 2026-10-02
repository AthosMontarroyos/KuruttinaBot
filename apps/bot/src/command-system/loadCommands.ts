import { readdir } from 'node:fs/promises';
import { extname, join, relative, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { log } from '#bot/infrastructure/logging/logger.js';
import type { ChatInputCommand, CommandAccess } from './types.js';

/** First path segment under the catalog root. Deeper folders do not create a category. */
const COMMAND_CATEGORIES = ['dev', 'mod', 'public'] as const;
type CommandCategory = (typeof COMMAND_CATEGORIES)[number];

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

function isCommandCategory(value: string): value is CommandCategory {
  return (COMMAND_CATEGORIES as readonly string[]).includes(value);
}

/**
 * Category, access policy and publishing scope are the same restriction.
 * `public/` is open and global, `mod/` is a guild gate and global, and `dev/`
 * is staff-only on the registered development guild.
 */
function hasConsistentCategoryPlacement(command: ChatInputCommand, category: CommandCategory): boolean {
  if (category === 'public') return command.access.kind === 'public' && command.scope === 'global';
  if (category === 'mod') return command.access.kind === 'guild' && command.scope === 'global';
  return command.access.kind === 'staff' && command.scope === 'dev-guild';
}

function commandLoadError(message: string): Error {
  return Object.assign(new Error(message), { name: 'CommandLoadError' });
}

export async function loadCommands(
  commandsDirectory = new URL('../commands/', import.meta.url),
  correlationId?: string,
): Promise<ChatInputCommand[]> {
  const directoryPath = fileURLToPath(commandsDirectory);
  const entries = await readdir(directoryPath, { recursive: true, withFileTypes: true });
  const moduleExtension = extname(import.meta.url);
  const commandFiles = entries
    .filter((entry) => entry.isFile() && extname(entry.name) === moduleExtension && !entry.name.endsWith('.d.ts'))
    .map((entry) => {
      const path = join(entry.parentPath, entry.name);
      const segments = relative(directoryPath, path).split(sep);
      return { path, segments, url: pathToFileURL(path) };
    })
    .sort((left, right) => left.url.href.localeCompare(right.url.href));

  for (const commandFile of commandFiles) {
    const [category, ...rest] = commandFile.segments;
    if (category === undefined || rest.length === 0 || !isCommandCategory(category)) {
      throw commandLoadError(
        `Executable module outside command categories: ${commandFile.path}. Expected dev/, mod/ or public/.`,
      );
    }
  }

  const commands: ChatInputCommand[] = [];
  for (const commandFile of commandFiles) {
    const category = commandFile.segments[0] as CommandCategory;
    const module = (await import(commandFile.url.href)) as CommandModule;
    const invalid =
      !isChatInputCommand(module.command) ||
      !hasConsistentDefaultPermissions(module.command) ||
      !hasConsistentCategoryPlacement(module.command, category);
    if (invalid) {
      throw commandLoadError(`Invalid command module: ${commandFile.path}`);
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
