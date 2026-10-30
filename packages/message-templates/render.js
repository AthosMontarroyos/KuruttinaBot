/**
 * Extração de variáveis e renderização de templates.
 *
 * Nada é avaliado: `{chave}` é só uma busca em tabela. Valores interpolados
 * são sempre escapados e truncados no `maxLength` declarado.
 */

import { TemplateValidationError } from './template.js';

const BRACES = /\{([^{}]*)\}/gu;
const KEY_PATTERN = /^[a-z]+(\.[a-z]+)*$/u;
const ZERO_WIDTH_SPACE = '​';
const MARKDOWN_SPECIAL = new Set([...'*_~`|>\\[]()#']);

/**
 * @typedef {Object} VariableToken
 * @property {string} raw Texto original, com chaves.
 * @property {string|null} key Chave no formato válido, ou `null` quando o conteúdo entre chaves não é uma chave.
 * @property {number} start
 */

/** Lista tudo o que está entre chaves; conteúdo fora do formato vem com `key: null`.
 * @param {string} text @returns {VariableToken[]} */
export function extractVariables(text) {
  return [...text.matchAll(BRACES)].map((match) => {
    const inner = match[1] ?? '';
    return {
      raw: match[0],
      /** @type {string|null} */
      key: KEY_PATTERN.test(inner) ? inner : null,
      start: match.index,
    };
  });
}

/**
 * Escapa Markdown e neutraliza menções, truncando em `maxLength` caracteres do
 * resultado já escapado (sem cortar no meio de uma sequência de escape).
 * @param {string} value @param {number} maxLength @returns {string}
 */
export function escapeUserValue(value, maxLength) {
  const chars = [...value];
  let output = '';
  for (let index = 0; index < chars.length; index += 1) {
    const char = /** @type {string} */ (chars[index]);
    const next = chars[index + 1];
    let unit = char;
    if (MARKDOWN_SPECIAL.has(char)) unit = `\\${char}`;
    else if (char === '@') unit = `@${ZERO_WIDTH_SPACE}`;
    else if (char === '<' && (next === '@' || next === '#' || next === '&')) unit = `<${ZERO_WIDTH_SPACE}`;
    if (output.length + unit.length > maxLength) break;
    output += unit;
  }
  return output;
}

const MAX_CODE_LENGTH = 200;

/**
 * Formato `code`: tira crases, junta espaços em sequência, faz `trim` e corta em
 * 200 caracteres (ou menos, se `maxLength` deixar menos espaço que as duas
 * crases). Devolve vazio quando nada sobra; quem chama aplica `whenAbsent`.
 * Não escapa Markdown nem menções: dentro de code span nada é processado.
 * @param {string} value @param {number} maxLength @returns {string}
 */
function cleanForCode(value, maxLength) {
  const limit = Math.min(MAX_CODE_LENGTH, Math.max(0, maxLength - 2));
  return value.replaceAll('`', '').replace(/\s+/gu, ' ').trim().slice(0, limit);
}

/**
 * @param {string} text
 * @param {ReadonlyMap<string, import('./template.js').TemplateVariable>} declared
 * @param {Readonly<Record<string, string>>} values
 * @returns {string}
 */
function fillText(text, declared, values) {
  return text.replace(BRACES, (raw, inner) => {
    const variable = KEY_PATTERN.test(inner) ? declared.get(inner) : undefined;
    if (variable === undefined) return raw;
    const value = Object.hasOwn(values, inner) ? /** @type {string} */ (values[inner]) : '';
    if (variable.format === 'code') {
      const cleaned = cleanForCode(value, variable.maxLength);
      if (cleaned !== '') return `\`${cleaned}\``;
      return variable.whenAbsent === undefined ? '' : `\`${variable.whenAbsent}\``;
    }
    const escaped = escapeUserValue(value, variable.maxLength);
    return escaped === '' ? (variable.whenAbsent ?? '') : escaped;
  });
}

/**
 * Renderiza um template já validado por `validateTemplate`. Variável ausente em
 * `values` vira texto vazio; chave não declarada permanece como texto literal.
 * URL, custom_id e opções de menu nunca recebem variáveis.
 * @param {import('./template.js').MessageTemplate} template
 * @param {readonly import('./template.js').TemplateVariable[]} variables
 * @param {Readonly<Record<string, string>>} values
 * @returns {import('./template.js').MessageTemplate}
 */
export function renderTemplate(template, variables, values) {
  const declared = new Map(variables.map((variable) => [variable.name, variable]));
  /** @param {string} text @returns {string} */
  const fill = (text) => fillText(text, declared, values);

  /** @param {import('./template.js').TemplateEmbed} embed @returns {import('./template.js').TemplateEmbed} */
  const renderEmbed = (embed) => {
    /** @type {import('./template.js').TemplateEmbed} */
    const output = {};
    if (embed.title !== undefined) output.title = fill(embed.title);
    if (embed.description !== undefined) output.description = fill(embed.description);
    if (embed.url !== undefined) output.url = embed.url;
    if (embed.color !== undefined) output.color = embed.color;
    if (embed.fields !== undefined) {
      output.fields = embed.fields.map((field) => ({ ...field, name: fill(field.name), value: fill(field.value) }));
    }
    if (embed.footer !== undefined) output.footer = { ...embed.footer, text: fill(embed.footer.text) };
    if (embed.author !== undefined) output.author = { ...embed.author, name: fill(embed.author.name) };
    if (embed.thumbnail !== undefined) output.thumbnail = embed.thumbnail;
    if (embed.image !== undefined) output.image = embed.image;
    return output;
  };

  /** @param {import('./template.js').TemplateButton} button @returns {import('./template.js').TemplateButton} */
  const renderButton = (button) => ({ ...button, label: fill(button.label) });

  /** @param {import('./template.js').TemplateRow} row @returns {import('./template.js').TemplateRow} */
  const renderRow = (row) => (row.kind === 'buttons'
    ? { kind: 'buttons', buttons: row.buttons.map(renderButton) }
    : { kind: 'select', menu: structuredClone(row.menu) });

  /** @type {import('./template.js').MessageTemplate} */
  const output = {
    embeds: template.embeds.map(renderEmbed),
    components: template.components.map(renderRow),
  };
  if (template.content !== undefined) output.content = fill(template.content);
  return output;
}

const EMOJI_TOKEN = /( ?)\{emoji\.([a-z]+(?:\.[a-z]+)*)\}( ?)/gu;

/**
 * Troca `{emoji.alias}` pelo valor já resolvido em `emojis` (alias -> texto).
 * Deve rodar ANTES de `renderTemplate`: o emoji não passa por escape e um valor
 * de usuário, interpolado depois, nunca vira token. Valor vazio remove o token
 * e um espaço vizinho (como `withEmojis`). Alias ausente lança `unknown_emoji`.
 * @param {import('./template.js').MessageTemplate} template
 * @param {Readonly<Record<string, string>>} emojis
 * @returns {import('./template.js').MessageTemplate}
 */
export function fillEmojis(template, emojis) {
  /** @param {string} text @param {string} path @returns {string} */
  const fill = (text, path) =>
    text.replace(EMOJI_TOKEN, (_raw, before, alias, after) => {
      if (!Object.hasOwn(emojis, alias)) {
        throw new TemplateValidationError('unknown_emoji', path, `Emoji não resolvido: {emoji.${alias}}.`);
      }
      const value = emojis[alias];
      if (value !== '') return `${before}${value}${after}`;
      return after === '' ? '' : before;
    });

  /** @param {import('./template.js').TemplateEmbed} embed @param {string} base @returns {import('./template.js').TemplateEmbed} */
  const fillEmbed = (embed, base) => {
    /** @type {import('./template.js').TemplateEmbed} */
    const output = { ...embed };
    if (embed.title !== undefined) output.title = fill(embed.title, `${base}.title`);
    if (embed.description !== undefined) output.description = fill(embed.description, `${base}.description`);
    if (embed.fields !== undefined) {
      output.fields = embed.fields.map((field, index) => ({
        ...field,
        name: fill(field.name, `${base}.fields[${index}].name`),
        value: fill(field.value, `${base}.fields[${index}].value`),
      }));
    }
    if (embed.footer !== undefined) output.footer = { ...embed.footer, text: fill(embed.footer.text, `${base}.footer.text`) };
    if (embed.author !== undefined) output.author = { ...embed.author, name: fill(embed.author.name, `${base}.author.name`) };
    return output;
  };

  /** @param {import('./template.js').TemplateRow} row @param {number} rowIndex @returns {import('./template.js').TemplateRow} */
  const fillRow = (row, rowIndex) => (row.kind === 'buttons'
    ? {
        kind: 'buttons',
        buttons: row.buttons.map((button, index) => ({
          ...button,
          label: fill(button.label, `components[${rowIndex}].buttons[${index}].label`),
        })),
      }
    : { kind: 'select', menu: structuredClone(row.menu) });

  /** @type {import('./template.js').MessageTemplate} */
  const output = {
    embeds: template.embeds.map((embed, index) => fillEmbed(embed, `embeds[${index}]`)),
    components: template.components.map(fillRow),
  };
  if (template.content !== undefined) output.content = fill(template.content, 'content');
  return output;
}
