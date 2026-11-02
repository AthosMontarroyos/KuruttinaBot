import type { CatalogCommand } from '@kuruttina/command-catalog';
import { ButtonStyle, ComponentType } from 'discord.js';
import { describe, expect, it, vi } from 'vitest';
import { HELP_PAGE_SIZE, buildHelpPage, buildHelpReply, helpCustomId, parseHelpCustomId } from '../apps/bot/src/command-system/helpReply.js';
import { command as helpCommand } from '../apps/bot/src/commands/public/help.js';
import { createRenderer } from '../apps/bot/src/infrastructure/discord/commands/commandContext.js';
import type { CommandContext } from '../apps/bot/src/command-system/types.js';

const emojis = { book: '<:book:book-id>', search: '<:search:search-id>' };
const OWNER = '666948364507545600';

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

describe('buildHelpPage overview', () => {
  it('lists each topic with its command count and the total of pages', () => {
    expect(buildHelpPage(catalog, 0, undefined, { book: '<:book:book-id>' })).toEqual({
      content: '<:book:book-id> Estes são os comandos que posso fazer por você. Use as setas para navegar ou **/help comando** para ver os detalhes.',
      embeds: [{
        color: 0xf08db4,
        title: 'Ajuda',
        fields: [
          { name: 'Utilidades', value: '2 comandos · Ferramentas e consultas do dia a dia.', inline: false },
          { name: 'Diversão', value: '1 comando · Comandos para brincar.', inline: false },
          { name: 'Moderação', value: '2 comandos · Exigem permissões de moderação no servidor.', inline: false },
        ],
        footer: { text: 'Página 1/4' },
      }],
    });
  });

  it('omits the dev topic and topics without commands', () => {
    const text = embedText(buildHelpPage(catalog, 0, undefined, emojis));
    expect(text).not.toContain('Equipe');
    expect(text).not.toContain('Público');
    expect(text).not.toContain('/dev status');
  });

  it('shows an empty notice when there are no public commands', () => {
    const reply = buildHelpPage([entry({ id: 'dev-status', topic: 'dev', slash: '/dev status', prefix: 'k!dev-status', description: 'Estado interno' })], 0, undefined, emojis);
    expect(reply).toEqual({
      content: '<:book:book-id> Não há comandos para mostrar agora.',
      embeds: [{ color: 0xf08db4, title: 'Ajuda', fields: [], footer: { text: 'Página 1/1' } }],
    });
  });
});

describe('buildHelpPage topics', () => {
  it('shows the commands of the first topic on page 2', () => {
    expect(buildHelpPage(catalog, 1, undefined, emojis)).toEqual({
      content: '<:book:book-id> Tópico **Utilidades**.',
      embeds: [{
        color: 0xf08db4,
        title: 'Utilidades',
        description: 'Ferramentas e consultas do dia a dia.',
        fields: [
          { name: '/ping', value: 'Mostra a latência\n`k!ping`', inline: false },
          { name: '/emoji info', value: 'Mostra um emoji do servidor\n`k!emoji-info`', inline: false },
        ],
        footer: { text: 'Página 2/4' },
      }],
    });
  });

  it('ends on the last topic with the right footer', () => {
    expect(buildHelpPage(catalog, 3, undefined, emojis)).toMatchObject({
      content: '<:book:book-id> Tópico **Moderação**.',
      embeds: [{ title: 'Moderação', footer: { text: 'Página 4/4' } }],
    });
  });

  it('splits a topic with 14 commands into three blocks of at most six', () => {
    const many: CatalogCommand[] = Array.from({ length: 14 }, (_, index) => entry({
      id: `cmd-${index}`,
      topic: 'utility',
      slash: `/cmd${index}`,
      prefix: `k!cmd${index}`,
      description: `Comando ${index}`,
    }));
    const overview = buildHelpPage(many, 0, undefined, emojis) as { embeds: { footer: { text: string } }[] };
    expect(overview.embeds[0]?.footer.text).toBe('Página 1/4');

    const parts = [1, 2, 3].map((page) => buildHelpPage(many, page, undefined, emojis) as {
      embeds: { title: string; fields: { name: string }[]; footer: { text: string } }[];
    }).map((reply) => reply.embeds[0]);
    expect(parts.map((embed) => embed?.title)).toEqual([
      'Utilidades (parte 1/3)',
      'Utilidades (parte 2/3)',
      'Utilidades (parte 3/3)',
    ]);
    expect(parts.map((embed) => embed?.fields.length)).toEqual([6, 6, 2]);
    expect(parts.map((embed) => embed?.footer.text)).toEqual(['Página 2/4', 'Página 3/4', 'Página 4/4']);
    expect(parts[2]?.fields.map((field) => field.name)).toEqual(['/cmd12', '/cmd13']);
  });

  it('keeps topic field values within the Discord limit', () => {
    const long: CatalogCommand[] = [entry({ id: 'longo', topic: 'utility', slash: '/longo', prefix: 'k!longo', description: 'x'.repeat(1500) })];
    const reply = buildHelpPage(long, 1, undefined, emojis) as { embeds: { fields: { value: string }[] }[] };
    const value = reply.embeds[0]?.fields[0]?.value ?? '';
    expect(value).toHaveLength(1024);
    expect(value.endsWith('…')).toBe(true);
  });

  it('clamps a page above the last one to the last page', () => {
    expect(buildHelpPage(catalog, 99, undefined, emojis)).toEqual(buildHelpPage(catalog, 3, undefined, emojis));
  });

  it('clamps a negative page to the overview', () => {
    expect(buildHelpPage(catalog, -5, undefined, emojis)).toEqual(buildHelpPage(catalog, 0, undefined, emojis));
  });
});

describe('buildHelpPage buttons', () => {
  it('disables the previous button on the first page', () => {
    const reply = buildHelpPage(catalog, 0, OWNER, emojis) as unknown as { components: { type: number; components: { disabled?: boolean; custom_id?: string; label?: string }[] }[] };
    const [row] = reply.components;
    expect(row).toMatchObject({ type: ComponentType.ActionRow });
    expect(row?.components.map((button) => button.disabled)).toEqual([true, true, false]);
    expect(row?.components[1]).toMatchObject({ custom_id: 'kt:help:noop', label: '1/4' });
    expect(row?.components[2]?.custom_id).toBe(`kt:help:1:${OWNER}`);
  });

  it('disables the next button on the last page', () => {
    const reply = buildHelpPage(catalog, 3, OWNER, emojis) as unknown as { components: { components: { disabled?: boolean; custom_id?: string; label?: string }[] }[] };
    const buttons = reply.components[0]?.components ?? [];
    expect(buttons.map((button) => button.disabled)).toEqual([false, true, true]);
    expect(buttons[0]?.custom_id).toBe(`kt:help:2:${OWNER}`);
    expect(buttons[1]?.label).toBe('4/4');
  });

  it('uses the arrow emojis and secondary style', () => {
    const reply = buildHelpPage(catalog, 1, OWNER, emojis) as unknown as { components: { components: unknown[] }[] };
    expect(reply.components[0]?.components).toEqual([
      { type: ComponentType.Button, style: ButtonStyle.Secondary, custom_id: `kt:help:0:${OWNER}`, emoji: { name: '⬅️' }, disabled: false },
      { type: ComponentType.Button, style: ButtonStyle.Secondary, custom_id: 'kt:help:noop', label: '2/4', disabled: true },
      { type: ComponentType.Button, style: ButtonStyle.Secondary, custom_id: `kt:help:2:${OWNER}`, emoji: { name: '➡️' }, disabled: false },
    ]);
  });

  it('has no components without an owner', () => {
    expect(buildHelpPage(catalog, 1, undefined, emojis)).not.toHaveProperty('components');
  });
});

describe('helpCustomId and parseHelpCustomId', () => {
  it('round-trips the page and the owner', () => {
    expect(parseHelpCustomId(helpCustomId(3, OWNER))).toEqual({ page: 3, ownerId: OWNER });
  });

  it('parses a valid custom id', () => {
    expect(parseHelpCustomId(`kt:help:2:${OWNER}`)).toEqual({ page: 2, ownerId: OWNER });
  });

  it.each([
    'kt:help:noop',
    `kt:help:x:${OWNER}`,
    'kt:help:2:123',
    `kt:help:1234:${OWNER}`,
    `kt:help:2:${OWNER}:extra`,
    `kt:help:-1:${OWNER}`,
    `kt:c:1-${OWNER}`,
    '',
  ])('rejects %j', (customId) => {
    expect(parseHelpCustomId(customId)).toBeNull();
  });
});

describe('buildHelpReply', () => {
  it('starts the paged help without a query', () => {
    expect(buildHelpReply(catalog, undefined, emojis, OWNER)).toEqual(buildHelpPage(catalog, 0, OWNER, emojis));
  });

  it.each([undefined, '', '   ', '/', 'k!'])('treats query %j as the overview', (query) => {
    expect(buildHelpReply(catalog, query, emojis)).toEqual(buildHelpPage(catalog, 0, undefined, emojis));
  });

  it('keeps the detail of a command without buttons', () => {
    expect(buildHelpReply(catalog, 'ban', emojis, OWNER)).toEqual({
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

  it('keeps the list of several matches without buttons', () => {
    const reply = buildHelpReply(catalog, 'emoji', emojis, OWNER);
    expect(reply).not.toHaveProperty('components');
    expect(embedText(reply)).toContain('`/emoji add`');
  });

  it('keeps the not found text without buttons', () => {
    expect(buildHelpReply(catalog, 'naoexiste', emojis, OWNER)).toBe('<:search:search-id> Não encontrei esse comando. Use **/help** para ver a lista.');
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
    // 40 comandos de um tópico: visão geral + 7 blocos de até 6 comandos.
    expect(buildHelpPage(many, 0, undefined, emojis)).toMatchObject({ embeds: [{ footer: { text: 'Página 1/8' } }] });
    for (let page = 1; page <= 7; page++) {
      const reply = buildHelpPage(many, page, undefined, emojis) as { embeds: { fields: { value: string }[] }[] };
      const fields = reply.embeds[0]?.fields ?? [];
      expect(fields.length).toBeLessThanOrEqual(HELP_PAGE_SIZE);
      for (const field of fields) {
        expect(field.value.length).toBeLessThanOrEqual(1024);
      }
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

  it('shows the overview of the catalog when no query is given', async () => {
    const { context, reply } = commandContext({ options: [] });
    await helpCommand.execute(context);
    expect(reply).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
      embeds: [expect.objectContaining({ title: 'Ajuda', footer: { text: 'Página 1/4' } })],
    }));
  });

  it('adds the navigation buttons for the user who ran the command', async () => {
    const { context, reply } = commandContext({ options: [], userId: OWNER });
    await helpCommand.execute(context);
    expect(reply).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
      components: [expect.objectContaining({ type: ComponentType.ActionRow })],
    }));
  });

  it('ignores a non-string option value', async () => {
    const { context, reply } = commandContext({ options: [{ name: 'comando', value: 42 }] });
    await helpCommand.execute(context);
    expect(reply).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
      embeds: [expect.objectContaining({ title: 'Ajuda', footer: { text: 'Página 1/4' } })],
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
