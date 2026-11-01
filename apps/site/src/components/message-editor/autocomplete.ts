/** Autocompletar do editor de mensagens: acha o gatilho (`:` emoji, `#` canal, `@` cargo) antes do cursor, filtra as sugestões e troca o gatilho pela menção. Lógica pura, sem React. */

export type SuggestionKind = 'emoji' | 'channel' | 'role';
export type SuggestionItem =
  | { kind: 'emoji'; id: string; name: string; animated: boolean; url: string }
  | { kind: 'channel'; id: string; name: string; group: string | null; voice: boolean }
  | { kind: 'role'; id: string; name: string; color: string | null };
/** Gatilho aberto antes do cursor: `start` é o índice do caractere gatilho (`:`, `#` ou `@`); `end` é a posição do cursor. */
export type Trigger = { kind: SuggestionKind; query: string; start: number; end: number };

const KIND_BY_TRIGGER: Record<string, SuggestionKind> = { ':': 'emoji', '#': 'channel', '@': 'role' };
/** Começo do texto ou espaço, o gatilho e a query (letras, números, `_` e `-`, até 32) colados no cursor. */
const TRIGGER_BEFORE_CARET = /(^|\s)([:#@])([\p{L}\p{N}_-]{0,32})$/u;

/** Gatilho aberto logo antes do cursor, se houver. Espaço, quebra de linha ou outro caractere antes de achar o gatilho cancela. */
export function detectTrigger(text: string, caret: number): Trigger | null {
  const match = TRIGGER_BEFORE_CARET.exec(text.slice(0, caret));
  if (!match) return null;
  const kind = KIND_BY_TRIGGER[match[2] ?? ''];
  if (!kind) return null;
  return { kind, query: match[3] ?? '', start: match.index + (match[1] ?? '').length, end: caret };
}

/** Minúsculas e sem acento, para comparar "Ação" com "acao". */
function fold(value: string): string {
  return value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

/** Sugestões que casam com a query: primeiro as que começam com ela, depois as que a contêm; a ordem original vale dentro de cada grupo. */
export function filterSuggestions<T extends { name: string }>(items: readonly T[], query: string, limit = 50): T[] {
  const wanted = fold(query);
  const starts: T[] = [];
  const contains: T[] = [];
  for (const item of items) {
    const name = fold(item.name);
    if (name.startsWith(wanted)) starts.push(item);
    else if (name.includes(wanted)) contains.push(item);
  }
  return [...starts, ...contains].slice(0, limit);
}

/** Texto da menção que o Discord reconhece: `<#id>`, `<@&id>` ou `<:nome:id>` (`<a:nome:id>` quando o emoji é animado). */
export function mentionText(item: SuggestionItem): string {
  if (item.kind === 'channel') return `<#${item.id}>`;
  if (item.kind === 'role') return `<@&${item.id}>`;
  return `<${item.animated ? 'a' : ''}:${item.name}:${item.id}>`;
}

/** Troca o gatilho pela menção e põe um espaço depois, salvo se o texto já tiver espaço ali; null se o resultado passar de `maxLength`. */
export function applySuggestion(text: string, trigger: Trigger, item: SuggestionItem, maxLength: number): { text: string; caret: number } | null {
  const mention = mentionText(item);
  const rest = text.slice(trigger.end);
  const space = /^\s/u.test(rest) ? '' : ' ';
  const next = text.slice(0, trigger.start) + mention + space + rest;
  if (next.length > maxLength) return null;
  return { text: next, caret: trigger.start + mention.length + space.length };
}
