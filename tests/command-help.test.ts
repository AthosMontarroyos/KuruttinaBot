import { describe, expect, it } from 'vitest';
import { buildCatalog, renderCatalogModule } from '../apps/bot/src/command-system/commandCatalog.js';
import { loadCommands } from '../apps/bot/src/command-system/loadCommands.js';

function helpFixture(name: string): URL {
  return new URL(`./fixtures/help/${name}/`, import.meta.url);
}

const invalidHelpFixtures = [
  'missing-help',
  'invalid-topic',
  'mod-topic-mismatch',
  'public-topic-mod',
  'dev-topic-mismatch',
  'missing-examples',
  'empty-examples',
  'too-many-examples',
  'slash-example-wrong-name',
  'prefix-example-wrong-name',
  'prefix-example-no-prefix',
  'extra-key-example',
  'routes-with-root-examples',
  'route-missing-examples',
  'route-slash-example-wrong-path',
  'route-prefix-example-wrong-alias',
] as const;

describe('command help metadata', () => {
  it.each(['valid', 'valid-routes'])('loads the valid %s fixture', async (fixture) => {
    await expect(loadCommands(helpFixture(fixture))).resolves.toHaveLength(1);
  });

  it.each(invalidHelpFixtures)('rejects the %s fixture during discovery', async (fixture) => {
    await expect(loadCommands(helpFixture(fixture))).rejects.toMatchObject({
      name: 'CommandLoadError',
      message: expect.stringContaining('Invalid command module'),
    });
    await expect(loadCommands(helpFixture(fixture))).rejects.toMatchObject({
      message: expect.stringContaining(fixture),
    });
  });
});

describe('generated command catalog', () => {
  it('lists only non-staff commands, one entry per route, never the dev topic', async () => {
    const commands = await loadCommands();
    const catalog = buildCatalog(commands);
    const expected = commands
      .filter((command) => command.access.kind !== 'staff')
      .reduce((total, command) => total + (command.routes?.length ?? 1), 0);
    expect(catalog).toHaveLength(expected);
    expect(catalog.map((entry) => entry.topic)).not.toContain('dev');
  });

  it('gives every entry a slash address, a prefix address, a description and examples', async () => {
    const catalog = buildCatalog(await loadCommands());
    expect(catalog.length).toBeGreaterThan(0);
    for (const entry of catalog) {
      expect(entry.slash).toMatch(/^\//u);
      expect(entry.prefix).toMatch(/^k!/u);
      expect(entry.description.length).toBeGreaterThan(0);
      expect(entry.examples.length).toBeGreaterThan(0);
    }
  });

  it('expands the emoji command into one entry per subcommand, described by the subcommand', async () => {
    const commands = await loadCommands();
    const catalog = buildCatalog(commands);
    const emoji = commands.find((command) => command.access.kind !== 'staff' && command.data.name === 'emoji');
    const subcommands = emoji?.data.toJSON().options;

    expect(catalog.filter((entry) => entry.slash.startsWith('/emoji '))).toHaveLength(2);
    expect(catalog.find((entry) => entry.slash === '/emoji add')).toMatchObject({
      prefix: 'k!emoji-add',
      description: subcommands?.find((option) => option.name === 'add')?.description,
    });
    expect(catalog.find((entry) => entry.slash === '/emoji info')).toMatchObject({
      prefix: 'k!emoji-info',
      description: subcommands?.find((option) => option.name === 'info')?.description,
    });
  });

  it('renders the catalog as a generated module exporting COMMAND_CATALOG', async () => {
    const source = renderCatalogModule(buildCatalog(await loadCommands()));
    expect(source.startsWith('// Gerado por')).toBe(true);
    expect(source).toContain('export const COMMAND_CATALOG');
  });

  it('loads every real command module under the topic of its folder', async () => {
    await expect(loadCommands()).resolves.not.toHaveLength(0);
  });
});
