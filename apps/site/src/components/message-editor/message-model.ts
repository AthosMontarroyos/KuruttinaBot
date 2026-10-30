
// Limites do Discord, os mesmos de DISCORD_MESSAGE_LIMITS em packages/message-templates/limits.js.
export const LIMITS = {
  content: 2000,
  embeds: 10,
  embedTitle: 256,
  embedDescription: 4096,
  embedFields: 25,
  fieldName: 256,
  fieldValue: 1024,
  footerText: 2048,
  authorName: 256,
};

export type EditorField = { key: number; name: string; value: string; inline: boolean };
export type EditorEmbed = {
  key: number;
  color: string;
  authorName: string;
  authorUrl: string;
  authorIconUrl: string;
  title: string;
  url: string;
  description: string;
  fields: EditorField[];
  footer: string;
  footerIconUrl: string;
  thumbnailUrl: string;
  imageUrl: string;
};
export type EditorState = { content: string; embeds: EditorEmbed[]; components: unknown[] };

let nextKey = 1;

export function takeKey(): number {
  return nextKey++;
}

// A fonte do site não tem itálico; o Discord usa uma fonte do sistema, que tem.
export const DISCORD_FONT = '"gg sans", "Segoe UI", "Noto Sans", "Helvetica Neue", Helvetica, Arial, sans-serif';

export function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export function record(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function colorToHex(value: unknown): string {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 0xffffff ? `#${value.toString(16).padStart(6, '0')}` : '';
}

export function emptyEmbed(): EditorEmbed {
  return { key: takeKey(), color: '', authorName: '', authorUrl: '', authorIconUrl: '', title: '', url: '', description: '', fields: [], footer: '', footerIconUrl: '', thumbnailUrl: '', imageUrl: '' };
}

/** Lê o JSON do modelo; `null` quando não dá para representar no editor visual. */
export function parseState(json: string): EditorState | null {
  let raw: unknown = {};
  if (json.trim() !== '') {
    try {
      raw = JSON.parse(json);
    } catch {
      return null;
    }
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
  const data = raw as Record<string, unknown>;
  return {
    content: text(data.content),
    embeds: (Array.isArray(data.embeds) ? data.embeds : []).map((item) => {
      const embed = record(item);
      const author = record(embed.author);
      const footer = record(embed.footer);
      return {
        key: takeKey(),
        color: colorToHex(embed.color),
        authorName: text(author.name),
        authorUrl: text(author.url),
        authorIconUrl: text(author.iconUrl),
        title: text(embed.title),
        url: text(embed.url),
        description: text(embed.description),
        fields: (Array.isArray(embed.fields) ? embed.fields : []).map((entry) => {
          const field = record(entry);
          return { key: takeKey(), name: text(field.name), value: text(field.value), inline: field.inline === true };
        }),
        footer: text(footer.text),
        footerIconUrl: text(footer.iconUrl),
        thumbnailUrl: text(record(embed.thumbnail).url),
        imageUrl: text(record(embed.image).url),
      };
    }),
    components: Array.isArray(data.components) ? data.components : [],
  };
}

/** Campo ainda vazio é só a vaga sugerida: não vai para o modelo. */
export function hasText(field: EditorField): boolean {
  return field.name !== '' || field.value !== '';
}

export function toTemplate(state: EditorState): Record<string, unknown> {
  return {
    ...(state.content !== '' ? { content: state.content } : {}),
    embeds: state.embeds.map((embed) => ({
      ...(embed.title !== '' ? { title: embed.title } : {}),
      ...(embed.description !== '' ? { description: embed.description } : {}),
      ...(embed.url !== '' ? { url: embed.url } : {}),
      ...(embed.color !== '' ? { color: Number.parseInt(embed.color.slice(1), 16) } : {}),
      ...(embed.authorName !== '' ? { author: { name: embed.authorName, ...(embed.authorUrl !== '' ? { url: embed.authorUrl } : {}), ...(embed.authorIconUrl !== '' ? { iconUrl: embed.authorIconUrl } : {}) } } : {}),
      ...(embed.thumbnailUrl !== '' ? { thumbnail: { url: embed.thumbnailUrl } } : {}),
      ...(embed.imageUrl !== '' ? { image: { url: embed.imageUrl } } : {}),
      ...(embed.fields.some(hasText) ? { fields: embed.fields.filter(hasText).map((field) => ({ name: field.name, value: field.value, ...(field.inline ? { inline: true } : {}) })) } : {}),
      ...(embed.footer !== '' ? { footer: { text: embed.footer, ...(embed.footerIconUrl !== '' ? { iconUrl: embed.footerIconUrl } : {}) } } : {}),
    })),
    components: state.components,
  };
}