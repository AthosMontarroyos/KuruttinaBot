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
 * @property {{text: string, iconUrl?: string}} [footer]
 * @property {{name: string, url?: string, iconUrl?: string}} [author]
 * @property {{url: string}} [thumbnail]
 * @property {{url: string}} [image]
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
 * Emoji mostrado no botão (opcional). Emoji padrão (unicode): só `name`, por exemplo `{ name: '😀' }`.
 * Emoji personalizado do servidor: `id` (snowflake) e `name` (nome cadastrado no servidor, letras,
 * números e `_`), com `animated` opcional, só junto de `id`. Variáveis `{...}` não valem em emoji.
 * @typedef {{name: string, id?: string, animated?: boolean}} TemplateButtonEmoji
 */

/**
 * Botão de link (`style: 'link'`, abre `url`) ou botão colorido (`customId`, com `action` opcional).
 * `component` (opcional, só em botão colorido) é o id inteiro de um Component de botão do servidor
 * (tabela `custom_buttons`): é ele que define a ação executada no clique. Botão de link não tem ação.
 * `emoji` (opcional, vale para os dois tipos) aparece ao lado do rótulo. Sem `emoji`, o rótulo é
 * obrigatório; com `emoji` válido, o rótulo pode ficar vazio (o Discord exige rótulo ou emoji).
 * @typedef {{style: 'link', label: string, url: string, emoji?: TemplateButtonEmoji}|{style: 'primary'|'secondary'|'success'|'danger', label: string, customId: string, action?: ComponentAction, component?: number, emoji?: TemplateButtonEmoji}} TemplateButton
 */

/**
 * Opção de um menu. `action` (legado, no máximo uma opção por menu) é a ação executada ao escolher a opção.
 * `componentOption` é a chave (`^[a-z0-9]{6,12}$`) de uma opção do Component de menu indicado em `menu.component`;
 * exige `menu.component` e não combina com `action`. `default: true` deixa a opção selecionada por padrão
 * (no máximo `maxValues` opções, ou 1 quando `maxValues` não existe). `emoji` segue as mesmas regras do emoji de botão.
 * @typedef {Object} TemplateSelectOption
 * @property {string} label
 * @property {string} value Único dentro do menu.
 * @property {string} [description]
 * @property {ComponentAction} [action]
 * @property {TemplateButtonEmoji} [emoji]
 * @property {boolean} [default]
 * @property {string} [componentOption]
 */

/**
 * Menu de seleção. `minValues` (0..25) e `maxValues` (1..25) limitam quantas opções o usuário escolhe;
 * com os dois, `minValues <= maxValues`, e `maxValues` não passa de `options.length`.
 * `component` (opcional) é o id inteiro de um Component de menu do servidor (tabela `custom_selects`): é ele
 * que define a ação do menu. Sem `component`, valem só as ações por opção (`action`).
 * @typedef {Object} TemplateSelectMenu
 * @property {string} customId
 * @property {string} [placeholder]
 * @property {number} [minValues]
 * @property {number} [maxValues]
 * @property {number} [component]
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
 * - `format: 'raw'`: sem escape, só para valores que o bot gera em formato fixo
 *   (ID, menção, URL, número); valor maior que `maxLength` vira `whenAbsent`.
 * - `image`: o valor é uma URL de imagem; pode ser usado sozinho (`{chave}`) nos
 *   campos de imagem do embed (miniatura, imagem, ícone do autor e do rodapé).
 * @typedef {Object} TemplateVariable
 * @property {string} name
 * @property {number} maxLength
 * @property {string} [whenAbsent]
 * @property {'escape'|'code'|'raw'} [format]
 * @property {boolean} [image]
 */

/**
 * @typedef {'empty_message'|'empty_embed'|'empty_text'|'too_many_embeds'|'too_many_fields'|'too_many_rows'|'too_many_buttons'|'too_many_options'|'empty_row'|'mixed_row'|'unknown_variable'|'unknown_emoji'|'invalid_color'|'invalid_emoji'|'invalid_variable'|'variable_not_allowed'|'invalid_url'|'invalid_custom_id'|'invalid_action'|'limit_exceeded'|'quota_exceeded'} TemplateErrorCode
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

/** Id de Component de botão: inteiro seguro maior ou igual a 1. O tipo de entrada é permissivo (dado de fora).
 * @param {unknown} value @returns {boolean} */
function isComponentId(value) {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 1;
}

/** Id de emoji personalizado: snowflake do Discord, sem zero à esquerda. */
const EMOJI_ID_PATTERN = /^[1-9][0-9]{16,19}$/u;
/** Nome de emoji personalizado cadastrado no servidor. */
const CUSTOM_EMOJI_NAME_PATTERN = /^[A-Za-z0-9_]{2,32}$/u;
/** Campos aceitos em `emoji`; qualquer outro é recusado. */
const EMOJI_KEYS = ['name', 'id', 'animated'];
/** Chave de uma opção de Component de menu: de 6 a 12 letras minúsculas ou dígitos. */
const COMPONENT_OPTION_KEY_PATTERN = /^[a-z0-9]{6,12}$/u;
/** Maior quantidade de opções escolhíveis em um menu (`minValues`/`maxValues`). */
const SELECT_VALUES_MAX = 25;

/** Quantidade de escolhas do menu: inteiro seguro entre `min` e 25. O tipo de entrada é permissivo.
 * @param {unknown} value @param {number} min @returns {value is number} */
function isSelectCount(value, min) {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= min && value <= SELECT_VALUES_MAX;
}

/** Motivo pelo qual o emoji do botão é inválido, ou `null` quando é válido. Nunca avalia variáveis.
 * O tipo de entrada é permissivo (dado vindo de fora, ainda não validado).
 * @param {unknown} emoji @returns {string|null} */
function emojiProblem(emoji) {
  if (typeof emoji !== 'object' || emoji === null || Array.isArray(emoji)) return 'O emoji precisa ser um objeto.';
  const prototype = Object.getPrototypeOf(emoji);
  if (prototype !== Object.prototype && prototype !== null) return 'O emoji precisa ser um objeto simples.';
  const extra = Object.keys(emoji).filter((key) => !EMOJI_KEYS.includes(key));
  if (extra.length > 0) return `O emoji aceita só os campos name, id e animated (sobra: ${extra.join(', ')}).`;
  const { name, id, animated } = /** @type {{name?: unknown, id?: unknown, animated?: unknown}} */ (emoji);
  if (typeof name !== 'string' || name.length < 1 || name.length > 32) {
    return 'O nome do emoji precisa ter de 1 a 32 caracteres.';
  }
  if (ANY_BRACES.test(name)) return 'Variáveis não são permitidas em emoji.';
  if (id !== undefined) {
    if (typeof id !== 'string' || !EMOJI_ID_PATTERN.test(id)) return 'O id do emoji personalizado precisa ser um snowflake do Discord.';
    if (!CUSTOM_EMOJI_NAME_PATTERN.test(name)) return 'O nome do emoji personalizado precisa ter de 2 a 32 letras, números ou _.';
  } else if (name.trim() === '') {
    return 'O emoji padrão precisa ter um caractere, não só espaços.';
  }
  if (animated !== undefined) {
    if (id === undefined) return '"animated" só é aceito junto de "id".';
    if (typeof animated !== 'boolean') return '"animated" precisa ser booleano.';
  }
  return null;
}

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
  const imageVariables = new Set(variables.filter((variable) => variable.image === true).map((variable) => variable.name));
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

  /** Imagem do embed: URL https literal ou exatamente `{variável de imagem}`.
   * @param {string} path @param {string} url */
  const checkImageUrl = (path, url) => {
    const token = extractVariables(url)[0];
    if (token !== undefined && token.raw === url) {
      if (token.key === null || !imageVariables.has(token.key)) {
        fail('variable_not_allowed', path, 'Só variáveis de imagem são permitidas neste campo.');
      }
      return;
    }
    checkUrl(path, url);
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
    if (embed.footer !== undefined) {
      used += checkText(`${base}.footer.text`, embed.footer.text, L.footerText, true);
      if (embed.footer.iconUrl !== undefined) checkImageUrl(`${base}.footer.iconUrl`, embed.footer.iconUrl);
    }
    if (embed.author !== undefined) {
      used += checkText(`${base}.author.name`, embed.author.name, L.authorName, true);
      if (embed.author.url !== undefined) checkUrl(`${base}.author.url`, embed.author.url);
      if (embed.author.iconUrl !== undefined) checkImageUrl(`${base}.author.iconUrl`, embed.author.iconUrl);
    }
    if (embed.thumbnail !== undefined) checkImageUrl(`${base}.thumbnail.url`, embed.thumbnail.url);
    if (embed.image !== undefined) checkImageUrl(`${base}.image.url`, embed.image.url);
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
      used > 0 || embed.url !== undefined || fields.length > 0 || embed.author !== undefined || embed.thumbnail !== undefined || embed.image !== undefined;
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
        // Emoji válido dispensa o rótulo (o Discord exige rótulo OU emoji); sem emoji, o rótulo segue obrigatório.
        const emojiError = button.emoji === undefined ? null : emojiProblem(button.emoji);
        const hasValidEmoji = button.emoji !== undefined && emojiError === null;
        checkText(`${path}.label`, button.label, L.buttonLabel, !hasValidEmoji);
        if (emojiError !== null) fail('invalid_emoji', `${path}.emoji`, emojiError);
        // `component` existe só no ramo colorido do tipo; a checagem lê pelo campo cru (dado de fora, não validado).
        const { component } = /** @type {{component?: unknown}} */ (button);
        if (button.style === 'link') {
          checkUrl(`${path}.url`, button.url);
          if (component !== undefined) fail('invalid_action', `${path}.component`, 'Botão de link não pode ter ação.');
        } else {
          checkCustomId(`${path}.customId`, button.customId);
          if (button.action !== undefined) checkAction(`${path}.action`, button.action);
          if (component !== undefined && !isComponentId(component)) {
            fail('invalid_action', `${path}.component`, 'O componente precisa ser um número inteiro positivo.');
          }
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
    // Campos novos do menu são lidos pelo campo cru (dado de fora, não validado).
    const { minValues, maxValues, component: menuComponent } = /** @type {{minValues?: unknown, maxValues?: unknown, component?: unknown}} */ (menu);
    if (minValues !== undefined && !isSelectCount(minValues, 0)) {
      fail('invalid_action', `${base}.menu.minValues`, 'O mínimo de opções precisa ser um inteiro de 0 a 25.');
    }
    if (maxValues !== undefined && !isSelectCount(maxValues, 1)) {
      fail('invalid_action', `${base}.menu.maxValues`, 'O máximo de opções precisa ser um inteiro de 1 a 25.');
    }
    if (isSelectCount(minValues, 0) && isSelectCount(maxValues, 1) && minValues > maxValues) {
      fail('invalid_action', `${base}.menu.minValues`, 'O mínimo de opções não pode ser maior que o máximo.');
    }
    if (isSelectCount(maxValues, 1) && maxValues > menu.options.length) {
      fail('invalid_action', `${base}.menu.maxValues`, 'O máximo de opções não pode passar do número de opções do menu.');
    }
    if (menuComponent !== undefined && !isComponentId(menuComponent)) {
      fail('invalid_action', `${base}.menu.component`, 'O componente precisa ser um número inteiro positivo.');
    }

    // Um menu tem um único custom_id (do Discord); hoje não é possível distinguir qual opção foi
    // escolhida só pelo custom_id. Até o roteador resolver isso, no máximo uma opção pode ter ação.
    let optionsWithAction = 0;
    let defaultOptions = 0;
    /** @type {Set<string>} */
    const values = new Set();
    menu.options.forEach((option, optionIndex) => {
      const path = `${base}.menu.options[${optionIndex}]`;
      for (const [part, text] of [['label', option.label], ['value', option.value], ['description', option.description]]) {
        if (text === undefined || !checkLiteral(`${path}.${part}`, text)) continue;
        if (text.length > L.selectOptionText || (part !== 'description' && text === '')) {
          fail('limit_exceeded', `${path}.${part}`, `O texto precisa ter de 1 a ${L.selectOptionText} caracteres.`);
        }
      }
      if (typeof option.value === 'string') {
        if (values.has(option.value)) fail('invalid_action', `${path}.value`, 'Duas opções têm o mesmo valor.');
        values.add(option.value);
      }
      if (option.action !== undefined) {
        checkAction(`${path}.action`, option.action);
        optionsWithAction += 1;
      }
      // Mesma regra do emoji de botão: emoji válido, ou erro `invalid_emoji` no path da opção.
      const emojiError = option.emoji === undefined ? null : emojiProblem(option.emoji);
      if (emojiError !== null) fail('invalid_emoji', `${path}.emoji`, emojiError);

      const { default: isDefault, componentOption } = /** @type {{default?: unknown, componentOption?: unknown}} */ (option);
      if (isDefault !== undefined && typeof isDefault !== 'boolean') {
        fail('invalid_action', `${path}.default`, '"default" precisa ser booleano.');
      } else if (isDefault === true) {
        defaultOptions += 1;
      }
      if (componentOption !== undefined) {
        if (option.action !== undefined) {
          fail('invalid_action', `${path}.componentOption`, 'Uma opção não pode ter ação e chave de componente ao mesmo tempo.');
        }
        if (menuComponent === undefined) {
          fail('invalid_action', `${path}.componentOption`, 'Escolha a ação do menu antes de vincular a opção.');
        } else if (typeof componentOption !== 'string' || !COMPONENT_OPTION_KEY_PATTERN.test(componentOption)) {
          fail('invalid_action', `${path}.componentOption`, 'A chave da opção precisa ter de 6 a 12 letras minúsculas ou números.');
        }
      }
    });
    if (optionsWithAction > 1) {
      fail('invalid_action', `${base}.menu`, 'Por enquanto, no máximo uma opção do menu pode ter ação.');
    }
    // Sem `maxValues`, o usuário escolhe uma opção: o limite de padrões é 1. Com `maxValues` inválido, o erro acima já cobre.
    const defaultLimit = maxValues === undefined ? 1 : maxValues;
    if (isSelectCount(defaultLimit, 1) && defaultOptions > defaultLimit) {
      fail('invalid_action', `${base}.menu`, 'O menu tem mais opções padrão do que o máximo de escolhas.');
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
