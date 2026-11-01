import { twemojiUrl, usesFlagImage } from './emoji-support';

/** Imagem de um emoji personalizado do Discord. */
export function emojiImageUrl(id: string, animated?: boolean): string {
  return `https://cdn.discordapp.com/emojis/${id}.${animated ? 'gif' : 'png'}?size=32`;
}

type EmojiGlyphProps = {
  /** Caractere do emoji padrão, ou o nome do personalizado. */
  name: string;
  /** ID do emoji personalizado do servidor; sem ele o emoji é padrão. */
  id?: string | undefined;
  animated?: boolean | undefined;
  /** Classes quando o emoji é uma imagem (personalizado ou bandeira). */
  imageClass: string;
  /** Classes quando o emoji é texto. */
  textClass?: string;
  alt?: string;
};

/**
 * Um emoji do jeito que o Discord mostra: personalizado e bandeiras como imagem, os demais como texto.
 *
 *     <EmojiGlyph name={emoji.name} id={emoji.id} animated={emoji.animated} imageClass="size-5" />
 */
export function EmojiGlyph({ name, id, animated, imageClass, textClass, alt = '' }: EmojiGlyphProps) {
  if (id !== undefined && id !== '') return <img src={emojiImageUrl(id, animated)} alt={alt} className={imageClass} />;
  if (usesFlagImage(name)) return <img src={twemojiUrl(name)} alt={alt} loading="lazy" className={imageClass} />;
  return <span className={textClass}>{name}</span>;
}
