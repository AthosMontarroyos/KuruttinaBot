import type { CatalogCommand } from '@kuruttina/command-catalog';
import { describe, expect, it, vi } from 'vitest';
import { buildHelpReply } from '../apps/bot/src/command-system/helpReply.js';
import { command as helpCommand } from '../apps/bot/src/commands/public/help.js';
import { createRenderer } from '../apps/bot/src/infrastructure/discord/commands/commandContext.js';
import type { CommandContext } from '../apps/bot/src/command-system/types.js';

const emojis = { book: '<:book:book-id>', search: '<:search:search-id>' };

function entry(overrides: Partial<CatalogCommand> & Pick<CatalogCommand, 'id' | 'topic' | 'slash' | 'prefix' | 'description'>): CatalogCommand {
  return { examples: [{ slash: overrides.slash, prefix: overrides.prefix }], permissions: [], ...overrides };
}

const catalog: CatalogCommand[] = [
  entry({ id: 'ban', topic: 'mod', slash: '/ban', prefix: 'k!ban', description: 'Bane um membro do servidor', permissions: ['Banir membros'] }),
  entry({ id: 'ping', topic: 'utility', slash: '/ping', prefix: 'k!ping', description: 'Mostra a latência' }),
  entry({ id: 'moeda', topic: 'fun', slash: '/moeda', prefix: 'k!moeda', description: 'Joga uma moeda' }),
  entry({ id: 'emoji-add', topic: 'mod', slash: '/emoji add', prefix: 'k!emoji-add', description: 'Adiciona um emoji', permissions: ['Gerenciar expressões'] }),
  entry({ id: 'emoji-info', topic: 'utility', slash: '/emoji info', prefix: 'k!emoji-info', description: 'Mostra um emoji do servidor' }),
  entry({ id: 'dev-status', topic: 'dev', slash: '/dev status', prefix: 'k!dev-status', description: 'Estado interno' }),
];

/** Texto de todas as fields e campos de um embed, para conferir conteúdo sem depender da ordem. */
function embedText(reply: unknown): string {
  const embed = (reply as { embeds: { title?: string; description?: string; fields?: { name: string; value: string }[] }[] }).embeds[0];
  return [embed?.title, embed?.description, ...(embed?.fields ?? []).flatMap((field) => [field.name, field.value])].join('\n');
}

function commandContext(overrides: Partial<CommandContext> = {}) {
  const reply = vi.fn().mockResolvedValue(undefined);
  const emoji = vi.fn(async (name: string) => `<:${name}:${name}-id>`);
  const context: CommandContext = {
    apiPing: 42,
    gatewayPing: 84,
    render: createRenderer(emoji),
    acknowledge: vi.fn().mockResolvedValue(undefined),
    emoji,
    reply,
    commandCatalog: catalog,
    ...overrides,
  };
  return { context, reply, acknowledge: context.acknowledge };
}

describe('buildHelpReply list', () => {
  it('groups public commands by topic in topic order and omits dev', () => {
    const reply = buildHelpReply(catalog, undefined, emojis);
    expect(reply).toEqual({
      content: '<:book:book-id> Estes são os comandos que posso fazer por você. Use **/help comando** para ver os detalhes.',
      embeds: [{
        color: 0xf08db4,
        fields: [
          { name: 'Utilidades', value: '`/ping` · Mostra a latência\n`/emoji info` · Mostra um emoji do servidor', inline: false },
          { name: 'Diversão', value: '`/moeda` · Joga uma moeda', inline: false },
          { name: 'Moderação', value: '`/ban` · Bane um membro do servidor\n`/emoji add` · Adiciona um emoji', inline: false },
        ],
        footer: { text: 'Também respondo a k! no lugar da /.' },
      }],
    });
    expect(embedText(reply)).not.toContain('/dev status');
  });

  it.each([undefined, '', '   ', '/', 'k!'])('treats query %j as the list', (query) => {
    expect(buildHelpReply(catalog, query, emojis)).toEqual(buildHelpReply(catalog, undefined, emojis));
  });
});

describe('buildHelpReply search', () => {
  it.each(['ban', '/ban', 'k!ban', 'BAN', '  K!Ban  '])('returns the detail for %j', (query) => {
    const reply = buildHelpReply(catalog, query, emojis);
    expect(reply).toEqual({
      content: '<:book:book-id> Aqui está o que sei sobre **/ban**.',
      embeds: [{
        color: 0xf08db4,
        title: '/ban',
        description: 'Bane um membro do servidor',
        fields: [
          { name: 'Como usar', value: '`/ban`\n`k!ban`', inline: false },
          { name: 'Exemplos', value: '`/ban`\n`k!ban`', inline: false },
          { name: 'Permissão', value: 'Você precisa de: **Banir membros**', inline: false },
        ],
      }],
    });
  });

  it('omits the permission field when the command needs none', () => {
    const reply = buildHelpReply(catalog, 'ping', emojis) as { embeds: { fields: { name: string }[] }[] };
    expect(reply.embeds[0]?.fields.map((field) => field.name)).toEqual(['Como usar', 'Exemplos']);
  });

  it('lists every route of a root command', () => {
    const reply = buildHelpReply(catalog, 'emoji', emojis);
    const text = embedText(reply);
    expect(text).toContain('`/emoji add`');
    expect(text).toContain('`/emoji info`');
    expect(text).not.toContain('Você precisa de');
    expect(reply).toMatchObject({ content: '<:book:book-id> Estes são os comandos que posso fazer por você. Use **/help comando** para ver os detalhes.' });
  });

  it.each(['emoji add', '/emoji add', 'k!emoji-add', 'emoji-add'])('returns the detail of a route for %j', (query) => {
    expect(buildHelpReply(catalog, query, emojis)).toMatchObject({
      content: '<:book:book-id> Aqui está o que sei sobre **/emoji add**.',
      embeds: [{ title: '/emoji add', fields: expect.arrayContaining([
        { name: 'Permissão', value: 'Você precisa de: **Gerenciar expressões**', inline: false },
      ]) }],
    });
  });

  it.each(['naoexiste', 'dev status', 'dev-status', 'dev', 'k!dev-status'])('answers not found for %j', (query) => {
    expect(buildHelpReply(catalog, query, emojis)).toBe('<:search:search-id> Não encontrei esse comando. Use **/help** para ver a lista.');
  });

  it('keeps every field value within the Discord limit for many long commands', () => {
    const many: CatalogCommand[] = Array.from({ length: 40 }, (_, index) => entry({
      id: `longo-${index}`,
      topic: 'utility',
      slash: `/longo${index} ${'x'.repeat(40)}`,
      prefix: `k!longo${index}`,
      description: 'Descrição bem comprida para estourar o limite do field. '.repeat(3),
    }));
    const reply = buildHelpReply(many, undefined, emojis) as { embeds: { fields: { value: string }[] }[] };
    const fields = reply.embeds[0]?.fields ?? [];
    expect(fields.length).toBeLessThanOrEqual(25);
    for (const field of fields) {
      expect(field.value.length).toBeLessThanOrEqual(1024);
      expect(field.value.endsWith('…')).toBe(true);
    }
  });

  it('keeps long example blocks within the Discord limit', () => {
    const big: CatalogCommand = entry({
      id: 'grande',
      topic: 'utility',
      slash: '/grande',
      prefix: 'k!grande',
      description: 'Comando com muitos exemplos',
    });
    const examples = Array.from({ length: 30 }, (_, index) => ({ slash: `/grande exemplo:${index} ${'y'.repeat(50)}`, prefix: `k!grande ${index} ${'z'.repeat(50)}` }));
    const reply = buildHelpReply([{ ...big, examples }], 'grande', emojis) as { embeds: { fields: { name: string; value: string }[] }[] };
    const exemplos = reply.embeds[0]?.fields.find((field) => field.name === 'Exemplos');
    expect(exemplos?.value.length).toBeLessThanOrEqual(1024);
  });
});

describe('help command executor', () => {
  it('answers a slash query with the detail of the requested command', async () => {
    const { context, reply, acknowledge } = commandContext({ options: [{ name: 'comando', value: 'ban' }] });
    await helpCommand.execute(context);
    expect(acknowledge).toHaveBeenCalledOnce();
    expect(reply).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
      content: '<:book:book-id> Aqui está o que sei sobre **/ban**.',
      embeds: [expect.objectContaining({ title: '/ban' })],
    }));
  });

  it('answers a prefix query from the raw arguments', async () => {
    const { context, reply } = commandContext({ rawArgs: 'ban' });
    await helpCommand.execute(context);
    expect(reply).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
      embeds: [expect.objectContaining({ title: '/ban' })],
    }));
  });

  it('lists the catalog when no query is given', async () => {
    const { context, reply } = commandContext({ options: [] });
    await helpCommand.execute(context);
    expect(reply).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
      embeds: [expect.objectContaining({ footer: { text: 'Também respondo a k! no lugar da /.' } })],
    }));
  });

  it('ignores a non-string option value', async () => {
    const { context, reply } = commandContext({ options: [{ name: 'comando', value: 42 }] });
    await helpCommand.execute(context);
    expect(reply).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
      embeds: [expect.objectContaining({ footer: { text: 'Também respondo a k! no lugar da /.' } })],
    }));
  });

  it('answers not found for a staff command', async () => {
    const { context, reply } = commandContext({ rawArgs: 'dev status' });
    await helpCommand.execute(context);
    expect(reply).toHaveBeenCalledExactlyOnceWith('<:search:search-id> Não encontrei esse comando. Use **/help** para ver a lista.');
  });

  it('describes the optional comando option with a length limit', () => {
    const json = helpCommand.data.toJSON();
    expect(json.name).toBe('help');
    expect(json.options).toEqual([expect.objectContaining({ name: 'comando', required: false, max_length: 60 })]);
  });
});
