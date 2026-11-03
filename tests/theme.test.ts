import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { nextThemePreference, parseThemePreference, resolveTheme, themeLabels, themeStorageKey } from '../apps/site/src/lib/theme.js';

describe('theme preference', () => {
  it.each([
    ['light', 'light'],
    ['dark', 'dark'],
    ['system', 'system'],
    [null, 'system'],
    ['', 'system'],
    ['DARK', 'system'],
    ['<script>', 'system'],
  ])('reads the stored value %s as %s', (stored, expected) => {
    expect(parseThemePreference(stored)).toBe(expected);
  });

  it('cycles system, light, dark and back to system', () => {
    expect(nextThemePreference('system')).toBe('light');
    expect(nextThemePreference('light')).toBe('dark');
    expect(nextThemePreference('dark')).toBe('system');
  });

  it('follows the system only while there is no manual choice', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
  });

  it('names every state for assistive technology', () => {
    expect(themeLabels).toEqual({ system: 'Tema: do sistema', light: 'Tema: claro', dark: 'Tema: escuro' });
  });
});

describe('pre-paint theme script and stylesheet', () => {
  it('uses the same storage key as the app and only trusts light or dark', async () => {
    const script = await readFile(new URL('../apps/site/public/theme-init.js', import.meta.url), 'utf8');
    expect(script).toContain(`'${themeStorageKey}'`);
    expect(script).toContain("stored === 'light' || stored === 'dark'");
  });

  it('keeps the system block and the manual block with the same dark values and light-only component rules out', async () => {
    const css = await readFile(new URL('../apps/site/src/app/globals.css', import.meta.url), 'utf8');
    const block = (start: string): string => {
      const from = css.indexOf(start);
      return css.slice(css.indexOf('{', from) + 1, css.indexOf('}', from)).replace(/\s+/gu, ' ').trim();
    };
    expect(block(':root:not([data-theme="light"])')).toBe(block(':root[data-theme="dark"]'));
    // Todo token claro do @theme tem valor escuro: nenhum fica sem par.
    const light = [...css.slice(0, css.indexOf('/* Tema:')).matchAll(/--color-[a-z-]+(?=:)/gu)].map((match) => match[0]);
    const dark = block(':root[data-theme="dark"]');
    for (const token of light) expect(dark, token).toContain(`${token}:`);
    expect(css).toContain('filter: var(--icon-filter)');
    expect(css).not.toMatch(/\[data-theme="light"\][^{]*img/u);
  });
});
