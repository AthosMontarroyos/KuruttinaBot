/** Formatação de texto estilo Discord (negrito, itálico, citação...) sobre a seleção de um campo de texto. Lógica pura, sem React. */

export type InlineFormat = 'bold' | 'italic' | 'underline' | 'strike' | 'code' | 'spoiler';
export type Format = InlineFormat | 'quote';
const WRAPPERS: Record<InlineFormat, string> = { bold: '**', italic: '*', underline: '__', strike: '~~', code: '`', spoiler: '||' };
const INLINE_FORMATS = Object.keys(WRAPPERS) as InlineFormat[];

/** Quantas crases seguidas começam em `at`. */
function backtickRun(text: string, at: number): number {
  let run = 0;
  while (text[at + run] === '`') run++;
  return run;
}

/** Onde fecha o trecho de código aberto em `at` com `run` crases (uma sequência com o mesmo tamanho); -1 se não fecha. */
function findCodeEnd(text: string, at: number, run: number): number {
  let search = at + run;
  while (search < text.length) {
    const next = text.indexOf('`', search);
    if (next === -1) return -1;
    const found = backtickRun(text, next);
    if (found === run && next > at + run) return next;
    search = next + found;
  }
  return -1;
}

type Range = { start: number; len: number };
type Pair = { open: Range; close: Range };

/** Lê os marcadores de uma linha e devolve, por formato, os pares abertura/fechamento, como o Discord os leria. */
function scanLine(line: string): Record<InlineFormat, Pair[]> {
  const pairs: Record<InlineFormat, Pair[]> = { bold: [], italic: [], underline: [], strike: [], code: [], spoiler: [] };
  const open: Partial<Record<InlineFormat, Range>> = {};
  const openedAt: Partial<Record<InlineFormat, number>> = {};
  let order = 0;
  const toggle = (kind: InlineFormat, opening: Range, closing: Range) => {
    const current = open[kind];
    if (current) {
      pairs[kind].push({ open: current, close: closing });
      delete open[kind];
    } else {
      open[kind] = opening;
      openedAt[kind] = order++;
    }
  };
  const double: [string, InlineFormat][] = [['**', 'bold'], ['__', 'underline'], ['~~', 'strike'], ['||', 'spoiler']];
  let i = 0;
  while (i < line.length) {
    const char = line[i];
    if (char === '`') {
      const run = backtickRun(line, i);
      const current = open.code;
      if (current) {
        if (run === current.len) {
          pairs.code.push({ open: current, close: { start: i, len: run } });
          delete open.code;
        }
      } else if (findCodeEnd(line, i, run) !== -1) {
        open.code = { start: i, len: run };
      }
      i += run;
      continue;
    }
    // Dentro de `código` os outros marcadores são texto comum.
    if (open.code) { i++; continue; }
    if (line.startsWith('***', i)) {
      // `***` junta os dois marcadores; quem foi aberto por último é o primeiro a fechar.
      const bold = open.bold;
      const italic = open.italic;
      let boldRange: Range = { start: i, len: 2 };
      let italicRange: Range = { start: i + 2, len: 1 };
      if (bold && italic) {
        const italicInner = (openedAt.italic ?? 0) > (openedAt.bold ?? 0);
        boldRange = italicInner ? { start: i + 1, len: 2 } : { start: i, len: 2 };
        italicRange = italicInner ? { start: i, len: 1 } : { start: i + 2, len: 1 };
      } else if (italic) {
        italicRange = { start: i, len: 1 };
        boldRange = { start: i + 1, len: 2 };
      } else if (bold) {
        boldRange = { start: i, len: 2 };
        italicRange = { start: i + 2, len: 1 };
      }
      toggle('bold', boldRange, boldRange);
      toggle('italic', italicRange, italicRange);
      i += 3;
      continue;
    }
    const match = double.find(([marker]) => line.startsWith(marker, i));
    if (match) {
      toggle(match[1], { start: i, len: 2 }, { start: i, len: 2 });
      i += 2;
    } else if (char === '*' && !(line[i + 1] === ' ' && line.slice(0, i).trim() === '')) {
      toggle('italic', { start: i, len: 1 }, { start: i, len: 1 });
      i++;
    } else {
      i++;
    }
  }
  return pairs;
}

function enclosingPair(pairs: Pair[], start: number, end: number): Pair | undefined {
  return pairs.find((pair) => start >= pair.open.start && end <= pair.close.start + pair.close.len);
}

/** Tira da seleção os marcadores das pontas: selecionar `***a***` inteiro vale o mesmo que selecionar só `a`. */
function withoutEdgeMarkers(pairs: Record<InlineFormat, Pair[]>, start: number, end: number): { start: number; end: number } {
  const ranges = INLINE_FORMATS.flatMap((kind) => pairs[kind].flatMap((pair) => [pair.open, pair.close]));
  const isMarker = (position: number) => ranges.some((range) => position >= range.start && position < range.start + range.len);
  let from = start;
  let to = end;
  while (from < to && isMarker(from)) from++;
  while (to > from && isMarker(to - 1)) to--;
  return from < to ? { start: from, end: to } : { start, end };
}

function lineBounds(value: string, start: number): { from: number; to: number } {
  const from = value.lastIndexOf('\n', start - 1) + 1;
  const found = value.indexOf('\n', from);
  return { from, to: found === -1 ? value.length : found };
}

// Prefixos de bloco do Discord: o formato em linha nunca entra neles.
const BLOCK_PREFIX = /^(?:> |-# |#{1,3} |[-*] |\d+\. )/u;

type Segment = { start: number; end: number };

/** Trechos da seleção, um por linha, sem o prefixo de bloco (`> `, `- `, `# `...) e sem linhas vazias. */
function segmentsOf(value: string, start: number, end: number): Segment[] {
  const segments: Segment[] = [];
  // A seleção guardada pode ser de antes de o texto encolher; nunca passa do fim.
  const limit = Math.min(end, value.length);
  let position = Math.min(start, limit);
  while (position <= limit) {
    const { from, to } = lineBounds(value, position);
    const prefix = BLOCK_PREFIX.exec(value.slice(from, to))?.[0].length ?? 0;
    const segmentStart = Math.max(position, from + prefix);
    const segmentEnd = Math.min(limit, to);
    if (segmentStart < segmentEnd) segments.push({ start: segmentStart, end: segmentEnd });
    position = to + 1;
  }
  return segments;
}

/** Par de marcadores do formato que envolve o trecho (e onde a linha começa), se houver. */
function pairAround(value: string, segment: Segment, format: InlineFormat): { pair: Pair; from: number } | undefined {
  const { from, to } = lineBounds(value, segment.start);
  const pairs = scanLine(value.slice(from, to));
  const inner = withoutEdgeMarkers(pairs, segment.start - from, segment.end - from);
  const pair = enclosingPair(pairs[format], inner.start, inner.end);
  return pair ? { pair, from } : undefined;
}

/** Formatos que já valem para a seleção (cada linha dela está dentro do par de marcadores, ou o inclui). */
export function activeFormats(value: string, start: number, end: number): Set<Format> {
  const active = new Set<Format>();
  const segments = segmentsOf(value, start, end);
  for (const kind of INLINE_FORMATS) {
    if (segments.length > 0 && segments.every((segment) => pairAround(value, segment, kind))) active.add(kind);
  }
  const { from } = lineBounds(value, start);
  const quoteTo = value.indexOf('\n', end);
  const lines = value.slice(from, quoteTo === -1 ? value.length : quoteTo).split('\n');
  if (lines.every((line) => line.startsWith('> '))) active.add('quote');
  return active;
}

type Edit = { text: string; start: number; end: number };

function unwrapSegment(value: string, around: { pair: Pair; from: number }, start: number, end: number): Edit {
  const openAt = around.from + around.pair.open.start;
  const closeAt = around.from + around.pair.close.start;
  const { open, close } = around.pair;
  const cut = (position: number, at: number, length: number) => Math.min(Math.max(position - at, 0), length);
  const shift = (position: number) => position - cut(position, openAt, open.len) - cut(position, closeAt, close.len);
  const text = value.slice(0, openAt) + value.slice(openAt + open.len, closeAt) + value.slice(closeAt + close.len);
  return { text, start: shift(start), end: shift(end) };
}

/** Onde o marcador entra: o formato envolve o `código` inteiro, e o código fica por dentro dos outros marcadores. */
function wrapTarget(value: string, segment: Segment, format: InlineFormat): Segment {
  const { from, to } = lineBounds(value, segment.start);
  const pairs = scanLine(value.slice(from, to));
  const relative = { start: segment.start - from, end: segment.end - from };
  if (format === 'code') {
    const inner = withoutEdgeMarkers(pairs, relative.start, relative.end);
    return { start: from + inner.start, end: from + inner.end };
  }
  const code = enclosingPair(pairs.code, relative.start, relative.end);
  return code ? { start: from + code.open.start, end: from + code.close.start + code.close.len } : segment;
}

function wrapSegment(value: string, start: number, end: number, format: InlineFormat): Edit {
  // O Discord só formata quando o marcador encosta no texto, então espaços das pontas ficam de fora.
  const selected = value.slice(start, end);
  // Com crase no meio do texto, o código usa duas crases para não fechar antes da hora.
  const marker = format === 'code' && selected.includes('`') ? '``' : WRAPPERS[format];
  const lead = selected.length - selected.trimStart().length;
  const trail = selected.length - selected.trimEnd().length;
  if (lead + trail >= selected.length) return { text: value, start, end };
  const innerStart = start + lead;
  const innerEnd = end - trail;
  return {
    text: value.slice(0, innerStart) + marker + value.slice(innerStart, innerEnd) + marker + value.slice(innerEnd),
    start: innerStart + marker.length,
    end: innerEnd + marker.length,
  };
}

/** Aplica ou remove a formatação na seleção; devolve o novo texto e a nova seleção. */
export function applyFormat(value: string, start: number, end: number, format: Format): Edit {
  if (format === 'quote') {
    const { from } = lineBounds(value, start);
    const found = value.indexOf('\n', end);
    const to = found === -1 ? value.length : found;
    const lines = value.slice(from, to).split('\n');
    const quoted = lines.every((line) => line.startsWith('> '));
    const block = lines.map((line) => (quoted ? line.slice(2) : `> ${line}`)).join('\n');
    return { text: value.slice(0, from) + block + value.slice(to), start: from, end: from + block.length };
  }
  // Cada linha selecionada é formatada à parte, sem o prefixo de bloco (`> `, `- `, `# `...).
  const segments = segmentsOf(value, start, end);
  if (segments.length === 0) return { text: value, start, end };
  const removing = segments.every((segment) => pairAround(value, segment, format));
  let text = value;
  let offset = 0;
  let first: number | undefined;
  let last = end;
  for (const segment of segments) {
    const from = segment.start + offset;
    const to = segment.end + offset;
    const around = pairAround(text, { start: from, end: to }, format);
    let result: Edit = { text, start: from, end: to };
    if (removing && around) result = unwrapSegment(text, around, from, to);
    else if (!removing && !around) {
      const target = wrapTarget(text, { start: from, end: to }, format);
      result = wrapSegment(text, target.start, target.end, format);
    }
    offset += result.text.length - text.length;
    text = result.text;
    first ??= result.start;
    last = result.end;
  }
  return { text, start: first ?? start, end: last };
}

export type FormatKind = Exclude<InlineFormat, 'code'>;
export type InlineNode =
  | { type: 'text'; text: string }
  | { type: 'code'; text: string }
  | { type: 'link'; href: string; label: string }
  | { type: 'format'; kind: FormatKind; children: InlineNode[] }
  | { type: 'mention'; kind: 'channel' | 'role' | 'user'; id: string }
  | { type: 'emoji'; id: string; name: string; animated: boolean };

const URL_AT = /https?:\/\/[^\s<]+/uy;
const MASKED_AT = /\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/uy;
const CHANNEL_AT = /<#(\d{17,20})>/uy;
const ROLE_AT = /<@&(\d{17,20})>/uy;
const USER_AT = /<@!?(\d{17,20})>/uy;
const EMOJI_AT = /<(a?):([A-Za-z0-9_]{2,32}):(\d{17,20})>/uy;
const TRAILING_PUNCTUATION = /[.,;:!?)]+$/u;
const WHITESPACE = /\s/u;

/** Menção ou emoji do Discord que começa em `at` (`<#id>`, `<@&id>`, `<@id>`, `<:nome:id>`); null se não for um deles. */
function tokenAt(value: string, at: number): { node: InlineNode; length: number } | null {
  CHANNEL_AT.lastIndex = at;
  const channel = CHANNEL_AT.exec(value);
  if (channel) return { node: { type: 'mention', kind: 'channel', id: channel[1] ?? '' }, length: channel[0].length };
  ROLE_AT.lastIndex = at;
  const role = ROLE_AT.exec(value);
  if (role) return { node: { type: 'mention', kind: 'role', id: role[1] ?? '' }, length: role[0].length };
  USER_AT.lastIndex = at;
  const user = USER_AT.exec(value);
  if (user) return { node: { type: 'mention', kind: 'user', id: user[1] ?? '' }, length: user[0].length };
  EMOJI_AT.lastIndex = at;
  const emoji = EMOJI_AT.exec(value);
  if (emoji) return { node: { type: 'emoji', id: emoji[3] ?? '', name: emoji[2] ?? '', animated: emoji[1] === 'a' }, length: emoji[0].length };
  return null;
}

type Frame = { kind: FormatKind | null; marker: string; children: InlineNode[] };

/** Lê o markdown em linha do Discord (uma linha) como árvore; marcador sem par vira texto comum. */
export function parseInline(value: string): InlineNode[] {
  const stack: Frame[] = [{ kind: null, marker: '', children: [] }];
  const top = () => stack[stack.length - 1] as Frame;
  const append = (nodes: InlineNode[]) => {
    for (const node of nodes) {
      const siblings = top().children;
      const last = siblings[siblings.length - 1];
      if (node.type === 'text' && last?.type === 'text') last.text += node.text;
      else siblings.push(node);
    }
  };
  const addText = (text: string) => append([{ type: 'text', text }]);
  const flatten = (frame: Frame) => {
    addText(frame.marker);
    append(frame.children);
  };
  const frameIndex = (kind: FormatKind) => {
    for (let index = stack.length - 1; index > 0; index--) if (stack[index]?.kind === kind) return index;
    return -1;
  };

  // Abre ou fecha um par; sem texto encostado no marcador ou sem par à frente, ele é texto comum.
  const toggle = (marker: string, kind: FormatKind, at: number): boolean => {
    const open = frameIndex(kind);
    if (open > 0) {
      if (at > 0 && WHITESPACE.test(value[at - 1] ?? '')) return false;
      while (stack.length - 1 > open) flatten(stack.pop() as Frame);
      const frame = stack.pop() as Frame;
      if (frame.children.length === 0) addText(frame.marker + marker);
      else append([{ type: 'format', kind, children: frame.children }]);
      return true;
    }
    const next = value[at + marker.length];
    if (next === undefined || WHITESPACE.test(next)) return false;
    if (value.indexOf(marker, at + marker.length + 1) === -1) return false;
    stack.push({ kind, marker, children: [] });
    return true;
  };

  const pairs: [string, FormatKind][] = [['**', 'bold'], ['__', 'underline'], ['~~', 'strike'], ['||', 'spoiler']];
  let i = 0;
  while (i < value.length) {
    const char = value[i] as string;
    if (char === '`') {
      const run = backtickRun(value, i);
      const end = findCodeEnd(value, i, run);
      if (end === -1) {
        addText('`'.repeat(run));
        i += run;
      } else {
        append([{ type: 'code', text: value.slice(i + run, end).replace(/^ (?= *`)| (?=` *$)/gu, '') }]);
        i = end + run;
      }
      continue;
    }
    if (char === '[') {
      MASKED_AT.lastIndex = i;
      const masked = MASKED_AT.exec(value);
      if (masked) {
        append([{ type: 'link', href: masked[2] ?? '', label: masked[1] ?? '' }]);
        i += masked[0].length;
        continue;
      }
    }
    if (char === 'h') {
      URL_AT.lastIndex = i;
      const url = URL_AT.exec(value);
      if (url) {
        const href = url[0].replace(TRAILING_PUNCTUATION, '');
        append([{ type: 'link', href, label: href }]);
        i += href.length;
        continue;
      }
    }
    if (char === '<') {
      const token = tokenAt(value, i);
      if (token) {
        append([token.node]);
        i += token.length;
        continue;
      }
    }
    if (value.startsWith('***', i)) {
      // `***` junta os dois marcadores; o que está por dentro (aberto por último) fecha primeiro.
      const italicAt = frameIndex('italic');
      const boldAt = frameIndex('bold');
      const italicFirst = italicAt > 0 && boldAt > 0 ? italicAt > boldAt : italicAt > 0;
      const tokens: [string, FormatKind][] = italicFirst ? [['*', 'italic'], ['**', 'bold']] : [['**', 'bold'], ['*', 'italic']];
      let at = i;
      for (const [marker, kind] of tokens) {
        if (!toggle(marker, kind, at)) addText(marker);
        at += marker.length;
      }
      i += 3;
      continue;
    }
    const pair = pairs.find(([marker]) => value.startsWith(marker, i));
    if (pair) {
      if (!toggle(pair[0], pair[1], i)) addText(pair[0]);
      i += pair[0].length;
      continue;
    }
    if (char === '*') {
      if (!toggle('*', 'italic', i)) addText('*');
      i++;
      continue;
    }
    addText(char);
    i++;
  }
  while (stack.length > 1) flatten(stack.pop() as Frame);
  return stack[0]?.children ?? [];
}
