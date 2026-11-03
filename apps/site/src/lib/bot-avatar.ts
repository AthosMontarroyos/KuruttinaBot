/** Lê uma meta com URL https injetada pelo servidor; vazia quando ausente ou inválida. */
function readHttpsMeta(name: string): string {
  const content = document.querySelector(`meta[name="${name}"]`)?.getAttribute('content') ?? '';
  try {
    const url = new URL(content);
    if (url.protocol !== 'https:' || url.username || url.password) return '';
    return url.href;
  } catch {
    return '';
  }
}

/** Foto do bot que o servidor injeta no HTML; vazia quando a URL não é https válida. */
function readBotAvatarUrl(): string {
  return readHttpsMeta('kuruttina-avatar');
}

/** Ícone do aplicativo Discord que o servidor injeta no HTML; vazio quando a URL não é https válida. */
function readAppIconUrl(): string {
  return readHttpsMeta('kuruttina-app-icon');
}

/** Capa da Home que o servidor injeta no HTML; vazia quando a URL não é https válida. */
function readHomeCoverUrl(): string {
  return readHttpsMeta('kuruttina-home-cover');
}

/** Versão da capa sem fundo, usada no tema escuro; vazia quando a URL não é https válida. */
function readHomeCoverDarkUrl(): string {
  return readHttpsMeta('kuruttina-home-cover-dark');
}

export { readAppIconUrl, readBotAvatarUrl, readHomeCoverDarkUrl, readHomeCoverUrl };
