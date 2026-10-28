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
  TEMPLATE_NAME_PATTERN,
  validateTemplate,
} from './template.js';

/** Tamanho máximo do JSON do template, em bytes UTF-8, antes do parse. */
const MAX_TEMPLATE_JSON_BYTES = 32768;

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
 * @property {number|null} folderId
 * @property {string|null} folderName
 */

/** Formato resumido usado em listagens.
 * @typedef {Object} TemplateSummary
 * @property {string} name
 * @property {number} buttonCount
 * @property {number} menuCount
 * @property {number} version
 * @property {string} updatedAt
 * @property {number|null} folderId
 * @property {string|null} folderName
 */

/** Pasta de templates, devolvida pelo repositório.
 * @typedef {Object} FolderSummary
 * @property {number} id
 * @property {string} name
 * @property {string} createdAt
 */

/** Port do repositório de templates: a única dependência externa deste caso de uso.
 * @typedef {Object} TemplateRepositoryPort
 * @property {(guildId: string, options?: {limit?: number, after?: string}) => Promise<TemplateSummary[]>} list
 * @property {(guildId: string, name: string) => Promise<TemplateRecord|null>} get
 * @property {(guildId: string) => Promise<import('./template.js').GuildUsage>} usage
 * @property {(input: {guildId: string, name: string, content: import('./template.js').MessageTemplate, buttonCount: number, menuCount: number, components: ExtractedComponent[], actorId: string, folderId?: number|null|undefined}) => Promise<{ok: true}|{ok: false, code: 'duplicate'|'duplicate_custom_id'|'quota'|'invalid_folder'}>} create
 * @property {(input: {guildId: string, name: string, expectedVersion: number, content: import('./template.js').MessageTemplate, buttonCount: number, menuCount: number, components: ExtractedComponent[], actorId: string, folderId?: number|null|undefined}) => Promise<{ok: true, version: number}|{ok: false, code: 'not_found'|'conflict'|'quota'|'duplicate_custom_id'|'invalid_folder'}>} update
 * @property {(guildId: string, name: string) => Promise<boolean>} remove
 * @property {(guildId: string, name: string, folderId: number|null) => Promise<{ok: true}|{ok: false, code: 'not_found'|'invalid_folder'}>} move
 * @property {(guildId: string) => Promise<FolderSummary[]>} listFolders
 * @property {(guildId: string, name: string) => Promise<{ok: true, id: number}|{ok: false, code: 'quota'|'duplicate'}>} createFolder
 * @property {(guildId: string, id: number, name: string) => Promise<{ok: true}|{ok: false, code: 'not_found'|'duplicate'}>} renameFolder
 * @property {(guildId: string, id: number) => Promise<boolean>} removeFolder
 */

/**
 * @typedef {'invalid_name'|'too_large'|'validation'|'quota'|'duplicate'|'duplicate_custom_id'|'not_found'|'conflict'|'invalid_folder'|'invalid_folder_name'|'folder_not_found'|'duplicate_folder'} TemplateAdminErrorCode
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
 * @property {number|null} [folderId]
 */

/**
 * @typedef {Object} UpdateTemplateInput
 * @property {string} guildId
 * @property {string} name
 * @property {number} expectedVersion
 * @property {string} contentJson
 * @property {string} actorId
 * @property {number|null} [folderId]
 */

/**
 * @typedef {Object} TemplateAdminService
 * @property {(input: CreateTemplateInput) => Promise<TemplateRecord>} createTemplate
 * @property {(input: UpdateTemplateInput) => Promise<TemplateRecord>} updateTemplate
 * @property {(guildId: string, options?: {limit?: number, after?: string}) => Promise<TemplateSummary[]>} listTemplates
 * @property {(guildId: string, name: string) => Promise<TemplateRecord|null>} getTemplate
 * @property {(guildId: string, name: string) => Promise<void>} removeTemplate
 * @property {(guildId: string, name: string, folderId: number|null) => Promise<void>} moveTemplate
 * @property {(guildId: string) => Promise<FolderSummary[]>} listFolders
 * @property {(guildId: string, name: string) => Promise<{id: number, name: string}>} createFolder
 * @property {(guildId: string, id: number, name: string) => Promise<void>} renameFolder
 * @property {(guildId: string, id: number) => Promise<void>} removeFolder
 */

/** Mesma regra de nome de pasta da migration: sem espaços nas pontas, 1 a 50 caracteres.
 * @param {string} name */
function validateFolderName(name) {
  if (name.trim() !== name || name.length < 1 || name.length > 50) {
    throw new TemplateAdminError('invalid_folder_name', 'O nome da pasta precisa ter de 1 a 50 caracteres, sem espaços nas pontas.');
  }
}

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
    moveTemplate: async (guildId, name, folderId) => {
      const result = await repository.move(guildId, name, folderId);
      if (!result.ok) {
        /** @type {Record<'not_found'|'invalid_folder', string>} */
        const messages = { not_found: 'Template não encontrado.', invalid_folder: 'Essa pasta não é válida para este servidor.' };
        throw new TemplateAdminError(result.code, messages[result.code]);
      }
    },
    listFolders: (guildId) => repository.listFolders(guildId),
    createFolder: async (guildId, name) => {
      validateFolderName(name);
      const result = await repository.createFolder(guildId, name);
      if (!result.ok) {
        /** @type {Record<'quota'|'duplicate', string>} */
        const messages = { quota: 'Cota excedida.', duplicate: 'Já existe uma pasta com esse nome.' };
        throw new TemplateAdminError(result.code === 'duplicate' ? 'duplicate_folder' : 'quota', messages[result.code]);
      }
      return { id: result.id, name };
    },
    renameFolder: async (guildId, id, name) => {
      validateFolderName(name);
      const result = await repository.renameFolder(guildId, id, name);
      if (!result.ok) {
        /** @type {Record<'not_found'|'duplicate', string>} */
        const messages = { not_found: 'Pasta não encontrada.', duplicate: 'Já existe uma pasta com esse nome.' };
        throw new TemplateAdminError(result.code === 'duplicate' ? 'duplicate_folder' : 'folder_not_found', messages[result.code]);
      }
    },
    removeFolder: async (guildId, id) => {
      await repository.removeFolder(guildId, id);
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

/** Mapa de `custom_id` -> ação, extraído de um template já validado.
 * @typedef {Object} ExtractedComponent
 * @property {string} customId
 * @property {'button'|'select_option'} kind
 * @property {import('./template.js').ComponentAction} action
 */

/** Percorre os componentes do template e devolve só os que têm `action`
 * definida (botões de link nunca têm ação; ignorados). Pura, sem I/O.
 * @param {import('./template.js').MessageTemplate} template @returns {ExtractedComponent[]} */
export function extractComponents(template) {
  /** @type {ExtractedComponent[]} */
  const components = [];
  for (const row of template.components) {
    if (row.kind === 'buttons') {
      for (const button of row.buttons) {
        if (button.style !== 'link' && button.action !== undefined) {
          components.push({ customId: button.customId, kind: 'button', action: button.action });
        }
      }
      continue;
    }
    for (const option of row.menu.options) {
      if (option.action !== undefined) {
        components.push({ customId: row.menu.customId, kind: 'select_option', action: option.action });
      }
    }
  }
  return components;
}

/** @param {CreateTemplateInput} input @param {TemplateRepositoryPort} repository @returns {Promise<TemplateRecord>} */
async function createTemplate(input, repository) {
  const template = parseAndValidate(input.name, input.contentJson);
  const componentsUsage = countTemplateComponents(template);
  const components = extractComponents(template);

  const usage = await repository.usage(input.guildId);
  const quotaError = checkGuildQuota(usage, undefined, componentsUsage, true);
  if (quotaError) throw new TemplateAdminError('quota', quotaErrorMessage(quotaError.code), [quotaError]);

  const result = await repository.create({
    guildId: input.guildId,
    name: input.name,
    content: template,
    buttonCount: componentsUsage.buttons,
    menuCount: componentsUsage.menus,
    components,
    actorId: input.actorId,
    folderId: input.folderId,
  });
  if (!result.ok) {
    /** @type {Record<'duplicate'|'duplicate_custom_id'|'quota'|'invalid_folder', string>} */
    const messages = {
      duplicate: 'Já existe um template com esse nome.',
      duplicate_custom_id: 'Já existe um componente com esse custom_id neste servidor.',
      quota: 'Cota excedida.',
      invalid_folder: 'A pasta informada não existe neste servidor.',
    };
    throw new TemplateAdminError(result.code, messages[result.code]);
  }

  const record = await repository.get(input.guildId, input.name);
  if (!record) throw new TemplateAdminError('not_found', 'O template criado não foi encontrado.');
  return record;
}

/** @param {UpdateTemplateInput} input @param {TemplateRepositoryPort} repository @returns {Promise<TemplateRecord>} */
async function updateTemplate(input, repository) {
  const template = parseAndValidate(input.name, input.contentJson);
  const componentsUsage = countTemplateComponents(template);
  const components = extractComponents(template);

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
    components,
    actorId: input.actorId,
    folderId: input.folderId,
  });
  if (!result.ok) {
    /** @type {Record<'not_found'|'conflict'|'quota'|'duplicate_custom_id'|'invalid_folder', string>} */
    const messages = {
      not_found: 'Template não encontrado.',
      conflict: 'O template foi alterado por outra pessoa; recarregue e tente de novo.',
      quota: 'Cota excedida.',
      duplicate_custom_id: 'Já existe um componente com esse custom_id neste servidor.',
      invalid_folder: 'A pasta informada não existe neste servidor.',
    };
    throw new TemplateAdminError(result.code, messages[result.code]);
  }

  const record = await repository.get(input.guildId, input.name);
  if (!record) throw new TemplateAdminError('not_found', 'O template atualizado não foi encontrado.');
  return record;
}
