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
  type GuildTemplateLimits,
} from './limits.js';

export interface TemplateEmbedField {
  name: string;
  value: string;
  inline?: boolean;
}

export interface TemplateEmbed {
  title?: string;
  description?: string;
  url?: string;
  fields?: TemplateEmbedField[];
  footer?: { text: string };
  author?: { name: string; url?: string };
  /** Cor da barra lateral, como `0x2b2d31`: inteiro entre 0 e 0xFFFFFF. */
  color?: number;
}

export type TemplateButton =
  | { style: 'link'; label: string; url: string }
  | { style: 'primary' | 'secondary' | 'success' | 'danger'; label: string; customId: string };

export interface TemplateSelectOption {
  label: string;
  value: string;
  description?: string;
}

export interface TemplateSelectMenu {
  customId: string;
  placeholder?: string;
  options: TemplateSelectOption[];
}

export type TemplateRow =
  | { kind: 'buttons'; buttons: TemplateButton[] }
  | { kind: 'select'; menu: TemplateSelectMenu };

export interface MessageTemplate {
  content?: string;
  embeds: TemplateEmbed[];
  components: TemplateRow[];
}

/**
 * Variável declarada: `maxLength` é o tamanho máximo do valor já escapado.
 * - `whenAbsent`: texto confiável do catálogo usado quando o valor não foi
 *   fornecido ou ficou vazio após a limpeza. Não passa por escape.
 * - `format`: `'escape'` (padrão) escapa Markdown e menções; `'code'` limpa o
 *   valor e o envolve em crase (o Markdown não é processado dentro do code span).
 */
export interface TemplateVariable {
  name: string;
  maxLength: number;
  whenAbsent?: string;
  format?: 'escape' | 'code';
}

export type TemplateErrorCode =
  | 'empty_message'
  | 'empty_embed'
  | 'empty_text'
  | 'too_many_embeds'
  | 'too_many_fields'
  | 'too_many_rows'
  | 'too_many_buttons'
  | 'too_many_options'
  | 'empty_row'
  | 'mixed_row'
  | 'unknown_variable'
  | 'unknown_emoji'
  | 'invalid_color'
  | 'invalid_variable'
  | 'variable_not_allowed'
  | 'invalid_url'
  | 'invalid_custom_id'
  | 'limit_exceeded'
  | 'quota_exceeded';

/** Erro de validação com código estável; a mensagem é neutra (falas ao usuário ficam fora daqui). */
export class TemplateValidationError extends Error {
  readonly code: TemplateErrorCode;
  readonly path: string;

  constructor(code: TemplateErrorCode, path: string, message: string) {
    super(message);
    this.name = 'TemplateValidationError';
    this.code = code;
    this.path = path;
  }
}

const CUSTOM_ID_PATTERN = /^kt:[a-z][a-z0-9_]*:[A-Za-z0-9_-]+$/u;
const ANY_BRACES = /[{}]/u;

/**
 * Valida o template considerando o pior caso: cada variável ocupa o `maxLength`
 * declarado. Devolve todos os erros encontrados; lista vazia significa válido.
 */
export function validateTemplate(
  template: MessageTemplate,
  variables: readonly TemplateVariable[],
): TemplateValidationError[] {
  const errors: TemplateValidationError[] = [];
  const declared = new Map(variables.map((variable) => [variable.name, variable.maxLength]));
  let embedTotal = 0;

  const fail = (code: TemplateErrorCode, path: string, message: string): void => {
    errors.push(new TemplateValidationError(code, path, message));
  };

  /** Valida um texto com variáveis e devolve o tamanho de pior caso. */
  const checkText = (path: string, text: string, max: number, required = false): number => {
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

  /** Valor literal (URL, custom_id, opção de menu): variável é proibida. */
  const checkLiteral = (path: string, text: string): boolean => {
    if (ANY_BRACES.test(text)) {
      fail('variable_not_allowed', path, 'Variáveis não são permitidas neste campo.');
      return false;
    }
    return true;
  };

  const checkUrl = (path: string, url: string): void => {
    if (!checkLiteral(path, url)) return;
    let valid = false;
    try {
      valid = new URL(url).protocol === 'https:';
    } catch {
      valid = false;
    }
    if (!valid) fail('invalid_url', path, 'A URL precisa ser https:// válida.');
  };

  const checkCustomId = (path: string, customId: string): void => {
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
        else checkCustomId(`${path}.customId`, button.customId);
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
    menu.options.forEach((option, optionIndex) => {
      const path = `${base}.menu.options[${optionIndex}]`;
      for (const [part, text] of [['label', option.label], ['value', option.value], ['description', option.description]] as const) {
        if (text === undefined || !checkLiteral(`${path}.${part}`, text)) continue;
        if (text.length > L.selectOptionText || (part !== 'description' && text === '')) {
          fail('limit_exceeded', `${path}.${part}`, `O texto precisa ter de 1 a ${L.selectOptionText} caracteres.`);
        }
      }
    });
  });

  const hasBody =
    (template.content !== undefined && template.content.trim() !== '') ||
    template.embeds.length > 0 ||
    template.components.length > 0;
  if (!hasBody) fail('empty_message', '', 'A mensagem não tem conteúdo.');

  return errors;
}

/** Contagem de botões e menus de um template, para a cota do servidor. */
export interface TemplateUsage {
  buttons: number;
  menus: number;
}

export function countTemplateComponents(template: MessageTemplate): TemplateUsage {
  const usage: TemplateUsage = { buttons: 0, menus: 0 };
  for (const row of template.components) {
    if (row.kind === 'buttons') usage.buttons += row.buttons.length;
    else usage.menus += 1;
  }
  return usage;
}

/** Uso atual de um servidor, somando todos os templates dele. */
export interface GuildUsage extends TemplateUsage {
  templates: number;
}

/**
 * Recusa quando o servidor já está no limite de templates, ou quando `adding`
 * (os componentes do template a salvar) estoura botões ou menus.
 * Botões e menus são contados separadamente. Não consulta banco.
 */
export function checkGuildQuota(
  currentCount: GuildUsage,
  limits: GuildTemplateLimits = DEFAULT_GUILD_TEMPLATE_LIMITS,
  adding: TemplateUsage = { buttons: 0, menus: 0 },
): TemplateValidationError | null {
  if (currentCount.templates >= limits.maxTemplates) {
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
