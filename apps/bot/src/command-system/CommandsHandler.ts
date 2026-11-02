import type { EmojiImportService } from '#bot/application/emojis/importEmoji.js';
import type { CatalogCommand } from '@kuruttina/command-catalog';
import { validateAdditionalAccess, validateCommandAccess } from './access.js';
import { buildCatalog } from './commandCatalog.js';
import { withEmojis } from './responses.js';
import type {
  ChatInputCommand,
  CommandAccess,
  CommandContext,
  CommandPayload,
  CommandRoute,
  CommandScope,
  EmojiInfoPort,
  StaffAccessPort,
} from './types.js';

type Resolution =
  | { readonly status: 'ready'; readonly command: ChatInputCommand; readonly route?: CommandRoute | undefined }
  | { readonly status: 'missing-route'; readonly command: ChatInputCommand }
  | { readonly status: 'unknown' };

function samePath(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((segment, index) => segment === right[index]);
}

function formatAliasList(aliases: readonly string[]): string {
  const formatted = aliases.map((alias) => `\`k!${alias}\``);
  if (formatted.length < 2) return formatted[0] ?? '';
  const last = formatted[formatted.length - 1];
  return `${formatted.slice(0, -1).join(', ')} ou ${last}`;
}

async function missingRouteMessage(context: CommandContext, command: ChatInputCommand): Promise<string> {
  const aliases = (command.routes ?? []).flatMap((route) => route.aliases);
  const text = aliases.length === 0
    ? 'Este comando exige um subcomando.'
    : `Este comando exige um subcomando. Use ${formatAliasList(aliases)}.`;
  return withEmojis(await context.emoji('book'), text);
}

/** The route may specialize the out-of-channel sentence. It does not change the root permission bits. */
function accessForDenial(access: CommandAccess, route?: CommandRoute): CommandAccess {
  const guildOnly = route?.access?.messages?.guildOnly;
  if (guildOnly === undefined || access.kind === 'public') return access;
  return { ...access, messages: { ...access.messages, guildOnly } };
}

export class CommandsHandler {
  private readonly commandsByName = new Map<string, ChatInputCommand>();
  private readonly routesByAlias = new Map<string, { command: ChatInputCommand; route: CommandRoute }>();
  private readonly pending = new Set<Promise<void>>();
  private cachedCatalog: readonly CatalogCommand[] | undefined;
  private accepting = true;

  constructor(
    registeredCommands: readonly ChatInputCommand[],
    private readonly staff?: StaffAccessPort,
    private readonly emojiImport?: EmojiImportService,
    private readonly emojiInfo?: EmojiInfoPort,
  ) {
    for (const command of registeredCommands) {
      // The payload split depends on it, so hand-registered commands must agree too.
      if ((command.access.kind === 'staff') !== (command.scope === 'dev-guild')) {
        throw new Error(`Command scope mismatch: ${command.data.name} (staff policy requires the dev-guild scope)`);
      }
      if (this.commandsByName.has(command.data.name)) throw new Error(`Duplicate chat input command: ${command.data.name}`);
      this.commandsByName.set(command.data.name, command);
    }
    for (const command of registeredCommands) {
      for (const route of command.routes ?? []) {
        for (const alias of route.aliases) {
          if (this.commandsByName.has(alias) || this.routesByAlias.has(alias)) {
            throw new Error(`Duplicate command alias: ${alias}`);
          }
          this.routesByAlias.set(alias, { command, route });
        }
      }
    }
  }

  /** Publishing set of one scope; `dev-guild` never reaches the global deployment. */
  payload(scope: CommandScope = 'global'): CommandPayload[] {
    return [...this.commandsByName.values()]
      .filter((command) => command.scope === scope)
      .map((command) => command.data.toJSON());
  }

  /** Public command list for `/help`, built once from the registered modules. */
  catalog(): readonly CatalogCommand[] {
    this.cachedCatalog ??= buildCatalog([...this.commandsByName.values()]);
    return this.cachedCatalog;
  }

  /** A root command or any prefix alias can start an execution. */
  has(commandName: string): boolean {
    return this.commandsByName.has(commandName) || this.routesByAlias.has(commandName);
  }

  async execute(commandName: string, context: CommandContext, routePath: readonly string[] = []): Promise<void> {
    if (!this.accepting) return;
    const resolution = this.resolve(commandName, routePath);
    const command = resolution.status === 'unknown' ? undefined : resolution.command;
    if (this.pending.size >= 64 || (command?.access.kind === 'staff' && this.pending.size >= 12)) {
      await context.acknowledge();
      await context.reply(withEmojis(await context.emoji('coffee'), 'Já estou ocupada. Tente de novo em instantes.'));
      return;
    }
    const execution = this.run(commandName, routePath, context);
    this.pending.add(execution);
    try { await execution; } finally { this.pending.delete(execution); }
  }

  async stop(): Promise<void> {
    this.accepting = false;
    await Promise.allSettled([...this.pending]);
  }

  private resolve(commandName: string, routePath: readonly string[]): Resolution {
    const command = this.commandsByName.get(commandName);
    if (command?.routes) {
      if (routePath.length === 0) return { status: 'missing-route', command };
      const route = command.routes.find((candidate) => samePath(candidate.path, routePath));
      return route === undefined ? { status: 'missing-route', command } : { status: 'ready', command, route };
    }
    if (routePath.length > 0) return command === undefined ? { status: 'unknown' } : { status: 'missing-route', command };
    if (command !== undefined) return { status: 'ready', command };
    const aliased = this.routesByAlias.get(commandName);
    return aliased === undefined ? { status: 'unknown' } : { status: 'ready', command: aliased.command, route: aliased.route };
  }

  private async run(commandName: string, routePath: readonly string[], context: CommandContext): Promise<void> {
    const resolution = this.resolve(commandName, routePath);
    if (resolution.status === 'unknown') throw new Error(`Unknown command: ${commandName}`);
    if (resolution.status === 'missing-route') {
      await context.acknowledge();
      await context.reply(await missingRouteMessage(context, resolution.command));
      return;
    }

    // Both transports receive the same capabilities, composed by the entrypoint.
    const fullContext: CommandContext = {
      ...context,
      ...(this.emojiImport ? { emojiImport: this.emojiImport } : {}),
      ...(this.emojiInfo ? { emojiInfo: this.emojiInfo } : {}),
      commandCatalog: this.catalog(),
    };
    const accessError = await validateCommandAccess(
      accessForDenial(resolution.command.access, resolution.route),
      fullContext,
      this.staff,
    );
    if (accessError) {
      await context.acknowledge();
      await context.reply(accessError);
      return;
    }
    if (resolution.route?.access) {
      const routeError = await validateAdditionalAccess(resolution.route.access, fullContext);
      if (routeError) {
        await context.acknowledge();
        await context.reply(routeError);
        return;
      }
    }

    const executor = resolution.route?.execute ?? resolution.command.execute;
    if (executor === undefined) throw new Error(`Command has no executor: ${resolution.command.data.name}`);
    await executor(fullContext);
  }
}
