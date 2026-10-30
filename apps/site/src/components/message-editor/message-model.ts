
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
  /** Linhas de componentes por mensagem; mesmo valor de `componentRows` em limits.js. */
  actionRows: 5,
  /** Texto de um botão; mesmo valor de `buttonLabel` em limits.js. */
  buttonLabel: 80,
  /** Botões por linha; mesmo valor de `buttonsPerRow` em limits.js. */
  buttonsPerRow: 5,
  /** Opções por menu de seleção; mesmo valor de `selectOptions` em limits.js. */
  selectOptions: 25,
  /** Texto de uma opção (rótulo e descrição); mesmo valor de `selectOptionText` em limits.js. */
  selectOptionText: 100,
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

/** Botões de uma linha de botões, ou opções de uma linha de menu; `null` quando a linha não é desses tipos ou não traz a lista. */
export function rowItems(row: unknown): unknown[] | null {
  const data = record(row);
  if (data.kind === 'buttons' && Array.isArray(data.buttons)) return data.buttons;
  if (data.kind === 'select') {
    const options = record(data.menu).options;
    if (Array.isArray(options)) return options;
  }
  return null;
}

const ID_CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789';

/** `length` caracteres `[a-z0-9]` aleatórios. */
function randomId(length: number): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => ID_CHARS.charAt(byte % ID_CHARS.length)).join('');
}

/** Id do menu de seleção no Discord: `kt:s:` seguido de 8 caracteres `[a-z0-9]`. */
export function newSelectCustomId(): string {
  return `kt:s:${randomId(8)}`;
}

/** Valor de uma opção de menu: `o` seguido de 7 caracteres `[a-z0-9]`, diferente de `taken`. */
export function newOptionValue(taken: readonly string[]): string {
  let value = `o${randomId(7)}`;
  while (taken.includes(value)) value = `o${randomId(7)}`;
  return value;
}

/**
 * Menu de seleção com `customId` e `value` de cada opção: gera o que faltar ou repete (JSON antigo ou escrito à mão),
 * sem mexer no resto. Outras linhas passam como estão.
 */
function withSelectIds(row: unknown): unknown {
  const data = record(row);
  if (data.kind !== 'select') return row;
  const menu = record(data.menu);
  const customId = text(menu.customId) === '' ? newSelectCustomId() : text(menu.customId);
  if (!Array.isArray(menu.options)) return { ...data, menu: { ...menu, customId } };
  const values: string[] = [];
  const options = menu.options.map((item) => {
    const option = record(item);
    let value = text(option.value);
    if (value === '' || values.includes(value)) value = newOptionValue(values);
    values.push(value);
    return { ...option, value };
  });
  return { ...data, menu: { ...menu, customId, options } };
}

/** Linha que vai para o modelo: a pendente e a de botões ou menu sem itens ficam de fora; as demais passam como estão. */
export function isSavedRow(row: unknown): boolean {
  if (record(row).kind === 'pending') return false;
  const items = rowItems(row);
  return items === null || items.length > 0;
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
    components: Array.isArray(data.components) ? data.components.map(withSelectIds) : [],
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
    components: state.components.filter(isSavedRow),
  };
}