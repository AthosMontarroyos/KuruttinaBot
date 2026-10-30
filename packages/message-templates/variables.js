/**
 * Lista única das variáveis pré-definidas das ações do bot (`{user.name}`,
 * `{guild.name}`...), compartilhada pelo bot (que preenche os valores) e pelo
 * site (que valida o template e mostra a lista no editor).
 *
 * Módulo puro: não conhece discord.js nem rede. Quem dispara a ação converte
 * seus objetos para `ActionUser` e `ActionGuild` e chama `buildActionValues`.
 */

const SNOWFLAKE = /^\d{1,20}$/u;
/** Só o CDN do Discord e caracteres de caminho/consulta: nada que o Markdown ou uma menção interprete. */
const CDN_URL = /^https:\/\/cdn\.discordapp\.com\/[A-Za-z0-9_\-./?=&]+$/u;
const URL_MAX_LENGTH = 200;

/**
 * Variável de ação: um `TemplateVariable` com a documentação mostrada no site.
 * @typedef {import('./template.js').TemplateVariable & {description: string, example: string}} ActionVariable
 */

/** @type {readonly ActionVariable[]} */
export const ACTION_VARIABLES = Object.freeze([
  { name: 'user.id', maxLength: 20, format: 'raw', description: 'ID do usuário que disparou a ação.', example: '123456789012345678' },
  { name: 'user.name', maxLength: 64, description: 'Nome do usuário que disparou a ação.', example: 'Kurutta' },
  { name: 'user.mention', maxLength: 23, format: 'raw', description: 'Menciona o usuário que disparou a ação.', example: '<@123456789012345678>' },
  { name: 'user.avatar', maxLength: URL_MAX_LENGTH, format: 'raw', image: true, description: 'Foto do usuário (link no texto; imagem nos campos de imagem).', example: 'https://cdn.discordapp.com/avatars/…/….png' },
  { name: 'guild.id', maxLength: 20, format: 'raw', description: 'ID do servidor.', example: '987654321098765432' },
  { name: 'guild.name', maxLength: 200, description: 'Nome do servidor.', example: 'Casa do Kuru' },
  { name: 'guild.avatar', maxLength: URL_MAX_LENGTH, format: 'raw', image: true, description: 'Ícone do servidor (link no texto; imagem nos campos de imagem).', example: 'https://cdn.discordapp.com/icons/…/….png' },
  { name: 'guild.banner', maxLength: URL_MAX_LENGTH, format: 'raw', image: true, description: 'Banner do servidor, vazio se não tiver (link no texto; imagem nos campos de imagem).', example: 'https://cdn.discordapp.com/banners/…/….png' },
  { name: 'guild.membercount', maxLength: 10, format: 'raw', description: 'Quantidade de membros do servidor.', example: '1234' },
  { name: 'nowtimestamp', maxLength: 24, format: 'raw', description: 'Data e hora do momento da ação, no fuso de quem lê.', example: '<t:1761782400:f>' },
]);

/**
 * @typedef {Object} ActionUser
 * @property {string} id
 * @property {string} name
 * @property {string|null} [avatarUrl]
 */

/**
 * @typedef {Object} ActionGuild
 * @property {string} id
 * @property {string} name
 * @property {string|null} [iconUrl]
 * @property {string|null} [bannerUrl]
 * @property {number|null} [memberCount]
 */

/**
 * Monta `chave -> valor` para `renderTemplate`. O que não vier (ou vier fora do
 * formato esperado) fica de fora e renderiza vazio. Valores `raw` só saem em
 * formatos que o próprio bot controla: ID numérico, menção, URL do CDN do Discord e número.
 * @param {{user?: ActionUser|null, guild?: ActionGuild|null, now?: Date}} [source]
 * @returns {Record<string, string>}
 */
export function buildActionValues({ user = null, guild = null, now = new Date() } = {}) {
  /** @type {Record<string, string>} */
  const values = {};
  /** @param {string} key @param {string|null|undefined} id */
  const setId = (key, id) => { if (id != null && SNOWFLAKE.test(id)) values[key] = id; };
  /** @param {string} key @param {string|null|undefined} url */
  const setUrl = (key, url) => {
    if (url != null && url.length <= URL_MAX_LENGTH && CDN_URL.test(url)) values[key] = url;
  };

  if (user !== null) {
    setId('user.id', user.id);
    if (SNOWFLAKE.test(user.id)) values['user.mention'] = `<@${user.id}>`;
    if (typeof user.name === 'string') values['user.name'] = user.name;
    setUrl('user.avatar', user.avatarUrl);
  }
  if (guild !== null) {
    setId('guild.id', guild.id);
    if (typeof guild.name === 'string') values['guild.name'] = guild.name;
    setUrl('guild.avatar', guild.iconUrl);
    setUrl('guild.banner', guild.bannerUrl);
    const count = guild.memberCount;
    if (count != null && Number.isSafeInteger(count) && count >= 0) values['guild.membercount'] = String(count);
  }
  values.nowtimestamp = `<t:${Math.floor(now.getTime() / 1000)}:f>`;
  return values;
}
