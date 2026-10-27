/**
 * Caso de uso de administração de templates de usuário (criar, editar, listar,
 * obter e remover). Não acessa banco: recebe um repositório (port) injetado,
 * no mesmo estilo de `application/emojis/importEmoji.ts`.
 *
 * Templates de usuário não declaram variáveis nesta etapa: `validateTemplate`
 * é sempre chamado com a lista de variáveis vazia.
 */

import {
  checkGuildQuota,
  countTemplateComponents,
  validateTemplate,
} from './template.js';

/** Tamanho máximo do JSON do template, em bytes UTF-8, antes do parse. */
const MAX_TEMPLATE_JSON_BYTES = 32768;

/** Nome de template: minúsculas, dígitos, `_` e `-`, de 1 a 32 caracteres. */
const TEMPLATE_NAME_PATTERN = /^[a-z0-9_-]{1,32}$/u;

/** Formato de um template já persistido, devolvido pelo repositório ao ler.
 * @typedef {Object} TemplateRecord
 * @property {string} name
 * @property {unknown} content
 * @property {number} buttonCount
 * @property {number} menuCount
 * @property {number} version
 * @property {string} createdBy
 * @property {string} updatedBy
 * @property {string} createdAt
 * @property {string} updatedAt
 */

/** Formato resumido usado em listagens.
 * @typedef {Object} TemplateSummary
 * @property {string} name
 * @property {number} buttonCount
 * @property {number} menuCount
 * @property {number} version
 * @property {string} updatedAt
 */

/** Port do repositório de templates: a única dependência externa deste caso de uso.
 * @typedef {Object} TemplateRepositoryPort
 * @property {(guildId: string, options?: {limit?: number, after?: string}) => Promise<TemplateSummary[]>} list
 * @property {(guildId: string, name: string) => Promise<TemplateRecord|null>} get
 * @property {(guildId: string) => Promise<import('./template.js').GuildUsage>} usage
 * @property {(input: {guildId: string, name: string, content: import('./template.js').MessageTemplate, buttonCount: number, menuCount: number, actorId: string}) => Promise<{ok: true}|{ok: false, code: 'duplicate'|'quota'}>} create
 * @property {(input: {guildId: string, name: string, expectedVersion: number, content: import('./template.js').MessageTemplate, buttonCount: number, menuCount: number, actorId: string}) => Promise<{ok: true, version: number}|{ok: false, code: 'not_found'|'conflict'|'quota'}>} update
 * @property {(guildId: string, name: string) => Promise<boolean>} remove
 */

/**
 * @typedef {'invalid_name'|'too_large'|'validation'|'quota'|'duplicate'|'not_found'|'conflict'} TemplateAdminErrorCode
 */

/** Erro do caso de uso, com código estável e, quando vier do motor, os detalhes. */
export class TemplateAdminError extends Error {
  /**
   * @param {TemplateAdminErrorCode} code
   * @param {string} message
   * @param {readonly import('./template.js').TemplateValidationError[]} [details]
   */
  constructor(code, message, details) {
    super(message);
    this.name = 'TemplateAdminError';
    /** @type {TemplateAdminErrorCode} */
    this.code = code;
    if (details !== undefined) {
      /** @type {readonly import('./template.js').TemplateValidationError[]|undefined} */
      this.details = details;
    }
  }
}

/**
 * @typedef {Object} CreateTemplateInput
 * @property {string} guildId
 * @property {string} name
 * @property {string} contentJson JSON crú do template, como chega de um anexo ou de texto do comando.
 * @property {string} actorId
 */

/**
 * @typedef {Object} UpdateTemplateInput
 * @property {string} guildId
 * @property {string} name
 * @property {number} expectedVersion
 * @property {string} contentJson
 * @property {string} actorId
 */

/**
 * @typedef {Object} TemplateAdminService
 * @property {(input: CreateTemplateInput) => Promise<TemplateRecord>} createTemplate
 * @property {(input: UpdateTemplateInput) => Promise<TemplateRecord>} updateTemplate
 * @property {(guildId: string, options?: {limit?: number, after?: string}) => Promise<TemplateSummary[]>} listTemplates
 * @property {(guildId: string, name: string) => Promise<TemplateRecord|null>} getTemplate
 * @property {(guildId: string, name: string) => Promise<void>} removeTemplate
 */

/** Cria o serviço de administração de templates, injetando o repositório.
 * @param {TemplateRepositoryPort} repository @returns {TemplateAdminService} */
export function createTemplateAdminService(repository) {
  return {
    createTemplate: (input) => createTemplate(input, repository),
    updateTemplate: (input) => updateTemplate(input, repository),
    listTemplates: (guildId, options) => repository.list(guildId, options),
    getTemplate: (guildId, name) => repository.get(guildId, name),
    removeTemplate: async (guildId, name) => {
      await repository.remove(guildId, name);
    },
  };
}

/** Valida nome e tamanho, faz o parse e roda a validação do motor. Lança em qualquer falha.
 * @param {string} name @param {string} contentJson @returns {import('./template.js').MessageTemplate} */
function parseAndValidate(name, contentJson) {
  if (!TEMPLATE_NAME_PATTERN.test(name)) {
    throw new TemplateAdminError('invalid_name', 'O nome do template precisa ter de 1 a 32 caracteres entre a-z, 0-9, _ e -.');
  }
  if (Buffer.byteLength(contentJson, 'utf8') > MAX_TEMPLATE_JSON_BYTES) {
    throw new TemplateAdminError('too_large', `O template não pode passar de ${MAX_TEMPLATE_JSON_BYTES} bytes.`);
  }
  let parsed;
  try {
    parsed = JSON.parse(contentJson);
  } catch {
    throw new TemplateAdminError('validation', 'O JSON do template é inválido.');
  }
  const template = parsed;
  // Templates de usuário não declaram variáveis nesta etapa.
  const errors = validateTemplate(template, []);
  if (errors.length > 0) {
    throw new TemplateAdminError('validation', 'O template não passou na validação.', errors);
  }
  return template;
}

/** @param {import('./template.js').TemplateErrorCode} code @returns {string} */
function quotaErrorMessage(code) {
  return code === 'quota_exceeded' ? 'O servidor atingiu a cota de templates ou componentes.' : 'Cota excedida.';
}

/** @param {CreateTemplateInput} input @param {TemplateRepositoryPort} repository @returns {Promise<TemplateRecord>} */
async function createTemplate(input, repository) {
  const template = parseAndValidate(input.name, input.contentJson);
  const componentsUsage = countTemplateComponents(template);

  const usage = await repository.usage(input.guildId);
  const quotaError = checkGuildQuota(usage, undefined, componentsUsage, true);
  if (quotaError) throw new TemplateAdminError('quota', quotaErrorMessage(quotaError.code), [quotaError]);

  const result = await repository.create({
    guildId: input.guildId,
    name: input.name,
    content: template,
    buttonCount: componentsUsage.buttons,
    menuCount: componentsUsage.menus,
    actorId: input.actorId,
  });
  if (!result.ok) {
    throw new TemplateAdminError(result.code, result.code === 'duplicate' ? 'Já existe um template com esse nome.' : 'Cota excedida.');
  }

  const record = await repository.get(input.guildId, input.name);
  if (!record) throw new TemplateAdminError('not_found', 'O template criado não foi encontrado.');
  return record;
}

/** @param {UpdateTemplateInput} input @param {TemplateRepositoryPort} repository @returns {Promise<TemplateRecord>} */
async function updateTemplate(input, repository) {
  const template = parseAndValidate(input.name, input.contentJson);
  const componentsUsage = countTemplateComponents(template);

  const previous = await repository.get(input.guildId, input.name);
  if (!previous) throw new TemplateAdminError('not_found', 'Template não encontrado.');

  const usage = await repository.usage(input.guildId);
  // Subtrai o uso do template antigo (nunca negativo) antes de checar a cota do novo conteúdo.
  /** @type {import('./template.js').GuildUsage} */
  const usageWithoutThisTemplate = {
    templates: usage.templates,
    buttons: Math.max(0, usage.buttons - previous.buttonCount),
    menus: Math.max(0, usage.menus - previous.menuCount),
  };
  const quotaError = checkGuildQuota(usageWithoutThisTemplate, undefined, componentsUsage, false);
  if (quotaError) throw new TemplateAdminError('quota', quotaErrorMessage(quotaError.code), [quotaError]);

  const result = await repository.update({
    guildId: input.guildId,
    name: input.name,
    expectedVersion: input.expectedVersion,
    content: template,
    buttonCount: componentsUsage.buttons,
    menuCount: componentsUsage.menus,
    actorId: input.actorId,
  });
  if (!result.ok) {
    /** @type {Record<'not_found'|'conflict'|'quota', string>} */
    const messages = {
      not_found: 'Template não encontrado.',
      conflict: 'O template foi alterado por outra pessoa; recarregue e tente de novo.',
      quota: 'Cota excedida.',
    };
    throw new TemplateAdminError(result.code, messages[result.code]);
  }

  const record = await repository.get(input.guildId, input.name);
  if (!record) throw new TemplateAdminError('not_found', 'O template atualizado não foi encontrado.');
  return record;
}
