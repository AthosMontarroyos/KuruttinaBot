import { ButtonStyle, ComponentType } from 'discord.js';
import type { APIActionRowComponent, APIButtonComponent, APIEmbed } from 'discord.js';
import type { MessageTemplate, TemplateButton, TemplateEmbed } from '#bot/application/messages/template.js';
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
  if (embed.footer !== undefined) output.footer = { text: embed.footer.text };
  if (embed.author !== undefined) {
    output.author = embed.author.url === undefined
      ? { name: embed.author.name }
      : { name: embed.author.name, url: embed.author.url };
  }
  return output;
}

function toButton(button: TemplateButton): APIButtonComponent {
  if (button.style === 'link') {
    return { type: ComponentType.Button, style: ButtonStyle.Link, label: button.label, url: button.url };
  }
  return { type: ComponentType.Button, style: BUTTON_STYLES[button.style], label: button.label, custom_id: button.customId };
}

/**
 * Converte um template já renderizado no formato enviado ao Discord. Menus não são suportados.
 * Texto puro (sem embed nem componente) volta como string, como as falas já são enviadas hoje.
 */
export function toCommandReply(template: MessageTemplate): CommandReply {
  const components: APIActionRowComponent<APIButtonComponent>[] = template.components.map((row) => {
    if (row.kind === 'select') {
      throw new Error('toCommandReply: menu de seleção ainda não é suportado.');
    }
    return { type: ComponentType.ActionRow, components: row.buttons.map(toButton) };
  });
  if (template.embeds.length === 0 && components.length === 0 && template.content !== undefined) {
    return template.content;
  }
  const reply: Exclude<CommandReply, string> = { embeds: template.embeds.map(toEmbed) };
  if (template.content !== undefined) reply.content = template.content;
  if (components.length > 0) reply.components = components;
  return reply;
}
