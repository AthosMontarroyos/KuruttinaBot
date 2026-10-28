/**
 * Modelo de template de mensagem e sua validação.
 *
 * Modelo próprio (não APIEmbed): a camada application não conhece discord.js.
 * Variáveis são apenas `{chave}` declaradas; nada é avaliado.
 */

import { extractVariables } from './render.js';
import {
  DEFAULT_GUILD_TEMPLATE_LIMITS,
  DISCORD_MESSAGE_LIMITS as L,
} from './limits.js';

/**
 * @typedef {Object} TemplateEmbedField
 * @property {string} name
 * @property {string} value
 * @property {boolean} [inline]
 */

/**
 * @typedef {Object} TemplateEmbed
 * @property {string} [title]
 * @property {string} [description]
 * @property {string} [url]
 * @property {TemplateEmbedField[]} [fields]
 * @property {{text: string}} [footer]
 * @property {{name: string, url?: string}} [author]
 * @property {number} [color] Cor da barra lateral, como `0x2b2d31`: inteiro entre 0 e 0xFFFFFF.
 */

/**
 * Ação executada quando alguém interage com um botão ou opção de menu
 * (roteador de interações, etapa 1D): responder (`reply`), editar a própria
 * mensagem (`edit`), apagá-la (`delete`) ou enviar DM (`dm`). `reply`, `edit`
 * e `dm` apontam para outro template pelo nome; `ephemeral` só vale em `reply`.
 * @typedef {{type: 'reply', template: string, ephemeral?: boolean}|{type: 'edit', template: string}|{type: 'delete'}|{type: 'dm', template: string}} ComponentAction
 */

/**
 * @typedef {{style: 'link', label: string, url: string}|{style: 'primary'|'secondary'|'success'|'danger', label: string, customId: string, action?: ComponentAction}} TemplateButton
 */

/**
 * @typedef {Object} TemplateSelectOption
 * @property {string} label
 * @property {string} value
 * @property {string} [description]
 * @property {ComponentAction} [action]
 */

/**
 * @typedef {Object} TemplateSelectMenu
 * @property {string} customId
 * @property {string} [placeholder]
 * @property {TemplateSelectOption[]} options
 */

/**
 * @typedef {{kind: 'buttons', buttons: TemplateButton[]}|{kind: 'select', menu: TemplateSelectMenu}} TemplateRow
 */

/**
 * @typedef {Object} MessageTemplate
 * @property {string} [content]
 * @property {TemplateEmbed[]} embeds
 * @property {TemplateRow[]} components
 */

/**
 * Variável declarada: `maxLength` é o tamanho máximo do valor já escapado.
 * - `whenAbsent`: texto confiável do catálogo usado quando o valor não foi
 *   fornecido ou ficou vazio após a limpeza. Não passa por escape.
 * - `format`: `'escape'` (padrão) escapa Markdown e menções; `'code'` limpa o
 *   valor e o envolve em crase (o Markdown não é processado dentro do code span).
 * @typedef {Object} TemplateVariable
 * @property {string} name
 * @property {number} maxLength
 * @property {string} [whenAbsent]
 * @property {'escape'|'code'} [format]
 */

/**
 * @typedef {'empty_message'|'empty_embed'|'empty_text'|'too_many_embeds'|'too_many_fields'|'too_many_rows'|'too_many_buttons'|'too_many_options'|'empty_row'|'mixed_row'|'unknown_variable'|'unknown_emoji'|'invalid_color'|'invalid_variable'|'variable_not_allowed'|'invalid_url'|'invalid_custom_id'|'invalid_action'|'limit_exceeded'|'quota_exceeded'} TemplateErrorCode
 */

/** Erro de validação com código estável; a mensagem é neutra (falas ao usuário ficam fora daqui). */
export class TemplateValidationError extends Error {
  /**
   * @param {TemplateErrorCode} code
   * @param {string} path
   * @param {string} message
   */
  constructor(code, path, message) {
    super(message);
    this.name = 'TemplateValidationError';
    /** @type {TemplateErrorCode} */
    this.code = code;
    /** @type {string} */
    this.path = path;
  }
}

const CUSTOM_ID_PATTERN = /^kt:[a-z][a-z0-9_]*:[A-Za-z0-9_-]+$/u;
const ANY_BRACES = /[{}]/u;

/** Nome de template: minúsculas, dígitos, `_` e `-`, de 1 a 32 caracteres.
 * Reaproveitada por `templateAdmin.js`, que valida o nome do próprio template. */
export const TEMPLATE_NAME_PATTERN = /^[a-z0-9_-]{1,32}$/u;

/** Tipos de ação aceitos em um botão não-link ou opção de menu. */
const ACTION_TYPES = ['reply', 'edit', 'delete', 'dm'];

/**
 * Valida o template considerando o pior caso: cada variável ocupa o `maxLength`
 * declarado. Devolve todos os erros encontrados; lista vazia significa válido.
 * @param {MessageTemplate} template
 * @param {readonly TemplateVariable[]} variables
 * @returns {TemplateValidationError[]}
 */
export function validateTemplate(template, variables) {
  /** @type {TemplateValidationError[]} */
  const errors = [];
  const declared = new Map(variables.map((variable) => [variable.name, variable.maxLength]));
  let embedTotal = 0;

  /** @param {TemplateErrorCode} code @param {string} path @param {string} message */
  const fail = (code, path, message) => {
    errors.push(new TemplateValidationError(code, path, message));
  };

  /** Valida um texto com variáveis e devolve o tamanho de pior caso.
   * @param {string} path @param {string} text @param {number} max @param {boolean} [required] @returns {number} */
  const checkText = (path, text, max, required = false) => {
    if (required && text.trim() === '') fail('empty_text', path, 'O texto não pode ficar vazio.');
    let size = text.length;
    for (const token of extractVariables(text)) {
      size -= token.raw.length;
      if (token.key === null) {
        fail('invalid_variable', path, `Variável inválida: ${token.raw}.`);
        continue;
      }
      const maxLength = declared.get(token.key);
      if (maxLength === undefined) {
        fail('unknown_variable', path, `Variável não declarada: ${token.raw}.`);
        continue;
      }
      size += maxLength;
    }
    if (size > max) fail('limit_exceeded', path, `O texto pode passar de ${max} caracteres.`);
    return size;
  };

  /** Valor literal (URL, custom_id, opção de menu): variável é proibida.
   * @param {string} path @param {string} text @returns {boolean} */
  const checkLiteral = (path, text) => {
    if (ANY_BRACES.test(text)) {
      fail('variable_not_allowed', path, 'Variáveis não são permitidas neste campo.');
      return false;
    }
    return true;
  };

  /** @param {string} path @param {string} url */
  const checkUrl = (path, url) => {
    if (!checkLiteral(path, url)) return;
    let valid = false;
    try {
      valid = new URL(url).protocol === 'https:';
    } catch {
      valid = false;
    }
    if (!valid) fail('invalid_url', path, 'A URL precisa ser https:// válida.');
  };

  /** Ação de um botão ou opção de menu: tipo fechado, `template` exigido (e
   * validado) em reply/edit/dm, proibido em delete; `ephemeral` só em reply.
   * O tipo de entrada é permissivo (dado vindo de fora, ainda não validado).
   * @param {string} path @param {{type: string, template?: unknown, ephemeral?: unknown}} action */
  const checkAction = (path, action) => {
    if (!ACTION_TYPES.includes(action.type)) {
      fail('invalid_action', path, 'Tipo de ação desconhecido.');
      return;
    }
    const needsTemplate = action.type === 'reply' || action.type === 'edit' || action.type === 'dm';
    if (needsTemplate) {
      if (typeof action.template !== 'string' || !TEMPLATE_NAME_PATTERN.test(action.template)) {
        fail('invalid_action', path, 'A ação precisa referenciar um template com nome válido.');
      }
    } else if (action.template !== undefined) {
      fail('invalid_action', path, 'A ação "delete" não aceita template.');
    }
    if (action.ephemeral !== undefined && (action.type !== 'reply' || typeof action.ephemeral !== 'boolean')) {
      fail('invalid_action', path, '"ephemeral" só é válido em ações do tipo reply, como booleano.');
    }
  };

  /** @param {string} path @param {string} customId */
  const checkCustomId = (path, customId) => {
    if (!checkLiteral(path, customId)) return;
    if (customId.length > L.customId || !CUSTOM_ID_PATTERN.test(customId)) {
      fail('invalid_custom_id', path, 'O custom_id precisa seguir kt:<tipo>:<id> com até 100 caracteres.');
    }
  };

  if (template.content !== undefined) checkText('content', template.content, L.content);

  if (template.embeds.length > L.embeds) {
    fail('too_many_embeds', 'embeds', `No máximo ${L.embeds} embeds por mensagem.`);
  }
  template.embeds.forEach((embed, index) => {
    const base = `embeds[${index}]`;
    let used = 0;
    if (embed.title !== undefined) used += checkText(`${base}.title`, embed.title, L.embedTitle);
    if (embed.description !== undefined) {
      used += checkText(`${base}.description`, embed.description, L.embedDescription);
    }
    if (embed.url !== undefined) checkUrl(`${base}.url`, embed.url);
    if (
      embed.color !== undefined &&
      (!Number.isInteger(embed.color) || embed.color < 0 || embed.color > 0xffffff)
    ) {
      fail('invalid_color', `${base}.color`, 'A cor precisa ser um inteiro entre 0 e 0xFFFFFF.');
    }
    if (embed.footer !== undefined) used += checkText(`${base}.footer.text`, embed.footer.text, L.footerText, true);
    if (embed.author !== undefined) {
      used += checkText(`${base}.author.name`, embed.author.name, L.authorName, true);
      if (embed.author.url !== undefined) checkUrl(`${base}.author.url`, embed.author.url);
    }
    const fields = embed.fields ?? [];
    if (fields.length > L.embedFields) {
      fail('too_many_fields', `${base}.fields`, `No máximo ${L.embedFields} campos por embed.`);
    }
    fields.forEach((field, fieldIndex) => {
      const path = `${base}.fields[${fieldIndex}]`;
      used += checkText(`${path}.name`, field.name, L.fieldName, true);
      used += checkText(`${path}.value`, field.value, L.fieldValue, true);
    });
    const hasContent =
      used > 0 || embed.url !== undefined || fields.length > 0 || embed.author !== undefined;
    if (!hasContent) fail('empty_embed', base, 'O embed está vazio.');
    embedTotal += used;
  });
  if (embedTotal > L.embedTotal) {
    fail('limit_exceeded', 'embeds', `Os embeds podem passar de ${L.embedTotal} caracteres somados.`);
  }

  if (template.components.length > L.componentRows) {
    fail('too_many_rows', 'components', `No máximo ${L.componentRows} linhas de componentes.`);
  }
  template.components.forEach((row, index) => {
    const base = `components[${index}]`;
    // O tipo já impede a mistura; a checagem cobre dados vindos de fora (JSON).
    if ('buttons' in row && 'menu' in row) {
      fail('mixed_row', base, 'Uma linha não pode ter botões e menu ao mesmo tempo.');
      return;
    }
    if (row.kind === 'buttons') {
      if (row.buttons.length === 0) fail('empty_row', base, 'A linha de botões está vazia.');
      if (row.buttons.length > L.buttonsPerRow) {
        fail('too_many_buttons', base, `No máximo ${L.buttonsPerRow} botões por linha.`);
      }
      row.buttons.forEach((button, buttonIndex) => {
        const path = `${base}.buttons[${buttonIndex}]`;
        checkText(`${path}.label`, button.label, L.buttonLabel, true);
        if (button.style === 'link') checkUrl(`${path}.url`, button.url);
        else {
          checkCustomId(`${path}.customId`, button.customId);
          if (button.action !== undefined) checkAction(`${path}.action`, button.action);
        }
      });
      return;
    }
    const { menu } = row;
    checkCustomId(`${base}.menu.customId`, menu.customId);
    if (menu.placeholder !== undefined) checkLiteral(`${base}.menu.placeholder`, menu.placeholder);
    if (menu.options.length === 0) fail('empty_row', base, 'O menu não tem opções.');
    if (menu.options.length > L.selectOptions) {
      fail('too_many_options', base, `No máximo ${L.selectOptions} opções por menu.`);
    }
    // Um menu tem um único custom_id (do Discord); hoje não é possível distinguir qual opção foi
    // escolhida só pelo custom_id. Até o roteador resolver isso, no máximo uma opção pode ter ação.
    let optionsWithAction = 0;
    menu.options.forEach((option, optionIndex) => {
      const path = `${base}.menu.options[${optionIndex}]`;
      for (const [part, text] of [['label', option.label], ['value', option.value], ['description', option.description]]) {
        if (text === undefined || !checkLiteral(`${path}.${part}`, text)) continue;
        if (text.length > L.selectOptionText || (part !== 'description' && text === '')) {
          fail('limit_exceeded', `${path}.${part}`, `O texto precisa ter de 1 a ${L.selectOptionText} caracteres.`);
        }
      }
      if (option.action !== undefined) {
        checkAction(`${path}.action`, option.action);
        optionsWithAction += 1;
      }
    });
    if (optionsWithAction > 1) {
      fail('invalid_action', `${base}.menu`, 'Por enquanto, no máximo uma opção do menu pode ter ação.');
    }
  });

  const hasBody =
    (template.content !== undefined && template.content.trim() !== '') ||
    template.embeds.length > 0 ||
    template.components.length > 0;
  if (!hasBody) fail('empty_message', '', 'A mensagem não tem conteúdo.');

  return errors;
}

/** Contagem de botões e menus de um template, para a cota do servidor.
 * @typedef {Object} TemplateUsage
 * @property {number} buttons
 * @property {number} menus
 */

/** @param {MessageTemplate} template @returns {TemplateUsage} */
export function countTemplateComponents(template) {
  const usage = { buttons: 0, menus: 0 };
  for (const row of template.components) {
    if (row.kind === 'buttons') usage.buttons += row.buttons.length;
    else usage.menus += 1;
  }
  return usage;
}

/** Uso atual de um servidor, somando todos os templates dele.
 * @typedef {TemplateUsage & {templates: number}} GuildUsage
 */

/**
 * Recusa quando o servidor já está no limite de templates, ou quando `adding`
 * (os componentes do template a salvar) estoura botões ou menus.
 * Botões e menus são contados separadamente. Não consulta banco.
 *
 * `isNewTemplate` (padrão `true`) distingue criação de edição: editar um
 * template existente não pode ser recusado só porque o servidor já está no
 * limite de templates, já que a edição não aumenta a contagem de templates.
 * @param {GuildUsage} currentCount
 * @param {import('./limits.js').GuildTemplateLimits} [limits]
 * @param {TemplateUsage} [adding]
 * @param {boolean} [isNewTemplate]
 * @returns {TemplateValidationError|null}
 */
export function checkGuildQuota(
  currentCount,
  limits = DEFAULT_GUILD_TEMPLATE_LIMITS,
  adding = { buttons: 0, menus: 0 },
  isNewTemplate = true,
) {
  if (isNewTemplate && currentCount.templates >= limits.maxTemplates) {
    return new TemplateValidationError('quota_exceeded', 'templates', `O servidor atingiu o limite de ${limits.maxTemplates} templates.`);
  }
  if (currentCount.buttons + adding.buttons > limits.maxButtons) {
    return new TemplateValidationError('quota_exceeded', 'buttons', `O servidor atingiu o limite de ${limits.maxButtons} botões.`);
  }
  if (currentCount.menus + adding.menus > limits.maxSelectMenus) {
    return new TemplateValidationError('quota_exceeded', 'menus', `O servidor atingiu o limite de ${limits.maxSelectMenus} menus.`);
  }
  return null;
}
