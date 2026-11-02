import type { RESTPutAPIApplicationCommandsJSONBody } from 'discord.js';
import { log } from '#bot/infrastructure/logging/logger.js';

type CommandJson = Readonly<Record<string, unknown>>;
/** Builders and REST bodies are plain JSON objects without an index signature. */
type CommandObject = object;

/** Registered commands of one scope (global or one guild) and the bulk replace of that scope. */
export interface CommandRegistry {
  fetch(): Promise<readonly CommandObject[]>;
  replace(commands: RESTPutAPIApplicationCommandsJSONBody): Promise<void>;
}

export interface CommandDiff {
  readonly added: readonly string[];
  readonly removed: readonly string[];
  readonly changed: readonly string[];
  readonly unchanged: readonly string[];
  readonly hasChanges: boolean;
}

export interface SyncOptions {
  /** Publish even when nothing differs (manual `npm run deploy:commands`). */
  readonly force?: boolean;
  /** Label in the log: `global` or `staff-guild`. */
  readonly scope?: string;
  readonly correlationId?: string;
}

/** Fields Discord fills in or defaults; they are compared only when the local definition sets them. */
const SERVER_FIELDS = [
  'id', 'application_id', 'guild_id', 'version', 'dm_permission', 'contexts',
  'integration_types', 'handler', 'name_localized', 'description_localized',
] as const;

/**
 * Canonical form for comparison: no null, false or empty values (Discord drops
 * them from responses and the builders emit some of them), keys sorted so the
 * order never matters. Arrays keep their order, which is meaningful for options.
 */
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) {
    const items = value.map(canonical).filter((item) => item !== undefined);
    return items.length === 0 ? undefined : items;
  }
  if (typeof value === 'object' && value !== null) {
    const entries = Object.entries(value)
      .map(([key, item]): [string, unknown] => [key, canonical(item)])
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0));
    return entries.length === 0 ? undefined : Object.fromEntries(entries);
  }
  return value === null || value === false ? undefined : value;
}

function comparable(command: CommandJson, peer: CommandJson): string {
  const copy: Record<string, unknown> = { ...command };
  for (const field of SERVER_FIELDS) {
    if (peer[field] === undefined || peer[field] === null) delete copy[field];
  }
  // A chat input command is type 1, with or without the field.
  if (copy.type === 1) delete copy.type;
  return JSON.stringify(canonical(copy) ?? null);
}

function nameOf(command: CommandJson): string {
  return typeof command.name === 'string' ? command.name : '';
}

/** What differs between the local definitions and what Discord has registered, by command name. */
export function diffCommands(desiredCommands: readonly CommandObject[], currentCommands: readonly CommandObject[]): CommandDiff {
  const desired = desiredCommands as readonly CommandJson[];
  const current = currentCommands as readonly CommandJson[];
  const registered = new Map(current.map((command) => [nameOf(command), command]));
  const wanted = new Set(desired.map(nameOf));
  const added: string[] = [];
  const changed: string[] = [];
  const unchanged: string[] = [];
  for (const command of desired) {
    const name = nameOf(command);
    const existing = registered.get(name);
    if (existing === undefined) added.push(name);
    else if (comparable(command, existing) === comparable(existing, command)) unchanged.push(name);
    else changed.push(name);
  }
  const removed = current.map(nameOf).filter((name) => !wanted.has(name));
  return { added, removed, changed, unchanged, hasChanges: added.length + removed.length + changed.length > 0 };
}

/**
 * Brings one scope in line with the local definitions. Without differences
 * nothing is written. Otherwise a single bulk replace publishes added and edited
 * commands and clears removed ones from Discord's registry in the same call.
 */
export async function syncCommands(
  registry: CommandRegistry,
  desired: RESTPutAPIApplicationCommandsJSONBody,
  options: SyncOptions = {},
): Promise<CommandDiff> {
  const diff = diffCommands(desired, await registry.fetch());
  const fields = {
    ...(options.correlationId ? { correlationId: options.correlationId } : {}),
    scope: options.scope ?? 'global',
    added: diff.added.join(', ') || '-',
    removed: diff.removed.join(', ') || '-',
    changed: diff.changed.join(', ') || '-',
    unchanged: diff.unchanged.length,
  };
  if (!diff.hasChanges && options.force !== true) {
    log('info', 'commands_sync_unchanged', fields);
    return diff;
  }
  await registry.replace(desired);
  log('success', 'commands_sync_applied', { ...fields, forced: options.force === true && !diff.hasChanges });
  return diff;
}
