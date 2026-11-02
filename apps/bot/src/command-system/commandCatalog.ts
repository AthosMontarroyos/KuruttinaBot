import type { CatalogCommand } from '@kuruttina/command-catalog';
import { permissionNames } from './access.js';
import type { ChatInputCommand, CommandExample, CommandRoute } from './types.js';

interface DescribedOption {
  readonly name?: string;
  readonly description?: string;
  readonly options?: readonly DescribedOption[];
}

/** Description of the subcommand at `path` in the slash builder JSON; the builder already requires it. */
function routeDescription(command: ChatInputCommand, route: CommandRoute): string {
  let options = (command.data.toJSON() as DescribedOption).options;
  let description: string | undefined;
  for (const segment of route.path) {
    const found = options?.find((option) => option.name === segment);
    description = found?.description;
    options = found?.options;
  }
  return description ?? (command.data.toJSON() as DescribedOption).description ?? '';
}

function guildPermissions(command: ChatInputCommand, route?: CommandRoute): string[] {
  if (command.access.kind === 'public') return [];
  return permissionNames([...command.access.userPermissions, ...(route?.access?.userPermissions ?? [])]);
}

function entry(
  command: ChatInputCommand,
  slash: string,
  prefix: string,
  description: string,
  examples: readonly CommandExample[],
  route?: CommandRoute,
): CatalogCommand {
  return {
    id: prefix.slice(2),
    topic: command.help.topic,
    slash,
    prefix,
    description,
    examples: examples.map(({ slash: slashExample, prefix: prefixExample }) => ({ slash: slashExample, prefix: prefixExample })),
    permissions: guildPermissions(command, route),
  };
}

/**
 * Public command list for `/help`, the site and the generated catalog. Staff
 * commands are internal and stay out. Order is stable: topic order is applied
 * by the readers, and commands keep their discovery order here.
 */
export function buildCatalog(commands: readonly ChatInputCommand[]): CatalogCommand[] {
  return commands
    .filter((command) => command.access.kind !== 'staff')
    .flatMap((command): CatalogCommand[] => {
      const name = command.data.name;
      const description = (command.data.toJSON() as DescribedOption).description ?? '';
      if (command.routes === undefined) {
        return [entry(command, `/${name}`, `k!${name}`, description, command.help.examples ?? [])];
      }
      return command.routes.map((route) =>
        entry(command, `/${name} ${route.path.join(' ')}`, `k!${route.aliases[0] ?? name}`, routeDescription(command, route), route.examples, route));
    });
}

/** Source of `packages/command-catalog/catalog.js`, written by `npm run commands:catalog`. */
export function renderCatalogModule(catalog: readonly CatalogCommand[]): string {
  return [
    '// Gerado por `npm run commands:catalog`. Não edite à mão.',
    "/** @type {readonly import('./index.js').CatalogCommand[]} */",
    `export const COMMAND_CATALOG = ${JSON.stringify(catalog, null, 2)};`,
    '',
  ].join('\n');
}
