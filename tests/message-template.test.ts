import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  DEFAULT_GUILD_TEMPLATE_LIMITS,
  DISCORD_MESSAGE_LIMITS,
  checkGuildQuota,
  countTemplateComponents,
  validateTemplate,
  escapeUserValue,
  extractVariables,
  fillEmojis,
  renderTemplate,
  type MessageTemplate,
  type TemplateVariable,
} from '@kuruttina/message-templates';
import { MESSAGE_CATALOG, type MessageCatalogEntry } from '../apps/bot/src/application/messages/catalog.js';

const variables: TemplateVariable[] = [
  { name: 'user.name', maxLength: 32 },
  { name: 'server.name', maxLength: 100 },
];

const valid: MessageTemplate = {
  content: 'Olá {user.name}!',
  embeds: [
    {
      title: 'Bem-vindo a {server.name}',
      description: 'Texto sem variável.',
      url: 'https://example.com/a',
      fields: [{ name: 'Nome', value: '{user.name}' }],
      footer: { text: 'rodapé' },
      author: { name: '{user.name}', url: 'https://example.com' },
    },
  ],
  components: [
    { kind: 'buttons', buttons: [{ style: 'link', label: 'Site', url: 'https://example.com' }, { style: 'primary', label: 'Ok {user.name}', customId: 'kt:welcome:abc-1' }] },
    { kind: 'select', menu: { customId: 'kt:menu:roles', options: [{ label: 'A', value: 'a' }] } },
  ],
};

const codes = (template: MessageTemplate, vars = variables) => validateTemplate(template, vars).map((error) => error.code);
const withEmbed = (embed: MessageTemplate['embeds'][number]): MessageTemplate => ({ embeds: [embed], components: [] });
const withButton = (button: MessageTemplate['components'][number] & { kind: 'buttons' }): MessageTemplate => ({ embeds: [], components: [button] });

describe('limits', () => {
  it('are frozen with the documented values', () => {
    expect(Object.isFrozen(DISCORD_MESSAGE_LIMITS)).toBe(true);
    expect(DISCORD_MESSAGE_LIMITS).toMatchObject({ content: 2000, embeds: 10, embedTitle: 256, embedTotal: 6000, customId: 100 });
    expect(DEFAULT_GUILD_TEMPLATE_LIMITS).toEqual({ maxTemplates: 100, maxButtons: 50, maxSelectMenus: 50 });
  });
});

describe('validateTemplate', () => {
  it('accepts a complete valid template', () => {
    expect(validateTemplate(valid, variables)).toEqual([]);
  });

  it('rejects 11 embeds', () => {
    const embeds = Array.from({ length: 11 }, () => ({ title: 'x' }));
    expect(codes({ embeds, components: [] })).toContain('too_many_embeds');
  });

  it('rejects 6 component rows', () => {
    const row: MessageTemplate['components'][number] = { kind: 'buttons', buttons: [{ style: 'primary', label: 'x', customId: 'kt:a:1' }] };
    expect(codes({ embeds: [], components: Array.from({ length: 6 }, () => row) })).toContain('too_many_rows');
  });

  it('rejects a select menu mixed with buttons in the same row', () => {
    const mixed = { kind: 'buttons', buttons: [{ style: 'primary', label: 'x', customId: 'kt:a:1' }], menu: { customId: 'kt:m:1', options: [{ label: 'a', value: 'a' }] } };
    expect(codes({ embeds: [], components: [mixed as never] })).toEqual(['mixed_row']);
  });

  it('counts buttons and menus of a template', () => {
    expect(countTemplateComponents(valid)).toEqual({ buttons: 2, menus: 1 });
  });

  it('rejects a title with 257 characters', () => {
    expect(codes(withEmbed({ title: 'a'.repeat(257) }))).toContain('limit_exceeded');
    expect(codes(withEmbed({ title: 'a'.repeat(256) }))).toEqual([]);
  });

  it('rejects embeds above 6000 characters in total', () => {
    const embeds = Array.from({ length: 2 }, () => ({ description: 'a'.repeat(3001) }));
    const errors = validateTemplate({ embeds, components: [] }, variables);
    expect(errors.map((error) => error.path)).toEqual(['embeds']);
  });

  it('uses the worst case of each variable', () => {
    expect(codes(withEmbed({ title: `${'a'.repeat(230)}{user.name}` }))).toContain('limit_exceeded');
    expect(codes(withEmbed({ title: `${'a'.repeat(224)}{user.name}` }))).toEqual([]);
  });

  it('rejects undeclared and non-key variables without evaluating them', () => {
    expect(codes({ content: '{foo}', embeds: [], components: [] })).toEqual(['unknown_variable']);
    expect(codes({ content: '{constructor}', embeds: [], components: [] })).toEqual(['unknown_variable']);
    expect(codes({ content: '{a.b()}', embeds: [], components: [] })).toEqual(['invalid_variable']);
    expect(codes({ content: '{__proto__}', embeds: [], components: [] })).toEqual(['invalid_variable']);
  });

  it('rejects variables in URL, custom_id and select options', () => {
    expect(codes(withEmbed({ title: 'x', url: 'https://example.com/{user.name}' }))).toContain('variable_not_allowed');
    expect(codes(withButton({ kind: 'buttons', buttons: [{ style: 'link', label: 'x', url: 'https://example.com/{user.name}' }] }))).toContain('variable_not_allowed');
    expect(codes(withButton({ kind: 'buttons', buttons: [{ style: 'primary', label: 'x', customId: 'kt:a:{user.name}' }] }))).toContain('variable_not_allowed');
    expect(codes({ embeds: [], components: [{ kind: 'select', menu: { customId: 'kt:m:1', options: [{ label: '{user.name}', value: 'a' }] } }] })).toContain('variable_not_allowed');
  });

  it('rejects non-https URLs', () => {
    expect(codes(withButton({ kind: 'buttons', buttons: [{ style: 'link', label: 'x', url: 'http://example.com' }] }))).toContain('invalid_url');
    expect(codes(withButton({ kind: 'buttons', buttons: [{ style: 'link', label: 'x', url: 'javascript:alert(1)' }] }))).toContain('invalid_url');
  });

  it('accepts embed images and icons only as https links', () => {
    const embed = (extra: object) => ({ embeds: [{ title: 'T', ...extra }], components: [] }) as unknown as MessageTemplate;
    expect(validateTemplate(embed({
      thumbnail: { url: 'https://example.com/t.png' },
      image: { url: 'https://example.com/i.png' },
      author: { name: 'A', iconUrl: 'https://example.com/a.png' },
      footer: { text: 'F', iconUrl: 'https://example.com/f.png' },
    }), variables)).toEqual([]);
    expect(codes(embed({ thumbnail: { url: 'http://example.com/t.png' } }))).toContain('invalid_url');
    expect(codes(embed({ image: { url: 'javascript:alert(1)' } }))).toContain('invalid_url');
    expect(codes(embed({ author: { name: 'A', iconUrl: 'ftp://example.com/a.png' } }))).toContain('invalid_url');
    expect(codes(embed({ footer: { text: 'F', iconUrl: '{user.name}' } }))).toContain('variable_not_allowed');
  });

  it('treats an embed with only an image as non-empty', () => {
    expect(codes({ embeds: [{ image: { url: 'https://example.com/i.png' } }], components: [] })).not.toContain('empty_embed');
  });

  it('validates custom_id format and size', () => {
    expect(codes(withButton({ kind: 'buttons', buttons: [{ style: 'primary', label: 'x', customId: 'abc' }] }))).toContain('invalid_custom_id');
    expect(codes(withButton({ kind: 'buttons', buttons: [{ style: 'primary', label: 'x', customId: `kt:a:${'b'.repeat(100)}` }] }))).toContain('invalid_custom_id');
  });

  describe('component action', () => {
    const buttonWith = (action: unknown): MessageTemplate => withButton({
      kind: 'buttons', buttons: [{ style: 'primary', label: 'x', customId: 'kt:a:1', action: action as never }],
    });
    const menuOptionWith = (action: unknown): MessageTemplate => ({
      embeds: [], components: [{ kind: 'select', menu: { customId: 'kt:m:1', options: [{ label: 'a', value: 'a', action: action as never }] } }],
    });

    it('accepts a valid action on a button and on a select option', () => {
      expect(codes(buttonWith({ type: 'reply', template: 'oi', ephemeral: true }))).toEqual([]);
      expect(codes(buttonWith({ type: 'edit', template: 'oi' }))).toEqual([]);
      expect(codes(buttonWith({ type: 'delete' }))).toEqual([]);
      expect(codes(buttonWith({ type: 'dm', template: 'oi' }))).toEqual([]);
      expect(codes(menuOptionWith({ type: 'reply', template: 'oi' }))).toEqual([]);
    });

    it('rejects an unknown action type', () => {
      expect(codes(buttonWith({ type: 'unknown' }))).toEqual(['invalid_action']);
    });

    it('rejects reply/edit/dm without a template', () => {
      expect(codes(buttonWith({ type: 'reply' }))).toEqual(['invalid_action']);
      expect(codes(buttonWith({ type: 'edit' }))).toEqual(['invalid_action']);
      expect(codes(buttonWith({ type: 'dm' }))).toEqual(['invalid_action']);
    });

    it('rejects a template name outside the pattern', () => {
      expect(codes(buttonWith({ type: 'reply', template: 'Nome Inválido!' }))).toEqual(['invalid_action']);
      expect(codes(buttonWith({ type: 'reply', template: 'a'.repeat(33) }))).toEqual(['invalid_action']);
    });

    it('rejects delete with a template', () => {
      expect(codes(buttonWith({ type: 'delete', template: 'oi' }))).toEqual(['invalid_action']);
    });

    it('rejects ephemeral outside reply, or non-boolean', () => {
      expect(codes(buttonWith({ type: 'edit', template: 'oi', ephemeral: true }))).toEqual(['invalid_action']);
      expect(codes(buttonWith({ type: 'delete', ephemeral: true }))).toEqual(['invalid_action']);
      expect(codes(buttonWith({ type: 'reply', template: 'oi', ephemeral: 'yes' }))).toEqual(['invalid_action']);
    });

    it('rejects more than one select option with an action (um custom_id por menu, não por opção)', () => {
      const template: MessageTemplate = {
        embeds: [],
        components: [{
          kind: 'select',
          menu: {
            customId: 'kt:m:1',
            options: [
              { label: 'a', value: 'a', action: { type: 'reply', template: 'oi' } },
              { label: 'b', value: 'b', action: { type: 'reply', template: 'tchau' } },
            ],
          },
        }],
      };
      expect(codes(template)).toEqual(['invalid_action']);
    });
  });
});

describe('component de botão (campo component)', () => {
  const buttonWith = (button: Record<string, unknown>): MessageTemplate => withButton({
    kind: 'buttons', buttons: [button as never],
  });
  const colored = (extra: Record<string, unknown> = {}): MessageTemplate => buttonWith({ style: 'primary', label: 'x', customId: 'kt:a:1', ...extra });

  it('aceita botão colorido com component inteiro positivo', () => {
    expect(codes(colored({ component: 1 }))).toEqual([]);
    expect(codes(colored({ component: 42 }))).toEqual([]);
  });

  it('rejeita component 0, negativo, decimal e string com invalid_action no path do campo', () => {
    for (const bad of [0, -1, 1.5, '3']) {
      const errors = validateTemplate(colored({ component: bad }), variables);
      expect(errors.map((error) => error.code)).toEqual(['invalid_action']);
      expect(errors[0]?.path).toBe('components[0].buttons[0].component');
    }
  });

  it('rejeita component em botão de link com invalid_action', () => {
    const template = buttonWith({ style: 'link', label: 'x', url: 'https://example.com', component: 1 });
    const errors = validateTemplate(template, variables);
    expect(errors.map((error) => error.code)).toEqual(['invalid_action']);
    expect(errors[0]?.path).toBe('components[0].buttons[0].component');
    expect(errors[0]?.message).toBe('Botão de link não pode ter ação.');
  });

  it('botão sem component segue válido (regressão)', () => {
    expect(codes(colored())).toEqual([]);
    expect(codes(valid)).toEqual([]);
  });
});

describe('emoji de botão (campo emoji)', () => {
  const buttonWith = (button: Record<string, unknown>): MessageTemplate => withButton({
    kind: 'buttons', buttons: [button as never],
  });
  const colored = (extra: Record<string, unknown> = {}): MessageTemplate => buttonWith({ style: 'primary', label: 'x', customId: 'kt:a:1', ...extra });
  const link = (extra: Record<string, unknown> = {}): MessageTemplate => buttonWith({ style: 'link', label: 'x', url: 'https://example.com', ...extra });
  const SNOWFLAKE = '123456789012345678';

  it('aceita emoji unicode em botão colorido e em botão de link', () => {
    expect(codes(colored({ emoji: { name: '😀' } }))).toEqual([]);
    expect(codes(link({ emoji: { name: '🔗' } }))).toEqual([]);
  });

  it('aceita emoji personalizado com id, com e sem animated', () => {
    expect(codes(colored({ emoji: { id: SNOWFLAKE, name: 'bot_logo' } }))).toEqual([]);
    expect(codes(colored({ emoji: { id: SNOWFLAKE, name: 'bot_logo', animated: true } }))).toEqual([]);
    expect(codes(link({ emoji: { id: SNOWFLAKE, name: 'bot_logo', animated: false } }))).toEqual([]);
  });

  it('rejeita emoji inválido com invalid_emoji no path do campo', () => {
    const invalid: Array<Record<string, unknown>> = [
      { id: '12345', name: 'bot_logo' },
      { id: '0123456789012345678', name: 'bot_logo' },
      { id: SNOWFLAKE, name: 'a' },
      { id: SNOWFLAKE, name: 'a b' },
      { id: SNOWFLAKE, name: 'bot-logo' },
      { name: '😀', role: 'extra' },
      { name: '😀', animated: true },
      { id: SNOWFLAKE, name: 'bot_logo', animated: 'sim' },
      { name: '' },
      { name: '   ' },
      { name: '{user.name}' },
    ];
    for (const emoji of invalid) {
      const errors = validateTemplate(colored({ emoji }), variables);
      expect(errors.map((error) => error.code), JSON.stringify(emoji)).toEqual(['invalid_emoji']);
      expect(errors[0]?.path).toBe('components[0].buttons[0].emoji');
    }
    expect(codes(link({ emoji: { name: '' } }))).toEqual(['invalid_emoji']);
  });

  it('rótulo vazio sem emoji continua falhando', () => {
    expect(codes(colored({ label: '' }))).toEqual(['empty_text']);
    expect(codes(link({ label: '' }))).toEqual(['empty_text']);
  });

  it('rótulo vazio com emoji válido passa, nos dois tipos de botão', () => {
    expect(codes(colored({ label: '', emoji: { name: '😀' } }))).toEqual([]);
    expect(codes(colored({ label: '', emoji: { id: SNOWFLAKE, name: 'bot_logo' } }))).toEqual([]);
    expect(codes(link({ label: '', emoji: { name: '🔗' } }))).toEqual([]);
  });

  it('rótulo vazio com emoji inválido falha pelos dois motivos', () => {
    expect(codes(colored({ label: '', emoji: { name: '' } })).sort()).toEqual(['empty_text', 'invalid_emoji']);
  });

  it('botão sem emoji segue válido (regressão)', () => {
    expect(codes(colored())).toEqual([]);
    expect(codes(link())).toEqual([]);
  });
});

describe('menu de seleção: campos novos (min/max, component, opções)', () => {
  const SNOWFLAKE = '123456789012345678';
  const defaultOptions = [{ label: 'a', value: 'a' }, { label: 'b', value: 'b' }];
  const menuWith = (menu: Record<string, unknown>, options: Array<Record<string, unknown>> = defaultOptions): MessageTemplate => ({
    embeds: [],
    components: [{ kind: 'select', menu: { customId: 'kt:m:1', options, ...menu } as never }],
  });
  const errorsOf = (template: MessageTemplate) => validateTemplate(template, variables);

  it('aceita menu com todos os campos novos válidos', () => {
    expect(codes(menuWith({ minValues: 0, maxValues: 2, component: 1 }, [
      { label: 'a', value: 'a', default: true, componentOption: 'abc123', emoji: { name: '😀' } },
      { label: 'b', value: 'b', default: false, emoji: { id: SNOWFLAKE, name: 'bot_logo', animated: true } },
    ]))).toEqual([]);
  });

  it('aceita minValues e maxValues nos limites 0..25 e 1..25', () => {
    const many = Array.from({ length: 25 }, (_, index) => ({ label: `o${index}`, value: `v${index}` }));
    expect(codes(menuWith({ minValues: 0, maxValues: 25 }, many))).toEqual([]);
    expect(codes(menuWith({ minValues: 25, maxValues: 25 }, many))).toEqual([]);
  });

  it('rejeita minValues e maxValues fora da faixa ou não inteiros, no path do campo', () => {
    for (const minValues of [-1, 26, 1.5, '1']) {
      const errors = errorsOf(menuWith({ minValues }));
      expect(errors.map((error) => error.code), String(minValues)).toEqual(['invalid_action']);
      expect(errors[0]?.path).toBe('components[0].menu.minValues');
    }
    for (const maxValues of [0, 26, 1.5, '2']) {
      const errors = errorsOf(menuWith({ maxValues }));
      expect(errors.map((error) => error.code), String(maxValues)).toEqual(['invalid_action']);
      expect(errors[0]?.path).toBe('components[0].menu.maxValues');
    }
  });

  it('exige minValues <= maxValues', () => {
    const errors = errorsOf(menuWith({ minValues: 2, maxValues: 1 }));
    expect(errors.map((error) => error.code)).toEqual(['invalid_action']);
    expect(errors[0]?.path).toBe('components[0].menu.minValues');
    expect(codes(menuWith({ minValues: 2, maxValues: 2 }))).toEqual([]);
  });

  it('exige maxValues <= número de opções quando definido', () => {
    const errors = errorsOf(menuWith({ maxValues: 3 }));
    expect(errors.map((error) => error.code)).toEqual(['invalid_action']);
    expect(errors[0]?.path).toBe('components[0].menu.maxValues');
    expect(codes(menuWith({ maxValues: 2 }))).toEqual([]);
  });

  it('component do menu: inteiro positivo, senão invalid_action no path do campo', () => {
    expect(codes(menuWith({ component: 7 }))).toEqual([]);
    for (const bad of [0, -1, 1.5, '3']) {
      const errors = errorsOf(menuWith({ component: bad }));
      expect(errors.map((error) => error.code), String(bad)).toEqual(['invalid_action']);
      expect(errors[0]?.path).toBe('components[0].menu.component');
      expect(errors[0]?.message).toBe('O componente precisa ser um número inteiro positivo.');
    }
  });

  it('emoji de opção segue as mesmas regras do emoji de botão', () => {
    expect(codes(menuWith({}, [
      { label: 'a', value: 'a', emoji: { name: '😀' } },
      { label: 'b', value: 'b', emoji: { id: SNOWFLAKE, name: 'bot_logo', animated: true } },
    ]))).toEqual([]);
    const invalid: Array<Record<string, unknown>> = [
      { id: '12345', name: 'bot_logo' },
      { name: '' },
      { name: '{user.name}' },
      { name: '😀', animated: true },
      { name: '😀', role: 'extra' },
    ];
    for (const emoji of invalid) {
      const errors = errorsOf(menuWith({}, [{ label: 'a', value: 'a', emoji }, { label: 'b', value: 'b' }]));
      expect(errors.map((error) => error.code), JSON.stringify(emoji)).toEqual(['invalid_emoji']);
      expect(errors[0]?.path).toBe('components[0].menu.options[0].emoji');
    }
  });

  it('default precisa ser booleano e caber em maxValues (ou 1, sem maxValues)', () => {
    const bothDefault = [{ label: 'a', value: 'a', default: true }, { label: 'b', value: 'b', default: true }];
    expect(codes(menuWith({ maxValues: 2 }, bothDefault))).toEqual([]);
    expect(codes(menuWith({}, [{ label: 'a', value: 'a', default: true }, { label: 'b', value: 'b' }]))).toEqual([]);
    expect(codes(menuWith({}, bothDefault))).toEqual(['invalid_action']);
    expect(codes(menuWith({ maxValues: 1 }, bothDefault))).toEqual(['invalid_action']);
    const notBoolean = errorsOf(menuWith({}, [{ label: 'a', value: 'a', default: 'sim' }, { label: 'b', value: 'b' }]));
    expect(notBoolean.map((error) => error.code)).toEqual(['invalid_action']);
    expect(notBoolean[0]?.path).toBe('components[0].menu.options[0].default');
  });

  it('componentOption exige menu.component e chave no formato ^[a-z0-9]{6,12}$', () => {
    const withKey = (key: unknown, component?: number) => menuWith(
      component === undefined ? {} : { component },
      [{ label: 'a', value: 'a', componentOption: key }, { label: 'b', value: 'b' }],
    );
    expect(codes(withKey('abc123', 1))).toEqual([]);
    expect(codes(withKey('abcdefghijkl', 1))).toEqual([]);

    const semComponent = errorsOf(withKey('abc123'));
    expect(semComponent.map((error) => error.code)).toEqual(['invalid_action']);
    expect(semComponent[0]?.message).toBe('Escolha a ação do menu antes de vincular a opção.');
    expect(semComponent[0]?.path).toBe('components[0].menu.options[0].componentOption');

    for (const bad of ['abc12', 'abcdefghijklm', 'ABC123', 'abc-12', '{user.name}', 42]) {
      const errors = errorsOf(withKey(bad, 1));
      expect(errors.map((error) => error.code), String(bad)).toEqual(['invalid_action']);
      expect(errors[0]?.path).toBe('components[0].menu.options[0].componentOption');
    }
  });

  it('componentOption e action na mesma opção são recusados', () => {
    const errors = errorsOf(menuWith({ component: 1 }, [
      { label: 'a', value: 'a', componentOption: 'abc123', action: { type: 'delete' } },
      { label: 'b', value: 'b' },
    ]));
    expect(errors.map((error) => error.code)).toEqual(['invalid_action']);
    expect(errors[0]?.path).toBe('components[0].menu.options[0].componentOption');
  });

  it('rejeita valores de opção repetidos, com mensagem própria', () => {
    const errors = errorsOf(menuWith({}, [{ label: 'a', value: 'x' }, { label: 'b', value: 'x' }]));
    expect(errors.map((error) => error.code)).toEqual(['invalid_action']);
    expect(errors[0]?.message).toBe('Duas opções têm o mesmo valor.');
    expect(errors[0]?.path).toBe('components[0].menu.options[1].value');
  });

  it('variáveis não se aplicam a value, componentOption, emoji nem component', () => {
    expect(codes(menuWith({}, [{ label: 'a', value: '{user.name}' }, { label: 'b', value: 'b' }]))).toEqual(['variable_not_allowed']);
    expect(codes(menuWith({ component: 1 }, [{ label: 'a', value: 'a', componentOption: '{user.name}' }, { label: 'b', value: 'b' }]))).toEqual(['invalid_action']);
    expect(codes(menuWith({}, [{ label: 'a', value: 'a', emoji: { name: '{user.name}' } }, { label: 'b', value: 'b' }]))).toEqual(['invalid_emoji']);
    expect(codes(menuWith({ component: '{user.name}' }))).toEqual(['invalid_action']);
  });

  it('regressão: menu legado (só customId, options e action) segue válido; uma ação por menu continua', () => {
    expect(codes(valid)).toEqual([]);
    expect(codes(menuWith({}, [{ label: 'a', value: 'a', action: { type: 'reply', template: 'oi' } }, { label: 'b', value: 'b' }]))).toEqual([]);
    expect(codes(menuWith({}, [
      { label: 'a', value: 'a', action: { type: 'reply', template: 'oi' } },
      { label: 'b', value: 'b', action: { type: 'delete' } },
    ]))).toEqual(['invalid_action']);
  });

  it('renderTemplate devolve os campos novos intactos e não preenche variáveis neles', () => {
    const template = menuWith({ minValues: 1, maxValues: 2, component: 9 }, [
      { label: 'a', value: 'a', default: true, componentOption: 'abc123', emoji: { id: SNOWFLAKE, name: 'bot_logo' } },
      { label: 'b', value: 'b' },
    ]);
    expect(codes(template)).toEqual([]);
    expect(renderTemplate(template, variables, { 'user.name': 'Ana' }).components[0]).toEqual(template.components[0]);

    const unsafe = {
      embeds: [],
      components: [{ kind: 'select', menu: { customId: 'kt:m:1', options: [{ label: 'a', value: '{user.name}', componentOption: '{user.name}', emoji: { name: '{user.name}' } }] } }],
    } as unknown as MessageTemplate;
    const rendered = renderTemplate(unsafe, variables, { 'user.name': 'Ana' }).components[0];
    const option = rendered?.kind === 'select' ? rendered.menu.options[0] : undefined;
    expect(option).toEqual({ label: 'a', value: '{user.name}', componentOption: '{user.name}', emoji: { name: '{user.name}' } });
  });
});

describe('checkGuildQuota', () => {
  it('refuses the 101st template', () => {
    expect(checkGuildQuota({ templates: 99, buttons: 0, menus: 0 })).toBeNull();
    expect(checkGuildQuota({ templates: 100, buttons: 0, menus: 0 })?.code).toBe('quota_exceeded');
  });

  it('counts buttons and menus separately', () => {
    const usage = { templates: 1, buttons: 50, menus: 0 };
    expect(checkGuildQuota(usage, undefined, { buttons: 0, menus: 1 })).toBeNull();
    expect(checkGuildQuota(usage, undefined, { buttons: 1, menus: 0 })?.path).toBe('buttons');
    expect(checkGuildQuota({ templates: 1, buttons: 0, menus: 50 }, undefined, { buttons: 1, menus: 0 })).toBeNull();
    expect(checkGuildQuota({ templates: 1, buttons: 0, menus: 50 }, undefined, { buttons: 0, menus: 1 })?.path).toBe('menus');
  });

  it('accepts injected limits', () => {
    expect(checkGuildQuota({ templates: 2, buttons: 0, menus: 0 }, { maxTemplates: 2, maxButtons: 1, maxSelectMenus: 1 })?.code).toBe('quota_exceeded');
  });

  it('does not refuse by template count on edit (isNewTemplate = false)', () => {
    const atLimit = { templates: 100, buttons: 0, menus: 0 };
    expect(checkGuildQuota(atLimit, undefined, { buttons: 0, menus: 0 }, false)).toBeNull();
    expect(checkGuildQuota(atLimit, undefined, { buttons: 0, menus: 0 }, true)?.code).toBe('quota_exceeded');
  });

  it('still refuses by button and menu limits on edit', () => {
    const atLimit = { templates: 100, buttons: 50, menus: 50 };
    expect(checkGuildQuota(atLimit, undefined, { buttons: 1, menus: 0 }, false)?.path).toBe('buttons');
    expect(checkGuildQuota(atLimit, undefined, { buttons: 0, menus: 1 }, false)?.path).toBe('menus');
  });
});

describe('renderTemplate', () => {
  it('replaces variables and keeps plain text intact', () => {
    const output = renderTemplate(valid, variables, { 'user.name': 'Ana', 'server.name': 'Casa' });
    expect(output.content).toBe('Olá Ana!');
    expect(output.embeds[0]?.title).toBe('Bem-vindo a Casa');
    expect(output.embeds[0]?.description).toBe('Texto sem variável.');
    expect(output.embeds[0]?.url).toBe('https://example.com/a');
  });

  it('escapes markdown and neutralizes mentions', () => {
    const render = (value: string) => renderTemplate({ content: '{user.name}', embeds: [], components: [] }, variables, { 'user.name': value }).content ?? '';
    expect(render('**x**')).toBe('\\*\\*x\\*\\*');
    expect(render('`c`')).toBe('\\`c\\`');
    expect(render('@everyone @here')).not.toMatch(/@(everyone|here)/u);
    expect(render('<@123> <#1> <&2>')).not.toMatch(/<[@#&]/u);
  });

  it('truncates values at maxLength and never splits an escape', () => {
    const output = renderTemplate({ content: '{user.name}', embeds: [], components: [] }, variables, { 'user.name': '*'.repeat(100) }).content ?? '';
    expect(output.length).toBeLessThanOrEqual(32);
    expect(output.endsWith('\\')).toBe(false);
    expect(escapeUserValue('a'.repeat(50), 32)).toHaveLength(32);
  });

  it('does not evaluate or look up inherited properties', () => {
    const output = renderTemplate({ content: '{constructor}', embeds: [], components: [] }, variables, {});
    expect(output.content).toBe('{constructor}');
    expect(extractVariables('{a.b()} {x.y}').map((token) => token.key)).toEqual([null, 'x.y']);
  });

  it('missing value becomes empty text and stays under Discord limits', () => {
    const output = renderTemplate({ content: 'a{user.name}b', embeds: [], components: [] }, variables, {});
    expect(output.content).toBe('ab');
  });
});

describe('architecture', () => {
  it('keeps message-templates free of forbidden imports', () => {
    const directory = join(import.meta.dirname, '../packages/message-templates');
    const files = readdirSync(directory).filter((file) => file.endsWith('.js'));
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const source = readFileSync(join(directory, file), 'utf8');
      expect(source, file).not.toMatch(/from\s+['"]discord\.js['"]/u);
      expect(source, file).not.toMatch(/from\s+['"][^'"]*(command-system|infrastructure|commands)[^'"]*['"]/u);
    }
  });
});

describe('whenAbsent e format', () => {
  const msg = (text: string): MessageTemplate => ({ content: text, embeds: [], components: [] });
  const render = (vars: TemplateVariable[], values: Record<string, string>) =>
    renderTemplate(msg('{v}'), vars, values).content;

  it('whenAbsent entra quando a variável não é fornecida', () => {
    expect(render([{ name: 'v', maxLength: 50, whenAbsent: 'Membro' }], {})).toBe('Membro');
  });

  it('whenAbsent entra quando o valor fica vazio após a limpeza, sem escape', () => {
    expect(render([{ name: 'v', maxLength: 50, whenAbsent: '*Nenhum*' }], { v: '' })).toBe('*Nenhum*');
    expect(render([{ name: 'v', maxLength: 50, whenAbsent: 'x' }], { v: 'a' })).toBe('a');
  });

  describe("format 'code'", () => {
    const code: TemplateVariable = { name: 'v', maxLength: 300, whenAbsent: 'Motivo', format: 'code' };

    it('tira crases, junta espaços, faz trim e envolve em crase', () => {
      expect(render([code], { v: '  a`b \n\t  c  ' })).toBe('`ab c`');
    });

    it('corta em 200 caracteres', () => {
      expect(render([code], { v: 'x'.repeat(250) })).toBe(`\`${'x'.repeat(200)}\``);
    });

    it('usa o fallback envolto em crase quando vazio ou ausente', () => {
      expect(render([code], { v: ' ``  ' })).toBe('`Motivo`');
      expect(render([code], {})).toBe('`Motivo`');
    });

    it('não escapa Markdown nem neutraliza menções', () => {
      expect(render([code], { v: 'a*b_c' })).toBe('`a*b_c`');
      expect(render([code], { v: '@everyone' })).toBe('`@everyone`');
    });
  });
});

describe('color', () => {
  const withColor = (color: number): MessageTemplate => ({ embeds: [{ description: 'x', color }], components: [] });

  it('aceita 0x2b2d31 e preserva na renderização', () => {
    expect(codes(withColor(0x2b2d31))).toEqual([]);
    expect(renderTemplate(withColor(0x2b2d31), [], {}).embeds[0]?.color).toBe(0x2b2d31);
  });

  it('rejeita fora da faixa e não inteiro', () => {
    for (const color of [-1, 0x1000000, 1.5]) expect(codes(withColor(color))).toEqual(['invalid_color']);
  });
});

describe('fillEmojis', () => {
  const tpl = (content: string): MessageTemplate => ({ content, embeds: [], components: [] });

  it('substitui o token sem escapar o emoji', () => {
    expect(fillEmojis(tpl('{emoji.id} Olá'), { id: '<:ID:123>' }).content).toBe('<:ID:123> Olá');
  });

  it('valor vazio remove o token e um espaço vizinho', () => {
    expect(fillEmojis(tpl('A {emoji.x} B'), { x: '' }).content).toBe('A B');
    expect(fillEmojis(tpl('{emoji.x} B'), { x: '' }).content).toBe('B');
    expect(fillEmojis(tpl('A {emoji.x}'), { x: '' }).content).toBe('A');
  });

  it('alias ausente vira unknown_emoji', () => {
    expect(() => fillEmojis(tpl('{emoji.nope}'), {})).toThrowError(expect.objectContaining({ code: 'unknown_emoji' }));
  });

  it('valor de usuário com {emoji.x} não é reinterpretado', () => {
    const vars: TemplateVariable[] = [{ name: 'user.name', maxLength: 50 }];
    const filled = fillEmojis(tpl('{emoji.x} {user.name}'), { x: 'E' });
    expect(renderTemplate(filled, vars, { 'user.name': '{emoji.x}' }).content).toBe('E {emoji.x}');
  });
});

describe('catálogo de mensagens', () => {
  it('tem estrutura válida e cada entrada passa em validateTemplate', () => {
    expect(Object.isFrozen(MESSAGE_CATALOG)).toBe(true);
    for (const [key, entry] of Object.entries<MessageCatalogEntry>(MESSAGE_CATALOG)) {
      const emojis = Object.fromEntries(Object.keys(entry.emojis).map((alias) => [alias, '<:E:123456789012345678>']));
      expect(entry.emojis, key).toBeTypeOf('object');
      expect(validateTemplate(fillEmojis(entry.template, emojis), entry.variables), key).toEqual([]);
    }
  });
});
