import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import {
  applySkinTone,
  buildCategories,
  searchEmojis,
  type RawEmoji,
} from '../apps/site/src/components/selectors/emoji-data.js';

/** Cinco tons no formato do pacote, do mais claro ao mais escuro. */
const tones = (unicodes: string[]): RawEmoji[] => unicodes.map((unicode, index) => ({ hexcode: `skin-${index + 1}`, label: `tom ${index + 1}`, unicode }));

const fixtures: RawEmoji[] = [
  { hexcode: '1F600', label: 'rosto sorrindo', unicode: '😀', group: 0, order: 1, tags: ['sorriso', 'feliz'] },
  { hexcode: '1F60E', label: 'rosto com óculos escuros', unicode: '😎', group: 0, order: 0, tags: ['legal'] },
  { hexcode: '1F44B', label: 'mão acenando', unicode: '👋', group: 1, order: 0, tags: ['aceno', 'oi'], skins: tones(['👋🏻', '👋🏼', '👋🏽', '👋🏾', '👋🏿']) },
  { hexcode: '1F431', label: 'gato', unicode: '🐱', group: 3, order: 300, tags: ['animal'] },
  { hexcode: '1F34E', label: 'maçã vermelha', unicode: '🍎', group: 4, order: 400, tags: ['fruta', 'maçã'] },
  { hexcode: '1F3E0', label: 'casa', unicode: '🏠', group: 5, order: 500 },
  { hexcode: '26BD', label: 'bola de futebol', unicode: '⚽', group: 6, order: 600, tags: ['esporte'] },
  { hexcode: '1F4A1', label: 'lâmpada', unicode: '💡', group: 7, order: 700, tags: ['ideia'] },
  { hexcode: '2764', label: 'coração vermelho', unicode: '❤️', group: 8, order: 800, tags: ['amor'] },
  { hexcode: '1F3C1', label: 'bandeira de chegada', unicode: '🏁', group: 9, order: 900 },
  { hexcode: '1F9E9', label: 'peça de quebra-cabeça', unicode: '🧩', group: 2, order: 1000 },
  { hexcode: '1F1E6', label: 'indicador regional A', unicode: '🇦' },
];

const CATEGORY_IDS = ['pessoas', 'natureza', 'comida', 'atividades', 'viagens', 'objetos', 'simbolos', 'bandeiras'];

describe('buildCategories', () => {
  it('monta as 8 categorias na ordem das abas do Discord', () => {
    const categories = buildCategories(fixtures);
    expect(categories.map((category) => category.id)).toEqual(CATEGORY_IDS);
    expect(categories.map((category) => category.label)).toEqual(['Pessoas', 'Natureza', 'Comida', 'Atividades', 'Viagens', 'Objetos', 'Símbolos', 'Bandeiras']);
  });

  it('junta os grupos 0 e 1 em Pessoas, com o grupo 0 antes mesmo que o 1 tenha order menor', () => {
    const pessoas = buildCategories(fixtures)[0];
    expect(pessoas?.emojis.map((emoji) => emoji.unicode)).toEqual(['😎', '😀', '👋']);
  });

  it('ignora o grupo 2 (componentes) e os itens sem grupo', () => {
    const everything = buildCategories(fixtures).flatMap((category) => category.emojis.map((emoji) => emoji.unicode));
    expect(everything).not.toContain('🧩');
    expect(everything).not.toContain('🇦');
    expect(everything).toHaveLength(10);
  });

  it('guarda tags, e skins só quando o item tem', () => {
    const categories = buildCategories(fixtures);
    const wave = categories[0]?.emojis.find((emoji) => emoji.unicode === '👋');
    const smile = categories[0]?.emojis.find((emoji) => emoji.unicode === '😀');
    expect(wave?.tags).toEqual(['aceno', 'oi']);
    expect(wave?.skins?.map((skin) => skin.unicode)).toEqual(['👋🏻', '👋🏼', '👋🏽', '👋🏾', '👋🏿']);
    expect(smile?.tags).toEqual(['sorriso', 'feliz']);
    expect(smile).not.toHaveProperty('skins');
  });
});

describe('searchEmojis', () => {
  const categories = buildCategories(fixtures);

  it('ignora maiúscula e acento, nos dois sentidos', () => {
    expect(searchEmojis(categories, 'MAÇÃ').map((emoji) => emoji.unicode)).toEqual(['🍎']);
    expect(searchEmojis(categories, 'maca').map((emoji) => emoji.unicode)).toEqual(['🍎']);
    expect(searchEmojis(categories, 'Lampada').map((emoji) => emoji.unicode)).toEqual(['💡']);
  });

  it('exige que todas as palavras casem', () => {
    expect(searchEmojis(categories, 'mão aceno').map((emoji) => emoji.unicode)).toEqual(['👋']);
    expect(searchEmojis(categories, 'vermelho coração').map((emoji) => emoji.unicode)).toEqual(['❤️']);
    expect(searchEmojis(categories, 'vermelho gato')).toEqual([]);
  });

  it('casa pelas tags também', () => {
    expect(searchEmojis(categories, 'fruta').map((emoji) => emoji.unicode)).toEqual(['🍎']);
    expect(searchEmojis(categories, 'ideia').map((emoji) => emoji.unicode)).toEqual(['💡']);
    expect(searchEmojis(categories, 'esporte').map((emoji) => emoji.unicode)).toEqual(['⚽']);
  });

  it('devolve lista vazia para busca em branco ou sem resultado, e não encontra emoji ignorado', () => {
    expect(searchEmojis(categories, '   ')).toEqual([]);
    expect(searchEmojis(categories, 'xyz')).toEqual([]);
    expect(searchEmojis(categories, 'quebra')).toEqual([]);
  });
});

describe('applySkinTone', () => {
  const wave = buildCategories(fixtures)[0]?.emojis.find((emoji) => emoji.unicode === '👋');

  it('tom 0 devolve o padrão', () => {
    expect(wave).toBeDefined();
    if (wave === undefined) return;
    expect(applySkinTone(wave, 0)).toBe('👋');
  });

  it('tons 1 a 5 seguem a ordem do pacote (1 é o mais claro)', () => {
    if (wave === undefined) throw new Error('fixture sem 👋');
    const shades: (1 | 2 | 3 | 4 | 5)[] = [1, 2, 3, 4, 5];
    expect(shades.map((tone) => applySkinTone(wave, tone))).toEqual(['👋🏻', '👋🏼', '👋🏽', '👋🏾', '👋🏿']);
  });

  it('emoji sem skins devolve o padrão em qualquer tom', () => {
    expect(applySkinTone({ unicode: '😀' }, 3)).toBe('😀');
  });
});

describe('dados reais (emojibase-data/pt)', () => {
  it('tem pelo menos 1500 emojis e nenhuma categoria vazia', () => {
    // Lê o JSON do pacote direto do disco: sem import estático de JSON em .ts (o tsconfig raiz não tem resolveJsonModule).
    const packageJson = createRequire(import.meta.url).resolve('emojibase-data/pt/compact.json');
    const raw = JSON.parse(readFileSync(packageJson, 'utf8')) as RawEmoji[];
    const categories = buildCategories(raw);
    expect(categories.map((category) => category.id)).toEqual(CATEGORY_IDS);
    for (const category of categories) {
      expect(category.emojis.length, category.label).toBeGreaterThan(0);
    }
    const total = categories.reduce((sum, category) => sum + category.emojis.length, 0);
    expect(total).toBeGreaterThanOrEqual(1500);
  });
});
