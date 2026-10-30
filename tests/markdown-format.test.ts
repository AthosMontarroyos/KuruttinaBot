import { describe, expect, it } from 'vitest';
import { activeFormats, applyFormat, parseInline } from '../apps/site/src/components/message-editor/markdown-format.js';

/** Aplica o formato na primeira ocorrência de `target` dentro de `value`. */
function format(value: string, target: string, kind: Parameters<typeof applyFormat>[3]) {
  const start = value.indexOf(target);
  return applyFormat(value, start, start + target.length, kind);
}

describe('applyFormat', () => {
  it.each([
    ['bold', '**'],
    ['italic', '*'],
    ['underline', '__'],
    ['strike', '~~'],
    ['code', '`'],
    ['spoiler', '||'],
  ] as const)('wraps the selection with %s', (kind, marker) => {
    const result = format('um texto aqui', 'texto', kind);
    expect(result.text).toBe(`um ${marker}texto${marker} aqui`);
    expect(result.text.slice(result.start, result.end)).toBe('texto');
  });

  it('keeps the markers touching the text, leaving edge spaces outside', () => {
    expect(format('a  texto  b', ' texto ', 'bold').text).toBe('a  **texto**  b');
  });

  it('does nothing for a whitespace-only selection', () => {
    expect(format('a   b', '   ', 'bold').text).toBe('a   b');
  });

  it('removes bold when the selection is inside it, even when only part is selected', () => {
    const result = format('um **texto grande** aqui', 'grande', 'bold');
    expect(result.text).toBe('um texto grande aqui');
    expect(result.text.slice(result.start, result.end)).toBe('grande');
  });

  it('removes bold when the selection includes the markers', () => {
    expect(format('um **texto** aqui', '**texto**', 'bold').text).toBe('um texto aqui');
  });

  it('adds italic inside bold without breaking the bold', () => {
    expect(format('um **texto** aqui', 'texto', 'italic').text).toBe('um ***texto*** aqui');
  });

  it('removes italic from inside bold without touching the bold', () => {
    expect(format('um ***texto*** aqui', 'texto', 'italic').text).toBe('um **texto** aqui');
  });

  it('removes bold from bold+italic and keeps the italic', () => {
    expect(format('um ***texto*** aqui', 'texto', 'bold').text).toBe('um *texto* aqui');
  });

  it('does not take bold markers for italic', () => {
    expect(activeFormats('**texto**', 2, 7)).toEqual(new Set(['bold']));
  });

  it('ignores markers inside inline code', () => {
    expect(activeFormats('`**a**`', 3, 4)).toEqual(new Set(['code']));
  });

  it('does not treat a bullet asterisk as italic', () => {
    expect(activeFormats('* item', 2, 6)).toEqual(new Set());
  });

  it('toggles a quote on every selected line', () => {
    const quoted = applyFormat('a\nb\nc', 0, 3, 'quote');
    expect(quoted.text).toBe('> a\n> b\nc');
    expect(applyFormat(quoted.text, quoted.start, quoted.end, 'quote').text).toBe('a\nb\nc');
  });
});

describe('activeFormats', () => {
  it('reports every format the selection sits in', () => {
    expect(activeFormats('~~**texto**~~', 4, 9)).toEqual(new Set(['bold', 'strike']));
  });

  it('reports nothing for plain text or a selection that leaves the markers', () => {
    expect(activeFormats('um **texto** aqui', 0, 2)).toEqual(new Set());
    expect(activeFormats('um **texto** aqui', 3, 14)).toEqual(new Set());
  });

  it('reports the quote when all selected lines are quoted', () => {
    expect(activeFormats('> a\n> b', 0, 7)).toEqual(new Set(['quote']));
  });
});

describe('parseInline', () => {
  const text = (value: string) => ({ type: 'text', text: value });
  const format = (kind: string, ...children: unknown[]) => ({ type: 'format', kind, children });

  it('reads italic nested inside bold', () => {
    expect(parseInline('um **texto *grand*e** aqui')).toEqual([
      text('um '),
      format('bold', text('texto '), format('italic', text('grand')), text('e')),
      text(' aqui'),
    ]);
  });

  it('reads bold+italic and every plain format', () => {
    expect(parseInline('***a***')).toEqual([format('bold', format('italic', text('a')))]);
    expect(parseInline('__a__ ~~b~~ ||c||')).toEqual([
      format('underline', text('a')), text(' '), format('strike', text('b')), text(' '), format('spoiler', text('c')),
    ]);
  });

  it('keeps unpaired or space-padded markers as plain text', () => {
    expect(parseInline('2 * 3 e **sem fim')).toEqual([text('2 * 3 e **sem fim')]);
    expect(parseInline('** texto **')).toEqual([text('** texto **')]);
  });

  it('does not parse markers inside code or links', () => {
    expect(parseInline('`**a**` e https://example.com/a_b__c.')).toEqual([
      { type: 'code', text: '**a**' },
      text(' e '),
      { type: 'link', href: 'https://example.com/a_b__c', label: 'https://example.com/a_b__c' },
      text('.'),
    ]);
    expect(parseInline('[site](https://example.com)')).toEqual([{ type: 'link', href: 'https://example.com', label: 'site' }]);
  });

  it('round-trips what applyFormat writes', () => {
    const written = applyFormat('um texto aqui', 3, 8, 'italic');
    expect(parseInline(written.text)).toEqual([text('um '), format('italic', text('texto')), text(' aqui')]);
  });
});

describe('combined formats', () => {
  type Node = ReturnType<typeof parseInline>[number];
  const plain = (nodes: Node[]): string => nodes.map((node) => {
    if (node.type === 'format') return plain(node.children);
    return node.type === 'link' ? node.label : node.text;
  }).join('');
  const text = (value: string) => ({ type: 'text', text: value });
  const format = (kind: string, ...children: unknown[]) => ({ type: 'format', kind, children });
  const kinds = ['bold', 'italic', 'underline', 'strike', 'spoiler'] as const;

  it('keeps italic outside and bold inside readable', () => {
    const italic = format2('um texto grande aqui', 'texto grande', 'italic');
    expect(italic.text).toBe('um *texto grande* aqui');
    const both = format2(italic.text, 'grande', 'bold');
    expect(both.text).toBe('um *texto **grande*** aqui');
    expect(parseInline(both.text)).toEqual([text('um '), format('italic', text('texto '), format('bold', text('grande'))), text(' aqui')]);
    expect(activeFormats(both.text, both.start, both.end)).toEqual(new Set(['bold', 'italic']));
  });

  it('keeps bold outside and italic inside readable', () => {
    const bold = format2('um texto grande aqui', 'texto grande', 'bold');
    const both = format2(bold.text, 'grande', 'italic');
    expect(both.text).toBe('um **texto *grande*** aqui');
    expect(parseInline(both.text)).toEqual([text('um '), format('bold', text('texto '), format('italic', text('grande'))), text(' aqui')]);
  });

  it('removes each of the two formats from the nested text, in either order', () => {
    const outerItalic = 'um *texto **grande*** aqui';
    expect(format2(outerItalic, 'grande', 'bold').text).toBe('um *texto grande* aqui');
    expect(format2(outerItalic, 'grande', 'italic').text).toBe('um texto **grande** aqui');
    const outerBold = 'um **texto *grande*** aqui';
    expect(format2(outerBold, 'grande', 'italic').text).toBe('um **texto grande** aqui');
    expect(format2(outerBold, 'grande', 'bold').text).toBe('um texto *grande* aqui');
  });

  it.each(kinds.flatMap((first) => kinds.filter((second) => second !== first).map((second) => [first, second] as const)))(
    'applies %s then %s to the same word without leaving stray markers, and undoes both',
    (first, second) => {
      const original = 'um texto aqui';
      const one = format2(original, 'texto', first);
      const two = format2(one.text, 'texto', second);
      expect(plain(parseInline(two.text))).toBe(original);
      expect(activeFormats(two.text, two.start, two.end)).toEqual(new Set([first, second]));
      const undoneOne = format2(two.text, 'texto', first);
      expect(plain(parseInline(undoneOne.text))).toBe(original);
      expect(format2(undoneOne.text, 'texto', second).text).toBe(original);
    },
  );

  it.each(kinds.flatMap((first) => kinds.filter((second) => second !== first).map((second) => [first, second] as const)))(
    'applies %s to a phrase and %s to a word inside it, and undoes both',
    (first, second) => {
      const original = 'um texto grande aqui';
      const phrase = format2(original, 'texto grande', first);
      const word = format2(phrase.text, 'grande', second);
      expect(plain(parseInline(word.text))).toBe(original);
      expect(activeFormats(word.text, word.start, word.end)).toEqual(new Set([first, second]));
      const withoutWord = format2(word.text, 'grande', second);
      expect(withoutWord.text).toBe(phrase.text);
      expect(format2(withoutWord.text, 'texto grande', first).text).toBe(original);
    },
  );

  /** Aplica o formato na ocorrência de `target`, como a barra faria com ela selecionada. */
  function format2(value: string, target: string, kind: Parameters<typeof applyFormat>[3]) {
    const start = value.indexOf(target);
    return applyFormat(value, start, start + target.length, kind);
  }
});

describe('selection that includes the markers', () => {
  const all = (value: string, kind: Parameters<typeof applyFormat>[3]) => applyFormat(value, 0, value.length, kind);

  it('reports both formats when ***a*** is selected whole', () => {
    expect(activeFormats('***fafa***', 0, 10)).toEqual(new Set(['bold', 'italic']));
    expect(activeFormats('**fafa**', 0, 8)).toEqual(new Set(['bold']));
  });

  it('removes only the chosen format from a whole ***a*** selection', () => {
    expect(all('***fafa***', 'italic').text).toBe('**fafa**');
    expect(all('***fafa***', 'bold').text).toBe('*fafa*');
  });

  it('adds italic to a whole **a** selection without doubling markers', () => {
    expect(all('**fafa**', 'italic').text).toBe('***fafa***');
    expect(all('*fafa*', 'bold').text).toBe('***fafa***');
  });

  it('toggles back and forth with the whole text selected', () => {
    let value = 'fafa';
    for (const kind of ['bold', 'italic', 'italic', 'bold'] as const) {
      const result = applyFormat(value, 0, value.length, kind);
      value = result.text;
      expect(value).not.toMatch(/\*{4,}/u);
    }
    expect(value).toBe('fafa');
  });

  it('keeps toggling when the selection keeps following the result', () => {
    let value = 'fafa';
    let start = 0;
    let end = 4;
    for (const kind of ['bold', 'italic', 'underline', 'italic', 'bold', 'underline'] as const) {
      const result = applyFormat(value, start, end, kind);
      ({ text: value, start, end } = result);
      expect(value).not.toMatch(/\*{4,}|_{4,}/u);
    }
    expect(value).toBe('fafa');
  });
});

describe('block prefixes and several lines', () => {
  const all = (value: string, kind: Parameters<typeof applyFormat>[3]) => applyFormat(value, 0, value.length, kind);

  it('keeps the quote prefix outside the markers', () => {
    expect(all('> fafa', 'bold').text).toBe('> **fafa**');
    expect(all('> **fafa**', 'bold').text).toBe('> fafa');
  });

  it('keeps list and heading prefixes outside the markers', () => {
    expect(all('- item', 'italic').text).toBe('- *item*');
    expect(all('# Titulo', 'bold').text).toBe('# **Titulo**');
    expect(all('1. passo', 'underline').text).toBe('1. __passo__');
  });

  it('reports the formats of a quoted line even when the selection starts at the quote mark', () => {
    expect(activeFormats('> ~~__***fafa***__~~', 0, 20)).toEqual(new Set(['bold', 'italic', 'underline', 'strike', 'quote']));
  });

  it('formats every selected line on its own, so no marker crosses a line break', () => {
    expect(all('um\ndois\n\ntres', 'bold').text).toBe('**um**\n**dois**\n\n**tres**');
    expect(all('> um\n> dois', 'italic').text).toBe('> *um*\n> *dois*');
  });

  it('removes the format from all lines when every line has it, and adds only where missing otherwise', () => {
    expect(all('**um**\n**dois**', 'bold').text).toBe('um\ndois');
    expect(all('**um**\ndois', 'bold').text).toBe('**um**\n**dois**');
  });

  it('keeps the selection over the result so the next click works', () => {
    const first = all('> um\n> dois', 'bold');
    const second = applyFormat(first.text, first.start, first.end, 'italic');
    expect(second.text).toBe('> ***um***\n> ***dois***');
    const third = applyFormat(second.text, second.start, second.end, 'quote');
    expect(third.text).toBe('***um***\n***dois***');
    expect(applyFormat(third.text, third.start, third.end, 'bold').text).toBe('*um*\n*dois*');
  });

  it('survives any order of quote and formats on the same selection', () => {
    let current = { text: 'fafa', start: 0, end: 4 };
    for (const kind of ['quote', 'bold', 'italic', 'quote', 'underline', 'strike', 'quote', 'italic', 'bold', 'quote'] as const) {
      current = applyFormat(current.text, current.start, current.end, kind);
      expect(current.text).not.toMatch(/\*{4,}|_{4,}|~{4,}|>\s*>/u);
      expect(current.text.split('\n').every((line) => !line.startsWith('*>') && !line.startsWith('_>'))).toBe(true);
    }
  });
});

describe('stale selections', () => {
  it('terminates when the selection is longer than the text (text shrank after an edit)', () => {
    expect(activeFormats('fafa', 0, 20)).toEqual(new Set());
    expect(activeFormats('> a\n> b', 3, 99).has('quote')).toBe(true);
    expect(applyFormat('fafa', 0, 40, 'bold').text).toBe('**fafa**');
    expect(applyFormat('a\nb', 10, 30, 'bold').text).toBe('a\nb');
    expect(activeFormats('', 0, 5)).toEqual(new Set());
  });

  it('terminates for collapsed and trailing-newline selections', () => {
    expect(activeFormats('fafa', 2, 2)).toEqual(new Set());
    expect(applyFormat('fafa\n', 0, 5, 'italic').text).toBe('*fafa*\n');
    expect(applyFormat('\n\n', 0, 2, 'bold').text).toBe('\n\n');
  });
});

describe('inline code combined with other formats', () => {
  type Kind = Parameters<typeof applyFormat>[3];
  const others = ['bold', 'italic', 'underline', 'strike', 'spoiler'] as const;
  const plain = (nodes: ReturnType<typeof parseInline>): string => nodes.map((node) => (node.type === 'format' ? plain(node.children) : node.type === 'link' ? node.label : node.text)).join('');
  const literalMarkers = (nodes: ReturnType<typeof parseInline>): boolean => nodes.some((node) => {
    if (node.type === 'format') return literalMarkers(node.children);
    return node.type !== 'link' && /\*\*|__|~~|\|\|/u.test(node.text);
  });
  const run = (start: string, kinds: Kind[]) => {
    let current = { text: start, start: 0, end: start.length };
    for (const kind of kinds) current = applyFormat(current.text, current.start, current.end, kind);
    return current;
  };

  it.each(others)('wraps %s around the code, never inside the backticks', (kind) => {
    const marker = { bold: '**', italic: '*', underline: '__', strike: '~~', spoiler: '||' }[kind];
    expect(run('fafa', ['code', kind]).text).toBe(`${marker}\`fafa\`${marker}`);
    expect(run('fafa', [kind, 'code']).text).toBe(`${marker}\`fafa\`${marker}`);
  });

  it.each(others)('reports code and %s together and undoes them in any order', (kind) => {
    const both = run('fafa', ['code', kind]);
    expect(activeFormats(both.text, both.start, both.end)).toEqual(new Set(['code', kind]));
    expect(plain(parseInline(both.text))).toBe('fafa');
    expect(literalMarkers(parseInline(both.text))).toBe(false);
    expect(applyFormat(both.text, both.start, both.end, 'code').text).toBe(run('fafa', [kind]).text);
    expect(applyFormat(both.text, both.start, both.end, kind).text).toBe('`fafa`');
  });

  it('puts the code inside the markers when the selection includes them', () => {
    expect(applyFormat('**fafa**', 0, 8, 'code').text).toBe('**`fafa`**');
  });

  it('survives a long mixed sequence ending clean', () => {
    const result = run('fafa', ['bold', 'italic', 'code', 'underline', 'strike', 'code', 'strike', 'underline', 'italic', 'bold']);
    expect(result.text).toBe('fafa');
  });

  it('uses double backticks when the selection already has a backtick', () => {
    const wrapped = applyFormat('a `b c', 0, 6, 'code');
    expect(wrapped.text).toBe('``a `b c``');
    expect(parseInline(wrapped.text)).toEqual([{ type: 'code', text: 'a `b c' }]);
    expect(activeFormats(wrapped.text, wrapped.start, wrapped.end)).toEqual(new Set(['code']));
    expect(applyFormat(wrapped.text, wrapped.start, wrapped.end, 'code').text).toBe('a `b c');
  });

  it('does not let an unclosed backtick hide the other formats', () => {
    expect(activeFormats('`a **b**', 5, 6)).toEqual(new Set(['bold']));
    expect(parseInline('`a **b**')).toEqual([
      { type: 'text', text: '`a ' },
      { type: 'format', kind: 'bold', children: [{ type: 'text', text: 'b' }] },
    ]);
  });

  it('reads code with markers inside literally', () => {
    expect(parseInline('`**a**` e ``x`y``')).toEqual([
      { type: 'code', text: '**a**' },
      { type: 'text', text: ' e ' },
      { type: 'code', text: 'x`y' },
    ]);
  });
});
