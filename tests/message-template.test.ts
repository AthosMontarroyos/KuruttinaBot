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

  it('validates custom_id format and size', () => {
    expect(codes(withButton({ kind: 'buttons', buttons: [{ style: 'primary', label: 'x', customId: 'abc' }] }))).toContain('invalid_custom_id');
    expect(codes(withButton({ kind: 'buttons', buttons: [{ style: 'primary', label: 'x', customId: `kt:a:${'b'.repeat(100)}` }] }))).toContain('invalid_custom_id');
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
