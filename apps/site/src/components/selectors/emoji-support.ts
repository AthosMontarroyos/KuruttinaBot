/** Parte de um emoji padrão que importa aqui (`EmojiEntry` de `emoji-data.ts` satisfaz). */
type Renderable = { unicode: string; skins?: { unicode: string }[] };

// Largura de um emoji bem desenhado, em relação ao rosto 😀 (todos os emojis têm a mesma largura na fonte do sistema).
// Emoji novo demais vira quadradinho (mais estreito); família e outras sequências sem desenho viram vários emojis
// soltos. Todos fogem dessa faixa.
const MIN_RATIO = 0.97;
const MAX_RATIO = 1.15;

const REGIONAL_INDICATOR_PAIR = /^[\u{1F1E6}-\u{1F1FF}]{2}$/u;
const TAG_CHARACTER = /[\u{E0020}-\u{E007F}]/u;
const TWEMOJI_BASE = 'https://cdn.jsdelivr.net/gh/jdecked/twemoji@15.1.0/assets/svg';

// Bandeiras mais novas que a versão do Twemoji acima (sem imagem lá): Sark.
const WITHOUT_IMAGE = new Set(['🇨🇶']);

/**
 * Bandeira de país (duas letras regionais) ou de região (bandeira preta com tags: Inglaterra, Escócia, País de Gales).
 * O Windows não desenha essas bandeiras (mostra letras ou uma bandeira preta), então elas aparecem como imagem.
 */
export function usesFlagImage(unicode: string): boolean {
  return (REGIONAL_INDICATOR_PAIR.test(unicode) || TAG_CHARACTER.test(unicode)) && !WITHOUT_IMAGE.has(unicode);
}

/** Imagem Twemoji (a mesma arte que o Discord usa) de um emoji padrão, pelos pontos de código do arquivo. */
export function twemojiUrl(unicode: string): string {
  const codePoints = [...unicode].map((char) => char.codePointAt(0) ?? 0);
  const kept = codePoints.includes(0x200d) ? codePoints : codePoints.filter((codePoint) => codePoint !== 0xfe0f);
  return `${TWEMOJI_BASE}/${kept.map((codePoint) => codePoint.toString(16)).join('-')}.svg`;
}

/**
 * Tira dos dados os emojis que este sistema não consegue desenhar (a lista do pacote é mais nova que a fonte de emoji do
 * Windows), para o painel não mostrar quadradinhos nem pedaços no lugar do emoji. Bandeiras que `usesFlagImage` desenha
 * como imagem ficam. Emoji que perde só os tons de pele fica sem eles. Sem DOM (testes, servidor), devolve os dados
 * como vieram.
 */
export function keepRenderable<Emoji extends Renderable, Category extends { emojis: Emoji[] }>(categories: Category[]): Category[] {
  if (typeof document === 'undefined') return categories;
  const context = document.createElement('canvas').getContext('2d');
  if (context === null) return categories;
  context.font = '32px sans-serif';
  const reference = context.measureText('😀').width;
  if (reference <= 0) return categories;

  const drawn = (text: string): boolean => {
    const ratio = context.measureText(text).width / reference;
    return ratio >= MIN_RATIO && ratio <= MAX_RATIO;
  };

  const withDrawnSkins = (emoji: Emoji): Emoji => {
    if (emoji.skins === undefined || emoji.skins.every((skin) => drawn(skin.unicode))) return emoji;
    const { skins: _skins, ...withoutSkins } = emoji;
    return withoutSkins as Emoji;
  };

  return categories.map((category) => ({
    ...category,
    emojis: category.emojis.filter((emoji) => usesFlagImage(emoji.unicode) || drawn(emoji.unicode)).map(withDrawnSkins),
  }));
}
