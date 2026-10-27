/**
 * Limites de mensagens e de templates.
 *
 * Este módulo não conhece Discord, banco nem rede: apenas fixa números.
 */

/** Limites oficiais do Discord para uma mensagem com embeds e componentes. */
export const DISCORD_MESSAGE_LIMITS = Object.freeze({
  content: 2000,
  embeds: 10,
  embedTitle: 256,
  embedDescription: 4096,
  embedFields: 25,
  fieldName: 256,
  fieldValue: 1024,
  footerText: 2048,
  authorName: 256,
  /** Soma de título, descrição, campos, rodapé e autor de todos os embeds da mensagem. */
  embedTotal: 6000,
  componentRows: 5,
  buttonsPerRow: 5,
  buttonLabel: 80,
  customId: 100,
  selectOptions: 25,
  /** Rótulo e valor de uma opção de menu. */
  selectOptionText: 100,
});

/** Limites por servidor, somando todos os templates dele.
 * @typedef {Object} GuildTemplateLimits
 * @property {number} maxTemplates
 * @property {number} maxButtons
 * @property {number} maxSelectMenus
 */

/** @type {GuildTemplateLimits} */
export const DEFAULT_GUILD_TEMPLATE_LIMITS = Object.freeze({
  maxTemplates: 100,
  maxButtons: 50,
  maxSelectMenus: 50,
});
