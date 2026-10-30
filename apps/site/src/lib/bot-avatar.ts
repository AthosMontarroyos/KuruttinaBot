/** Avatar do bot que o servidor injeta no HTML; vazio quando a URL não é https válida. */
function readBotAvatarUrl(): string {
  const content = document.querySelector('meta[name="kuruttina-avatar"]')?.getAttribute('content') ?? '';
  try {
    const url = new URL(content);
    if (url.protocol !== 'https:' || url.username || url.password) return '';
    return url.href;
  } catch {
    return '';
  }
}

export { readBotAvatarUrl };
