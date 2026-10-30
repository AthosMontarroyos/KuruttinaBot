/**
 * Dados do painel de emojis: categorias na ordem das abas do Discord, busca e tons de pele.
 *
 * As funções são puras (sem DOM e sem import de JSON). Quem carrega `emojibase-data/pt/compact.json` e chama
 * `buildCategories` é `EmojiPanel.tsx`, sob demanda.
 */

/** Forma de um item de `emojibase-data/pt/compact.json` (só os campos usados). */
export type RawEmoji = {
  hexcode: string;
  label: string;
  unicode: string;
  group?: number;
  order?: number;
  tags?: string[];
  skins?: RawEmoji[];
};

export type CategoryId = 'pessoas' | 'natureza' | 'comida' | 'atividades' | 'viagens' | 'objetos' | 'simbolos' | 'bandeiras';

export type EmojiCategoryDef = { id: CategoryId; label: string; groups: readonly number[] };

/** Abas na ordem do Discord. "Pessoas" junta os grupos 0 (rostos) e 1 (pessoas), nessa ordem. */
export const CATEGORY_DEFS: readonly EmojiCategoryDef[] = [
  { id: 'pessoas', label: 'Pessoas', groups: [0, 1] },
  { id: 'natureza', label: 'Natureza', groups: [3] },
  { id: 'comida', label: 'Comida', groups: [4] },
  { id: 'atividades', label: 'Atividades', groups: [6] },
  { id: 'viagens', label: 'Viagens', groups: [5] },
  { id: 'objetos', label: 'Objetos', groups: [7] },
  { id: 'simbolos', label: 'Símbolos', groups: [8] },
  { id: 'bandeiras', label: 'Bandeiras', groups: [9] },
];

/** Emoji padrão pronto para a interface. `skins` são os cinco tons, do mais claro ao mais escuro, quando existem. */
export type EmojiEntry = { unicode: string; label: string; tags: string[]; skins?: { unicode: string }[] };

export type EmojiCategory = { id: CategoryId; label: string; emojis: EmojiEntry[] };

/** 0 é o padrão; 1 a 5 são os tons de pele, na ordem dos dados. */
export type SkinTone = 0 | 1 | 2 | 3 | 4 | 5;

export const SKIN_TONES: readonly SkinTone[] = [0, 1, 2, 3, 4, 5];

export const SKIN_TONE_LABELS: Record<SkinTone, string> = {
  0: 'Tom padrão',
  1: 'Tom de pele clara',
  2: 'Tom de pele morena clara',
  3: 'Tom de pele morena',
  4: 'Tom de pele morena escura',
  5: 'Tom de pele escura',
};

/**
 * Monta as 8 categorias a partir dos dados do pacote. Ignora itens sem grupo e os de outros grupos
 * (como 2, componentes). Dentro da categoria, ordena pelo grupo (na ordem de `groups`) e depois por `order`.
 */
export function buildCategories(data: readonly RawEmoji[]): EmojiCategory[] {
  const placement = new Map<number, { category: number; rank: number }>();
  CATEGORY_DEFS.forEach((def, category) => {
    def.groups.forEach((group, rank) => placement.set(group, { category, rank }));
  });

  type Pending = { rank: number; order: number; emoji: EmojiEntry };
  const buckets: Pending[][] = CATEGORY_DEFS.map(() => []);
  for (const raw of data) {
    const place = raw.group === undefined ? undefined : placement.get(raw.group);
    if (place === undefined) continue;
    buckets[place.category]?.push({ rank: place.rank, order: raw.order ?? Number.MAX_SAFE_INTEGER, emoji: toEntry(raw) });
  }

  return CATEGORY_DEFS.map((def, index) => ({
    id: def.id,
    label: def.label,
    emojis: (buckets[index] ?? [])
      .sort((left, right) => left.rank - right.rank || left.order - right.order)
      .map((pending) => pending.emoji),
  }));
}

function toEntry(raw: RawEmoji): EmojiEntry {
  const entry: EmojiEntry = { unicode: raw.unicode, label: raw.label, tags: raw.tags ?? [] };
  if (raw.skins !== undefined && raw.skins.length > 0) entry.skins = raw.skins.map((skin) => ({ unicode: skin.unicode }));
  return entry;
}

/** Texto para comparar: sem acento (NFD sem marcas), minúsculo. */
export function normalizeText(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

/** Palavras da busca, já normalizadas. Vazio quando a busca é só espaço. */
export function queryTerms(query: string): string[] {
  return normalizeText(query).split(/\s+/u).filter((term) => term !== '');
}

/** `true` quando todos os termos (já normalizados por `queryTerms`) aparecem no texto. */
export function matchesTerms(text: string, terms: readonly string[]): boolean {
  const haystack = normalizeText(text);
  return terms.every((term) => haystack.includes(term));
}

/**
 * Emojis padrão cujo nome (`label`) ou tags casam com todas as palavras da busca, em ordem de categoria.
 * Busca vazia devolve lista vazia.
 */
export function searchEmojis(categories: readonly EmojiCategory[], query: string): EmojiEntry[] {
  const terms = queryTerms(query);
  if (terms.length === 0) return [];
  return categories.flatMap((category) =>
    category.emojis.filter((emoji) => matchesTerms(`${emoji.label} ${emoji.tags.join(' ')}`, terms)),
  );
}

/** Caractere do emoji com o tom escolhido. Sem `skins` (ou tom 0), devolve o padrão. */
export function applySkinTone(emoji: Pick<EmojiEntry, 'unicode' | 'skins'>, tone: SkinTone): string {
  if (tone === 0 || emoji.skins === undefined) return emoji.unicode;
  return emoji.skins[tone - 1]?.unicode ?? emoji.unicode;
}

