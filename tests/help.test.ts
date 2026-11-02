import type { CatalogCommand } from '@kuruttina/command-catalog';
import { ButtonStyle, ComponentType } from 'discord.js';
import { describe, expect, it, vi } from 'vitest';
import { HELP_PAGE_SIZE, buildHelpPage, buildHelpReply, helpCustomId, parseHelpCustomId, resolveHelpEmojis } from '../apps/bot/src/command-system/helpReply.js';
import { command as helpCommand } from '../apps/bot/src/commands/public/help.js';
import { createRenderer } from '../apps/bot/src/infrastructure/discord/commands/commandContext.js';
import type { CommandContext } from '../apps/bot/src/command-system/types.js';

const emojis = { book: '📖', search: '🔎' };
const customEmojis = { book: '<:book:111111111111111111>', search: '<:search:222222222222222222>' };
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

/** Detalhe do `/ban` com emojis Unicode (ou ausentes): sem thumbnail e sem emoji nos campos. */
const banDetail = {
  content: '📖 Aqui está o que sei sobre **/ban**.',
  embeds: [{
    color: 0xf08db4,
    title: '/ban',
    description: 'Bane um membro do servidor',
    fields: [
      { name: 'Como usar', value: '`/ban`\n`k!ban`', inline: true },
      { name: 'Permissão', value: '**Banir membros**', inline: true },
      { name: 'Exemplos', value: '`/ban`\n`k!ban`', inline: false },
    ],
    footer: { text: 'Tópico: Moderação · /help mostra todos os comandos' },
  }],
};

/** Texto de todas as fields e campos de um embed, para conferir conteúdo sem depender da ordem. */
function embedText(reply: unknown): string {
  const embed = (reply as { embeds: { title?: string; description?: string; fields?: { name: string; value: string }[] }[] }).embeds[0];
  return [embed?.title, embed?.description, ...(embed?.fields ?? []).flatMap((field) => [field.name, field.value])].join('\n');
}

function commandContext(overrides: Partial<CommandContext> = {}) {
  const reply = vi.fn().mockResolvedValue(undefined);
  const emoji = vi.fn(async (name: string) => `<:${name}:111111111111111111>`);
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
    expect(buildHelpPage(catalog, 0, undefined, { book: '📖' })).toEqual({
      content: '📖 Estes são os comandos que posso fazer por você.',
      embeds: [{
        color: 0xf08db4,
        title: '📖 Central de ajuda',
        description: 'Use as setas para navegar ou abra um comando direto com `/help comando:ban`.\nTodos funcionam com `/` e com o prefixo `k!`.',
        fields: [
          { name: 'Utilidades', value: '**2 comandos** · Ferramentas e consultas do dia a dia.\n`/ping` `/emoji info`', inline: false },
          { name: 'Diversão', value: '**1 comando** · Comandos para brincar.\n`/moeda`', inline: false },
          { name: 'Moderação', value: '**2 comandos** · Exigem permissões de moderação no servidor.\n`/ban` `/emoji add`', inline: false },
        ],
        footer: { text: 'Página 1/4 · Setas para navegar' },
      }],
    });
  });

  it('omits the dev topic and topics without commands', () => {
    const text = embedText(buildHelpPage(catalog, 0, undefined, emojis));
    expect(text).not.toContain('Equipe');
    expect(text).not.toContain('Público');
    expect(text).not.toContain('/dev status');
  });

  it('never shows the dev topic, even when its emoji is resolved', () => {
    const withDev = { ...emojis, dev: '<:developer:333333333333333333>' };
    for (let page = 0; page <= 3; page++) {
      expect(JSON.stringify(buildHelpPage(catalog, page, OWNER, withDev))).not.toContain('333333333333333333');
    }
    expect(JSON.stringify(buildHelpReply(catalog, 'dev status', withDev))).not.toContain('333333333333333333');
  });

  it('puts the topic emoji before each field name and skips the missing ones', () => {
    const reply = buildHelpPage(catalog, 0, undefined, { ...emojis, utility: '⚙️', mod: '🛡️' }) as { embeds: { fields: { name: string }[] }[] };
    expect(reply.embeds[0]?.fields.map((field) => field.name)).toEqual(['⚙️ Utilidades', 'Diversão', '🛡️ Moderação']);
  });

  it('uses a custom book emoji as the overview thumbnail', () => {
    expect(buildHelpPage(catalog, 0, undefined, customEmojis)).toMatchObject({
      content: '<:book:111111111111111111> Estes são os comandos que posso fazer por você.',
      embeds: [{
        title: '<:book:111111111111111111> Central de ajuda',
        thumbnail: { url: 'https://cdn.discordapp.com/emojis/111111111111111111.png?size=128' },
      }],
    });
  });

  it('shows an empty notice when there are no public commands', () => {
    const reply = buildHelpPage([entry({ id: 'dev-status', topic: 'dev', slash: '/dev status', prefix: 'k!dev-status', description: 'Estado interno' })], 0, undefined, emojis);
    expect(reply).toEqual({
      content: '📖 Não há comandos para mostrar agora.',
      embeds: [{
        color: 0xf08db4,
        title: '📖 Central de ajuda',
        description: 'Não há comandos para mostrar agora.',
        fields: [],
        footer: { text: 'Página 1/1 · Setas para navegar' },
      }],
    });
  });

  it('leaves out empty emojis without double spaces', () => {
    const empty = { book: '', search: '', usage: '', example: '', permission: '', utility: '' };
    const texts = [
      buildHelpPage(catalog, 0, undefined, empty),
      buildHelpPage(catalog, 1, undefined, empty),
      buildHelpReply(catalog, 'ban', empty),
      buildHelpReply(catalog, 'emoji', empty),
    ].map((reply) => JSON.stringify(reply));
    for (const text of texts) expect(text).not.toContain('  ');
    expect(buildHelpReply(catalog, 'naoexiste', empty)).toBe('Não encontrei esse comando. Use **/help** para ver a lista.');
  });
});

describe('buildHelpPage topics', () => {
  it('shows the commands of the first topic on page 2', () => {
    expect(buildHelpPage(catalog, 1, undefined, emojis)).toEqual({
      content: '📖 Tópico **Utilidades**.',
      embeds: [{
        color: 0xf08db4,
        title: 'Utilidades',
        description: '*Ferramentas e consultas do dia a dia.*',
        fields: [
          { name: '/ping', value: 'Mostra a latência\n`k!ping`\n`/ping`', inline: false },
          { name: '/emoji info', value: 'Mostra um emoji do servidor\n`k!emoji-info`\n`/emoji info`', inline: false },
        ],
        footer: { text: 'Página 2/4 · Utilidades' },
      }],
    });
  });

  it('ends on the last topic with the right footer', () => {
    expect(buildHelpPage(catalog, 3, undefined, emojis)).toMatchObject({
      content: '📖 Tópico **Moderação**.',
      embeds: [{ title: 'Moderação', footer: { text: 'Página 4/4 · Moderação' } }],
    });
  });

  it('puts the command emojis before the prefix, permission and example lines', () => {
    const reply = buildHelpPage(catalog, 3, undefined, { ...emojis, usage: '📚', permission: '🔒', example: '📝' }) as { embeds: { fields: { value: string }[] }[] };
    expect(reply.embeds[0]?.fields[0]?.value).toBe('Bane um membro do servidor\n📚 `k!ban`\n🔒 Banir membros\n📝 `/ban`');
  });

  it('shows the topic emoji in the title and as a thumbnail when it is custom', () => {
    expect(buildHelpPage(catalog, 3, undefined, { ...emojis, mod: '<a:moderation:777777777777777777>' })).toMatchObject({
      embeds: [{
        title: '<a:moderation:777777777777777777> Moderação',
        thumbnail: { url: 'https://cdn.discordapp.com/emojis/777777777777777777.gif?size=128' },
      }],
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
    expect(overview.embeds[0]?.footer.text).toBe('Página 1/4 · Setas para navegar');

    const parts = [1, 2, 3].map((page) => buildHelpPage(many, page, undefined, emojis) as {
      embeds: { title: string; fields: { name: string }[]; footer: { text: string } }[];
    }).map((reply) => reply.embeds[0]);
    expect(parts.map((embed) => embed?.title)).toEqual([
      'Utilidades (parte 1/3)',
      'Utilidades (parte 2/3)',
      'Utilidades (parte 3/3)',
    ]);
    expect(parts.map((embed) => embed?.fields.length)).toEqual([6, 6, 2]);
    expect(parts.map((embed) => embed?.footer.text)).toEqual([
      'Página 2/4 · Utilidades',
      'Página 3/4 · Utilidades',
      'Página 4/4 · Utilidades',
    ]);
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

  it('uses the custom arrow emojis on the buttons', () => {
    const reply = buildHelpPage(catalog, 1, OWNER, { previous: '<:left_arrow:333333333333333333>', next: '<a:right_arrow:444444444444444444>' }) as unknown as { components: { components: unknown[] }[] };
    expect(reply.components[0]?.components).toEqual([
      { type: ComponentType.Button, style: ButtonStyle.Secondary, custom_id: `kt:help:0:${OWNER}`, emoji: { id: '333333333333333333', name: 'left_arrow', animated: false }, disabled: false },
      { type: ComponentType.Button, style: ButtonStyle.Secondary, custom_id: 'kt:help:noop', label: '2/4', disabled: true },
      { type: ComponentType.Button, style: ButtonStyle.Secondary, custom_id: `kt:help:2:${OWNER}`, emoji: { id: '444444444444444444', name: 'right_arrow', animated: true }, disabled: false },
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

describe('resolveHelpEmojis', () => {
  it('resolves the twelve catalog names once each and maps them by key', async () => {
    const resolve = vi.fn(async (name: string) => `<:${name}:111111111111111111>`);
    await expect(resolveHelpEmojis(resolve)).resolves.toEqual({
      book: '<:book:111111111111111111>',
      search: '<:search:111111111111111111>',
      usage: '<:Documentation:111111111111111111>',
      example: '<:Note:111111111111111111>',
      permission: '<:lock:111111111111111111>',
      previous: '<:left_arrow:111111111111111111>',
      next: '<:right_arrow:111111111111111111>',
      public: '<:home:111111111111111111>',
      utility: '<:settings:111111111111111111>',
      fun: '<:SpinningDancing:111111111111111111>',
      mod: '<:moderation:111111111111111111>',
      dev: '<:developer:111111111111111111>',
    });
    expect(resolve.mock.calls.map(([name]) => name).sort()).toEqual([
      'Documentation',
      'Note',
      'SpinningDancing',
      'book',
      'developer',
      'home',
      'left_arrow',
      'lock',
      'moderation',
      'right_arrow',
      'search',
      'settings',
    ]);
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
    expect(buildHelpReply(catalog, 'ban', emojis, OWNER)).toEqual(banDetail);
  });

  it('keeps the list of several matches without buttons', () => {
    const reply = buildHelpReply(catalog, 'emoji', emojis, OWNER);
    expect(reply).not.toHaveProperty('components');
    expect(embedText(reply)).toContain('`/emoji add`');
  });

  it('keeps the not found text without buttons', () => {
    expect(buildHelpReply(catalog, 'naoexiste', emojis, OWNER)).toBe('🔎 Não encontrei esse comando. Use **/help** para ver a lista.');
  });
});

describe('buildHelpReply search', () => {
  it.each(['ban', '/ban', 'k!ban', 'BAN', '  K!Ban  '])('returns the detail for %j', (query) => {
    expect(buildHelpReply(catalog, query, emojis)).toEqual(banDetail);
  });

  it('puts the topic and field emojis in the detail, with a thumbnail for a custom topic emoji', () => {
    const reply = buildHelpReply(catalog, 'ban', { ...customEmojis, mod: '<:moderation:888888888888888888>', usage: '📚', permission: '🔒', example: '📝' });
    expect(reply).toMatchObject({
      embeds: [{
        title: '<:moderation:888888888888888888> /ban',
        thumbnail: { url: 'https://cdn.discordapp.com/emojis/888888888888888888.png?size=128' },
        fields: [
          { name: '📚 Como usar', value: '`/ban`\n`k!ban`', inline: true },
          { name: '🔒 Permissão', value: '**Banir membros**', inline: true },
          { name: '📝 Exemplos', value: '`/ban`\n`k!ban`', inline: false },
        ],
        footer: { text: 'Tópico: Moderação · /help mostra todos os comandos' },
      }],
    });
  });

  it('omits the permission field when the command needs none', () => {
    const reply = buildHelpReply(catalog, 'ping', emojis) as { embeds: { fields: { name: string }[] }[] };
    expect(reply.embeds[0]?.fields.map((field) => field.name)).toEqual(['Como usar', 'Exemplos']);
  });

  it('lists every route of a root command', () => {
    expect(buildHelpReply(catalog, 'emoji', emojis)).toEqual({
      content: '📖 Encontrei estes comandos. Use **/help comando** para ver os detalhes.',
      embeds: [{
        color: 0xf08db4,
        fields: [
          { name: 'Utilidades', value: '`/emoji info` · Mostra um emoji do servidor', inline: false },
          { name: 'Moderação', value: '`/emoji add` · Adiciona um emoji', inline: false },
        ],
        footer: { text: 'Também respondo a k! no lugar da /.' },
      }],
    });
  });

  it('puts the topic emoji in front of each group of the list', () => {
    const reply = buildHelpReply(catalog, 'emoji', { ...emojis, utility: '⚙️', mod: '🛡️' }) as { embeds: { fields: { name: string }[] }[] };
    expect(reply.embeds[0]?.fields.map((field) => field.name)).toEqual(['⚙️ Utilidades', '🛡️ Moderação']);
  });

  it.each(['emoji add', '/emoji add', 'k!emoji-add', 'emoji-add'])('returns the detail of a route for %j', (query) => {
    expect(buildHelpReply(catalog, query, emojis)).toMatchObject({
      content: '📖 Aqui está o que sei sobre **/emoji add**.',
      embeds: [{ title: '/emoji add', fields: expect.arrayContaining([
        { name: 'Permissão', value: '**Gerenciar expressões**', inline: true },
      ]) }],
    });
  });

  it.each(['naoexiste', 'dev status', 'dev-status', 'dev', 'k!dev-status'])('answers not found for %j', (query) => {
    expect(buildHelpReply(catalog, query, emojis)).toBe('🔎 Não encontrei esse comando. Use **/help** para ver a lista.');
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
    expect(buildHelpPage(many, 0, undefined, emojis)).toMatchObject({ embeds: [{ footer: { text: 'Página 1/8 · Setas para navegar' } }] });
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
      content: '<:book:111111111111111111> Aqui está o que sei sobre **/ban**.',
      embeds: [expect.objectContaining({ title: '<:moderation:111111111111111111> /ban' })],
    }));
  });

  it('answers a prefix query from the raw arguments', async () => {
    const { context, reply } = commandContext({ rawArgs: 'ban' });
    await helpCommand.execute(context);
    expect(reply).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
      embeds: [expect.objectContaining({ title: '<:moderation:111111111111111111> /ban' })],
    }));
  });

  it('shows the overview of the catalog when no query is given', async () => {
    const { context, reply } = commandContext({ options: [] });
    await helpCommand.execute(context);
    expect(reply).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
      embeds: [expect.objectContaining({ title: '<:book:111111111111111111> Central de ajuda', footer: { text: 'Página 1/4 · Setas para navegar' } })],
    }));
  });

  it('adds the navigation buttons with the custom arrows for the user who ran the command', async () => {
    const { context, reply } = commandContext({ options: [], userId: OWNER });
    await helpCommand.execute(context);
    expect(reply).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
      components: [expect.objectContaining({
        type: ComponentType.ActionRow,
        components: [
          expect.objectContaining({ emoji: { id: '111111111111111111', name: 'left_arrow', animated: false } }),
          expect.objectContaining({ custom_id: 'kt:help:noop' }),
          expect.objectContaining({ emoji: { id: '111111111111111111', name: 'right_arrow', animated: false } }),
        ],
      })],
    }));
  });

  it('ignores a non-string option value', async () => {
    const { context, reply } = commandContext({ options: [{ name: 'comando', value: 42 }] });
    await helpCommand.execute(context);
    expect(reply).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
      embeds: [expect.objectContaining({ title: '<:book:111111111111111111> Central de ajuda', footer: { text: 'Página 1/4 · Setas para navegar' } })],
    }));
  });

  it('answers not found for a staff command', async () => {
    const { context, reply } = commandContext({ rawArgs: 'dev status' });
    await helpCommand.execute(context);
    expect(reply).toHaveBeenCalledExactlyOnceWith('<:search:111111111111111111> Não encontrei esse comando. Use **/help** para ver a lista.');
  });

  it('describes the optional comando option with a length limit', () => {
    const json = helpCommand.data.toJSON();
    expect(json.name).toBe('help');
    expect(json.options).toEqual([expect.objectContaining({ name: 'comando', required: false, max_length: 60 })]);
  });
});
