import { describe, expect, it } from 'vitest';
import {
  ACTION_VARIABLES,
  buildActionValues,
  renderTemplate,
  renderText,
  validateTemplate,
  type MessageTemplate,
} from '@kuruttina/message-templates';

const template = (content: string): MessageTemplate => ({ content, embeds: [], components: [] });
const render = (content: string, values: Record<string, string>) =>
  renderTemplate(template(content), ACTION_VARIABLES, values).content;

const user = { id: '123456789012345678', name: 'Ku*ru', avatarUrl: 'https://cdn.discordapp.com/avatars/1/a.png' };
const guild = { id: '987654321098765432', name: 'Casa', iconUrl: null, bannerUrl: 'https://cdn.discordapp.com/banners/1/b.png', memberCount: 42 };

describe('action variables', () => {
  it('declares every variable of the shared list with valid, unique names', () => {
    const names = ACTION_VARIABLES.map((variable) => variable.name);
    expect(names).toEqual([
      'user.id', 'user.name', 'user.mention', 'user.avatar',
      'guild.id', 'guild.name', 'guild.avatar', 'guild.banner', 'guild.membercount', 'nowtimestamp',
    ]);
    expect(new Set(names).size).toBe(names.length);
    for (const variable of ACTION_VARIABLES) expect(variable.name).toMatch(/^[a-z]+(\.[a-z]+)*$/u);
  });

  it('validates a template that uses them in text', () => {
    const text = ACTION_VARIABLES.map((variable) => `{${variable.name}}`).join(' ');
    expect(validateTemplate(template(text), ACTION_VARIABLES)).toEqual([]);
  });

  it('fills user and guild values, escaping free text but keeping the mention', () => {
    const values = buildActionValues({ user, guild, now: new Date(1_761_782_400_000) });
    expect(render('{user.name} {user.mention} {user.id}', values)).toBe('Ku\\*ru <@123456789012345678> 123456789012345678');
    expect(render('{guild.name} {guild.membercount} {guild.banner}', values)).toBe('Casa 42 https://cdn.discordapp.com/banners/1/b.png');
    expect(render('{nowtimestamp}', values)).toBe('<t:1761782400:f>');
  });

  it('neutralizes mentions inside free-text names', () => {
    const values = buildActionValues({ user: { id: '1', name: '@everyone <@&5>' }, guild: { id: '1', name: '@here' } });
    expect(render('{user.name} {guild.name}', values)).not.toMatch(/@everyone|@here|<@&/u);
  });

  it('renders missing values as empty text', () => {
    const values = buildActionValues({ guild, now: new Date(0) });
    expect(render('[{user.name}][{user.mention}][{guild.avatar}]', values)).toBe('[][][]');
  });

  it('drops values outside the expected format', () => {
    const values = buildActionValues({
      user: { id: '12<@1>', name: 'x', avatarUrl: 'http://evil.example/a.png' },
      guild: { id: '1', name: 'g', iconUrl: 'https://cdn.discordapp.com/x y', bannerUrl: 'https://cdn.discordapp.com/@everyone', memberCount: -1 },
    });
    expect(buildActionValues({ guild: { id: '1', name: 'g', iconUrl: 'https://evil.example/a.png' } })).not.toHaveProperty('guild.avatar');
    expect(values).not.toHaveProperty('guild.banner');
    expect(values).not.toHaveProperty('user.id');
    expect(values).not.toHaveProperty('user.mention');
    expect(values).not.toHaveProperty('user.avatar');
    expect(values).not.toHaveProperty('guild.avatar');
    expect(values).not.toHaveProperty('guild.membercount');
  });

  it('never lets a raw value exceed its declared size', () => {
    expect(render('{user.id}', { 'user.id': '1'.repeat(21) })).toBe('');
  });

  it('fills a loose text like a template and leaves a missing banner empty', () => {
    const values = buildActionValues({ guild: { id: '1', name: 'Casa', bannerUrl: null } });
    expect(renderText('{guild.name}[{guild.banner}] {nope}', ACTION_VARIABLES, values)).toBe('Casa[] {nope}');
  });

  it('accepts image variables only alone in image fields', () => {
    const embed = (extra: object) => validateTemplate({ embeds: [{ title: 'x', ...extra }], components: [] }, ACTION_VARIABLES).map((error) => error.code);
    expect(embed({ thumbnail: { url: '{user.avatar}' }, image: { url: '{guild.banner}' }, author: { name: 'a', iconUrl: '{guild.avatar}' }, footer: { text: 'f', iconUrl: '{user.avatar}' } })).toEqual([]);
    expect(embed({ thumbnail: { url: '{user.name}' } })).toContain('variable_not_allowed');
    expect(embed({ thumbnail: { url: 'https://cdn.discordapp.com/{user.avatar}' } })).toContain('variable_not_allowed');
    expect(embed({ url: '{user.avatar}' })).toContain('variable_not_allowed');
    expect(embed({ author: { name: 'a', url: '{user.avatar}' } })).toContain('variable_not_allowed');
  });

  it('renders image variables into the image fields and drops the ones without value', () => {
    const values = buildActionValues({ user, guild });
    const out = renderTemplate({ embeds: [{ title: 'x', thumbnail: { url: '{user.avatar}' }, image: { url: '{guild.banner}' }, author: { name: 'a', iconUrl: '{guild.avatar}' } }], components: [] }, ACTION_VARIABLES, values);
    expect(out.embeds[0]?.thumbnail).toEqual({ url: user.avatarUrl });
    expect(out.embeds[0]?.image).toEqual({ url: guild.bannerUrl });
    expect(out.embeds[0]?.author).toEqual({ name: 'a' });
    const onlyImage = renderTemplate({ embeds: [{ image: { url: '{guild.banner}' } }], components: [] }, ACTION_VARIABLES, buildActionValues({ guild: { id: '1', name: 'g' } }));
    expect(onlyImage.embeds).toEqual([]);
  });
});
