import { ButtonStyle, ComponentType } from 'discord.js';
import type { APIActionRowComponent, APIButtonComponent, APIEmbed, APIMessageComponentEmoji, APIStringSelectComponent } from 'discord.js';
import type { MessageTemplate, TemplateButton, TemplateEmbed, TemplateSelectMenu } from '@kuruttina/message-templates';
import type { CommandReply } from '#bot/command-system/types.js';

/** Cor padrão dos embeds quando o template não define uma. */
const DEFAULT_EMBED_COLOR = 0x2b2d31;

const BUTTON_STYLES = {
  primary: ButtonStyle.Primary,
  secondary: ButtonStyle.Secondary,
  success: ButtonStyle.Success,
  danger: ButtonStyle.Danger,
} as const;

function toEmbed(embed: TemplateEmbed): APIEmbed {
  const output: APIEmbed = { color: embed.color ?? DEFAULT_EMBED_COLOR };
  if (embed.title !== undefined) output.title = embed.title;
  if (embed.description !== undefined) output.description = embed.description;
  if (embed.url !== undefined) output.url = embed.url;
  if (embed.fields !== undefined) {
    output.fields = embed.fields.map((field) => (
      field.inline === undefined
        ? { name: field.name, value: field.value }
        : { name: field.name, value: field.value, inline: field.inline }
    ));
  }
  if (embed.footer !== undefined) {
    output.footer = embed.footer.iconUrl === undefined
      ? { text: embed.footer.text }
      : { text: embed.footer.text, icon_url: embed.footer.iconUrl };
  }
  if (embed.author !== undefined) {
    output.author = { name: embed.author.name };
    if (embed.author.url !== undefined) output.author.url = embed.author.url;
    if (embed.author.iconUrl !== undefined) output.author.icon_url = embed.author.iconUrl;
  }
  if (embed.thumbnail !== undefined) output.thumbnail = { url: embed.thumbnail.url };
  if (embed.image !== undefined) output.image = { url: embed.image.url };
  return output;
}

/** Emoji do botão na forma da API; `id` e `animated` só entram quando definidos. */
function toEmoji(emoji: NonNullable<TemplateButton['emoji']>): APIMessageComponentEmoji {
  return {
    name: emoji.name,
    ...(emoji.id !== undefined ? { id: emoji.id } : {}),
    ...(emoji.animated !== undefined ? { animated: emoji.animated } : {}),
  };
}

type ColoredButton = Exclude<TemplateButton, { style: 'link' }>;

/** Limites do `custom_id` de botão com Component: sufixo até 40 caracteres, total até 100. */
const COMPONENT_SUFFIX_MAX = 40;
const CUSTOM_ID_MAX = 100;

/**
 * `custom_id` enviado ao Discord. Botão com `component` carrega o id do Component
 * (`kt:c:<id>-<sufixo>`), para o clique achar a configuração pelo próprio id. Sem
 * `component`, vale o `customId` do template, como antes.
 */
function toCustomId(button: ColoredButton, index: number): string {
  const componentId = button.component;
  if (componentId === undefined || !Number.isSafeInteger(componentId) || componentId < 1) return button.customId;
  const prefix = `kt:c:${componentId}-`;
  const tail = button.customId.slice(button.customId.lastIndexOf(':') + 1).replace(/[^A-Za-z0-9_-]/g, '');
  const maxSuffix = Math.min(COMPONENT_SUFFIX_MAX, CUSTOM_ID_MAX - prefix.length);
  const suffix = (tail === '' ? String(index) : tail).slice(0, maxSuffix);
  return `${prefix}${suffix}`;
}

function toButton(button: TemplateButton, index: number): APIButtonComponent {
  // Rótulo vazio, ou só espaços com emoji, não vai para a API.
  const omitLabel = button.label === '' || (button.label.trim() === '' && button.emoji !== undefined);
  const label = omitLabel ? {} : { label: button.label };
  const emoji = button.emoji === undefined ? {} : { emoji: toEmoji(button.emoji) };
  if (button.style === 'link') {
    return { type: ComponentType.Button, style: ButtonStyle.Link, ...label, ...emoji, url: button.url };
  }
  return { type: ComponentType.Button, style: BUTTON_STYLES[button.style], ...label, ...emoji, custom_id: toCustomId(button, index) };
}

/**
 * `custom_id` de menu enviado ao Discord. Menu com `component` carrega o id do Component
 * (`kt:s:<id>-<sufixo>`), para a escolha achar a configuração pelo próprio id. Sem `component`,
 * vale o `customId` do template. O sufixo é a parte depois do último `:`, sem o que não é
 * `[A-Za-z0-9_-]`; vazio vira `0`.
 */
function toSelectCustomId(menu: TemplateSelectMenu): string {
  const componentId = menu.component;
  if (componentId === undefined || !Number.isSafeInteger(componentId) || componentId < 1) return menu.customId;
  const tail = menu.customId.slice(menu.customId.lastIndexOf(':') + 1).replace(/[^A-Za-z0-9_-]/g, '');
  const suffix = (tail === '' ? '0' : tail).slice(0, COMPONENT_SUFFIX_MAX);
  return `kt:s:${componentId}-${suffix}`;
}

/**
 * Valor enviado ao Discord: com `componentOption`, `${chave}:${índice}` (a chave acha a opção
 * na escolha e o índice evita valores repetidos); sem ela, o `value` do template.
 */
function toSelectValue(option: TemplateSelectMenu['options'][number], index: number): string {
  return option.componentOption === undefined ? option.value : `${option.componentOption}:${index}`;
}

function toSelect(menu: TemplateSelectMenu): APIStringSelectComponent {
  return {
    type: ComponentType.StringSelect,
    custom_id: toSelectCustomId(menu),
    ...(menu.placeholder !== undefined ? { placeholder: menu.placeholder } : {}),
    ...(menu.minValues !== undefined ? { min_values: menu.minValues } : {}),
    ...(menu.maxValues !== undefined ? { max_values: menu.maxValues } : {}),
    options: menu.options.map((option, index) => ({
      label: option.label,
      value: toSelectValue(option, index),
      ...(option.description !== undefined ? { description: option.description } : {}),
      ...(option.emoji !== undefined ? { emoji: toEmoji(option.emoji) } : {}),
      ...(option.default === true ? { default: true } : {}),
    })),
  };
}

/**
 * Converte um template já renderizado no formato enviado ao Discord.
 * A ação de cada opção fica no banco; o menu enviado só carrega rótulo, valor e descrição.
 * Texto puro (sem embed nem componente) volta como string, como as falas já são enviadas hoje.
 */
export function toCommandReply(template: MessageTemplate): CommandReply {
  const components: APIActionRowComponent<APIButtonComponent | APIStringSelectComponent>[] = template.components.map((row) => {
    if (row.kind === 'select') {
      return { type: ComponentType.ActionRow, components: [toSelect(row.menu)] };
    }
    return { type: ComponentType.ActionRow, components: row.buttons.map((button, index) => toButton(button, index)) };
  });
  if (template.embeds.length === 0 && components.length === 0 && template.content !== undefined) {
    return template.content;
  }
  const reply: Exclude<CommandReply, string> = { embeds: template.embeds.map(toEmbed) };
  if (template.content !== undefined) reply.content = template.content;
  if (components.length > 0) reply.components = components;
  return reply;
}
