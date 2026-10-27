/**
 * Extração de variáveis e renderização de templates.
 *
 * Nada é avaliado: `{chave}` é só uma busca em tabela. Valores interpolados
 * são sempre escapados e truncados no `maxLength` declarado.
 */

import {
  TemplateValidationError,
  type MessageTemplate,
  type TemplateButton,
  type TemplateEmbed,
  type TemplateVariable,
} from './template.js';

const BRACES = /\{([^{}]*)\}/gu;
const KEY_PATTERN = /^[a-z]+(\.[a-z]+)*$/u;
const ZERO_WIDTH_SPACE = '​';
const MARKDOWN_SPECIAL = new Set([...'*_~`|>\\[]()#']);

export interface VariableToken {
  /** Texto original, com chaves. */
  raw: string;
  /** Chave no formato válido, ou `null` quando o conteúdo entre chaves não é uma chave. */
  key: string | null;
  start: number;
}

/** Lista tudo o que está entre chaves; conteúdo fora do formato vem com `key: null`. */
export function extractVariables(text: string): VariableToken[] {
  return [...text.matchAll(BRACES)].map((match) => ({
    raw: match[0],
    key: KEY_PATTERN.test(match[1] ?? '') ? (match[1] as string) : null,
    start: match.index,
  }));
}

/**
 * Escapa Markdown e neutraliza menções, truncando em `maxLength` caracteres do
 * resultado já escapado (sem cortar no meio de uma sequência de escape).
 */
export function escapeUserValue(value: string, maxLength: number): string {
  const chars = [...value];
  let output = '';
  for (let index = 0; index < chars.length; index += 1) {
    const char = chars[index] as string;
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
 */
function cleanForCode(value: string, maxLength: number): string {
  const limit = Math.min(MAX_CODE_LENGTH, Math.max(0, maxLength - 2));
  return value.replaceAll('`', '').replace(/\s+/gu, ' ').trim().slice(0, limit);
}

function fillText(
  text: string,
  declared: ReadonlyMap<string, TemplateVariable>,
  values: Readonly<Record<string, string>>,
): string {
  return text.replace(BRACES, (raw, inner: string) => {
    const variable = KEY_PATTERN.test(inner) ? declared.get(inner) : undefined;
    if (variable === undefined) return raw;
    const value = Object.hasOwn(values, inner) ? (values[inner] as string) : '';
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
 */
export function renderTemplate(
  template: MessageTemplate,
  variables: readonly TemplateVariable[],
  values: Readonly<Record<string, string>>,
): MessageTemplate {
  const declared = new Map(variables.map((variable) => [variable.name, variable]));
  const fill = (text: string): string => fillText(text, declared, values);

  const renderEmbed = (embed: TemplateEmbed): TemplateEmbed => {
    const output: TemplateEmbed = {};
    if (embed.title !== undefined) output.title = fill(embed.title);
    if (embed.description !== undefined) output.description = fill(embed.description);
    if (embed.url !== undefined) output.url = embed.url;
    if (embed.color !== undefined) output.color = embed.color;
    if (embed.fields !== undefined) {
      output.fields = embed.fields.map((field) => ({ ...field, name: fill(field.name), value: fill(field.value) }));
    }
    if (embed.footer !== undefined) output.footer = { text: fill(embed.footer.text) };
    if (embed.author !== undefined) output.author = { ...embed.author, name: fill(embed.author.name) };
    return output;
  };

  const renderButton = (button: TemplateButton): TemplateButton => ({ ...button, label: fill(button.label) });

  const output: MessageTemplate = {
    embeds: template.embeds.map(renderEmbed),
    components: template.components.map((row) =>
      row.kind === 'buttons'
        ? { kind: 'buttons', buttons: row.buttons.map(renderButton) }
        : { kind: 'select', menu: structuredClone(row.menu) },
    ),
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
 */
export function fillEmojis(template: MessageTemplate, emojis: Readonly<Record<string, string>>): MessageTemplate {
  const fill = (text: string, path: string): string =>
    text.replace(EMOJI_TOKEN, (_raw, before: string, alias: string, after: string) => {
      if (!Object.hasOwn(emojis, alias)) {
        throw new TemplateValidationError('unknown_emoji', path, `Emoji não resolvido: {emoji.${alias}}.`);
      }
      const value = emojis[alias] as string;
      if (value !== '') return `${before}${value}${after}`;
      return after === '' ? '' : before;
    });

  const fillEmbed = (embed: TemplateEmbed, base: string): TemplateEmbed => {
    const output: TemplateEmbed = { ...embed };
    if (embed.title !== undefined) output.title = fill(embed.title, `${base}.title`);
    if (embed.description !== undefined) output.description = fill(embed.description, `${base}.description`);
    if (embed.fields !== undefined) {
      output.fields = embed.fields.map((field, index) => ({
        ...field,
        name: fill(field.name, `${base}.fields[${index}].name`),
        value: fill(field.value, `${base}.fields[${index}].value`),
      }));
    }
    if (embed.footer !== undefined) output.footer = { text: fill(embed.footer.text, `${base}.footer.text`) };
    if (embed.author !== undefined) output.author = { ...embed.author, name: fill(embed.author.name, `${base}.author.name`) };
    return output;
  };

  const output: MessageTemplate = {
    embeds: template.embeds.map((embed, index) => fillEmbed(embed, `embeds[${index}]`)),
    components: template.components.map((row, rowIndex) =>
      row.kind === 'buttons'
        ? {
            kind: 'buttons',
            buttons: row.buttons.map((button, index) => ({
              ...button,
              label: fill(button.label, `components[${rowIndex}].buttons[${index}].label`),
            })),
          }
        : { kind: 'select', menu: structuredClone(row.menu) },
    ),
  };
  if (template.content !== undefined) output.content = fill(template.content, 'content');
  return output;
}
