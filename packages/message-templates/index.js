/**
 * Ponto de entrada do motor de templates de mensagem: limites, modelo e
 * validação, renderização e caso de uso de administração.
 */

export {
  DISCORD_MESSAGE_LIMITS,
  DEFAULT_GUILD_TEMPLATE_LIMITS,
} from './limits.js';
/** @typedef {import('./limits.js').GuildTemplateLimits} GuildTemplateLimits */

export {
  TemplateValidationError,
  validateTemplate,
  countTemplateComponents,
  checkGuildQuota,
  TEMPLATE_NAME_PATTERN,
} from './template.js';
/** @typedef {import('./template.js').TemplateEmbedField} TemplateEmbedField */
/** @typedef {import('./template.js').TemplateEmbed} TemplateEmbed */
/** @typedef {import('./template.js').TemplateButton} TemplateButton */
/** @typedef {import('./template.js').TemplateSelectOption} TemplateSelectOption */
/** @typedef {import('./template.js').TemplateSelectMenu} TemplateSelectMenu */
/** @typedef {import('./template.js').TemplateRow} TemplateRow */
/** @typedef {import('./template.js').MessageTemplate} MessageTemplate */
/** @typedef {import('./template.js').TemplateVariable} TemplateVariable */
/** @typedef {import('./template.js').TemplateErrorCode} TemplateErrorCode */
/** @typedef {import('./template.js').TemplateUsage} TemplateUsage */
/** @typedef {import('./template.js').GuildUsage} GuildUsage */
/** @typedef {import('./template.js').ComponentAction} ComponentAction */

/** Tira a referência a um Component apagado de um template (função pura). */
export { unlinkComponent } from './unlink.js';
/** @typedef {import('./unlink.js').UnlinkKind} UnlinkKind */
/** @typedef {import('./unlink.js').UnlinkResult} UnlinkResult */

export {
  extractVariables,
  escapeUserValue,
  renderTemplate,
  renderText,
  fillEmojis,
} from './render.js';
/** @typedef {import('./render.js').VariableToken} VariableToken */

export { ACTION_VARIABLES, buildActionValues } from './variables.js';
/** @typedef {import('./variables.js').ActionVariable} ActionVariable */
/** @typedef {import('./variables.js').ActionUser} ActionUser */
/** @typedef {import('./variables.js').ActionGuild} ActionGuild */

export {
  createTemplateAdminService,
  TemplateAdminError,
  extractComponents,
} from './templateAdmin.js';
/** @typedef {import('./templateAdmin.js').TemplateRecord} TemplateRecord */
/** @typedef {import('./templateAdmin.js').TemplateSummary} TemplateSummary */
/** @typedef {import('./templateAdmin.js').FolderSummary} FolderSummary */
/** @typedef {import('./templateAdmin.js').TemplateRepositoryPort} TemplateRepositoryPort */
/** @typedef {import('./templateAdmin.js').TemplateAdminErrorCode} TemplateAdminErrorCode */
/** @typedef {import('./templateAdmin.js').CreateTemplateInput} CreateTemplateInput */
/** @typedef {import('./templateAdmin.js').UpdateTemplateInput} UpdateTemplateInput */
/** @typedef {import('./templateAdmin.js').TemplateAdminService} TemplateAdminService */
/** @typedef {import('./templateAdmin.js').ExtractedComponent} ExtractedComponent */
