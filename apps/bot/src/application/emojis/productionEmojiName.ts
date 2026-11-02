import { EMOJI_NAME_PATTERN } from './types.js';

/** Origem sem um nome aproveitável (ID puro). A mesma frase vale no comando e no workflow. */
export const PRODUCTION_EMOJI_NAME_MISSING =
  'Essa origem não traz um nome. Informe um nome de 2 a 32 caracteres.';

/** A origem tinha um candidato, mas a sanitização não coube na regra do Discord. */
export const PRODUCTION_EMOJI_NAME_INVALID =
  'Não consegui formar um nome válido com essa origem. Informe um nome de 2 a 32 caracteres, entre A–Z, a–z, 0–9 ou _.';

export type ProductionEmojiNameSource =
  | { readonly kind: 'mention'; readonly name: string }
  | { readonly kind: 'filename'; readonly filename: string }
  | { readonly kind: 'url'; readonly url: string }
  | { readonly kind: 'id' };

export type DerivedProductionEmojiName =
  | { readonly status: 'ready'; readonly name: string }
  | { readonly status: 'missing' }
  | { readonly status: 'invalid' };

const TRAILING_EXTENSION = /\.[A-Za-z0-9]{1,8}$/u;
const MAX_EMOJI_NAME_LENGTH = 32;
const MAX_FREE_SUFFIX = 10_000;

/**
 * Converte texto livre na regra de Application Emoji.
 * Um texto que já cumpre a regra volta igual, para não cortar `_` de um nome válido.
 * Nos demais: tira acento, troca cada sequência inválida por `_`, junta `_` repetido,
 * remove `_` das pontas e corta em 32. `undefined` quando o resultado não tem 2–32.
 */
export function sanitizeApplicationEmojiName(raw: string): string | undefined {
  const trimmed = raw.trim();
  if (EMOJI_NAME_PATTERN.test(trimmed)) return trimmed;
  const folded = trimmed.normalize('NFD').replace(/\p{M}/gu, '');
  const cleaned = folded
    .replace(/[^A-Za-z0-9_]+/gu, '_')
    .replace(/_+/gu, '_')
    .replace(/^_+|_+$/gu, '')
    .slice(0, MAX_EMOJI_NAME_LENGTH)
    .replace(/^_+|_+$/gu, '');
  return EMOJI_NAME_PATTERN.test(cleaned) ? cleaned : undefined;
}

/**
 * Nome pedido ausente. Marcação usa o nome do emoji. Arquivo e URL usam o
 * nome do arquivo sem a extensão. ID puro não tem nome.
 */
export function deriveProductionEmojiName(source: ProductionEmojiNameSource): DerivedProductionEmojiName {
  if (source.kind === 'id') return { status: 'missing' };
  const basis = nameBasis(source);
  if (basis === undefined) return { status: 'invalid' };
  const name = sanitizeApplicationEmojiName(basis);
  return name === undefined ? { status: 'invalid' } : { status: 'ready', name };
}

/**
 * Primeiro nome livre entre os Application Emojis já existentes.
 * A comparação ignora maiúsculas. Se a base está livre, ela mesma volta.
 * Se não, acrescenta 2, 3, … e encurta o começo para o total caber em 32.
 * Quem lista os emojis de production é o script do workflow: o bot de
 * development não tem esse token e não chama esta função.
 */
export function firstFreeApplicationEmojiName(base: string, existing: readonly string[]): string | undefined {
  if (!EMOJI_NAME_PATTERN.test(base)) return undefined;
  const taken = new Set(existing.map((name) => name.toLowerCase()));
  if (!taken.has(base.toLowerCase())) return base;
  for (let number = 2; number <= MAX_FREE_SUFFIX; number += 1) {
    const suffix = String(number);
    const room = MAX_EMOJI_NAME_LENGTH - suffix.length;
    if (room < 2) return undefined;
    const candidate = `${base.slice(0, room)}${suffix}`;
    if (!EMOJI_NAME_PATTERN.test(candidate)) continue;
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }
  return undefined;
}

function nameBasis(source: Exclude<ProductionEmojiNameSource, { readonly kind: 'id' }>): string | undefined {
  if (source.kind === 'mention') return source.name;
  if (source.kind === 'filename') return stripExtension(source.filename);
  const filename = urlFilename(source.url);
  return filename === undefined ? undefined : stripExtension(filename);
}

function stripExtension(filename: string): string {
  return filename.replace(TRAILING_EXTENSION, '');
}

function urlFilename(rawUrl: string): string | undefined {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return undefined;
  }
  const segment = url.pathname.split('/').filter((part) => part !== '').pop();
  if (segment === undefined) return undefined;
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}
