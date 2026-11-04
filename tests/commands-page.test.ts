import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { ALL_TOPICS, commandCount, filterCommandGroups, publicTopics } from '../apps/site/src/components/commands/command-search.js';
import { splitExample } from '../apps/site/src/lib/command-example.js';
import { navigation } from '../apps/site/src/lib/site-navigation.js';
import { wheelPosition } from '../apps/site/src/lib/wheel.js';

const read = (path: string): Promise<string> => readFile(new URL(`../apps/site/src/${path}`, import.meta.url), 'utf8');

describe('command example', () => {
  it('highlights only the command name and keeps the rest as typed', () => {
    expect(splitExample('/ban membro:@Fulano motivo:Spam', '/ban')).toEqual({ name: '/ban', rest: ' membro:@Fulano motivo:Spam' });
    expect(splitExample('/emoji add nome:meu_emoji', '/emoji add')).toEqual({ name: '/emoji add', rest: ' nome:meu_emoji' });
    expect(splitExample('k!help', 'k!help')).toEqual({ name: 'k!help', rest: '' });
  });

  it('does not invent a highlight when the example does not start with the name', () => {
    expect(splitExample('outro texto', '/ban')).toEqual({ name: '', rest: 'outro texto' });
  });
});

describe('topic counts', () => {
  it('counts every public command under "all" and the same total across the public topics', () => {
    const total = commandCount(ALL_TOPICS);
    expect(total).toBeGreaterThan(0);
    expect(publicTopics.reduce((sum, topic) => sum + commandCount(topic.id), 0)).toBe(total);
  });

  it('never counts the internal topic, and the filter agrees with the counts', () => {
    expect(commandCount('dev')).toBe(0);
    const shown = filterCommandGroups('', ALL_TOPICS).reduce((sum, group) => sum + group.commands.length, 0);
    expect(shown).toBe(commandCount(ALL_TOPICS));
    expect(filterCommandGroups('', ALL_TOPICS).some((group) => group.topic.id === 'dev')).toBe(false);
  });
});

describe('wheel menu', () => {
  it('puts the first item at the top and spreads the others clockwise at the same angle', () => {
    expect(wheelPosition(0, 6)).toEqual({ left: '50%', top: '18.6%' });
    expect(wheelPosition(3, 6)).toEqual({ left: '50%', top: '81.4%' });
    const one = wheelPosition(1, 6);
    const five = wheelPosition(5, 6);
    expect(parseFloat(one.left) + parseFloat(five.left)).toBeCloseTo(100, 1);
    expect(parseFloat(one.top)).toBeCloseTo(parseFloat(five.top), 1);
  });

  it('keeps every item inside the disc', () => {
    for (let index = 0; index < 6; index += 1) {
      const { left, top } = wheelPosition(index, 6);
      for (const value of [parseFloat(left), parseFloat(top)]) {
        expect(value).toBeGreaterThan(10);
        expect(value).toBeLessThan(90);
      }
    }
  });

  it('shares the main links with the desktop bar and keeps the terms as a notice', () => {
    expect(navigation.map((item) => item.label)).toEqual(['Comandos', 'Módulos', 'Termos de serviço', 'Painel de controle']);
    expect(navigation.filter((item) => 'notice' in item).map((item) => item.label)).toEqual(['Termos de serviço']);
  });
});

describe('commands page styles and markup', () => {
  it('stops the rain for people who prefer less motion', async () => {
    const css = await read('app/globals.css');
    const block = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce) {\n  .matrix-column'));
    expect(block).toContain('animation: none');
  });

  it('has the terminal tokens and every topic gradient in both themes', async () => {
    const css = await read('app/globals.css');
    for (const token of ['terminal', 'terminal-bar', 'terminal-border', 'terminal-accent', 'topic-all-from', 'topic-mod-to', 'topic-utility-from', 'topic-fun-to', 'topic-public-from']) {
      expect(css.match(new RegExp(`--color-${token}:`, 'gu'))?.length, token).toBe(3);
    }
  });

  it('draws the rain without randomness at render time', async () => {
    const source = await read('components/commands/MatrixRain.tsx');
    expect(source).not.toContain('Math.random');
    expect(source).toContain('aria-hidden="true"');
  });

  it('keeps the scroll area reachable by keyboard and named', async () => {
    const page = await read('app/comandos/page.tsx');
    expect(page).toContain('tabIndex={0}');
    expect(page).toContain('aria-label="Lista de comandos"');
  });
});
