/** Monta a fala unindo emojis do bot e texto, omitindo emoji que não pôde ser resolvido. */
export function withEmojis(...parts: string[]): string {
  return parts.filter((part) => part !== '').join(' ');
}
