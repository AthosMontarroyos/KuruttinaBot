import { COMMAND_TOPICS } from '@kuruttina/command-catalog';
import type { CatalogCommand } from '@kuruttina/command-catalog';
import {
  ButtonStyle,
  ComponentType,
  type APIActionRowComponent,
  type APIButtonComponent,
  type APIEmbed,
  type APIEmbedField,
  type APIMessageComponentEmoji,
} from 'discord.js';
import { withEmojis } from './responses.js';
import type { CommandReply } from './types.js';

const COLOR = 0xf08db4;
const FIELD_LIMIT = 1024;
const OVERVIEW_INTRO = 'Estes são os comandos que posso fazer por você.';
const OVERVIEW_HOW_TO = 'Use as setas para navegar ou abra um comando direto com `/help comando:ban`.\nTodos funcionam com `/` e com o prefixo `k!`.';
const EMPTY_INTRO = 'Não há comandos para mostrar agora.';
const NOT_FOUND = 'Não encontrei esse comando. Use **/help** para ver a lista.';
/** Nomes de comando mostrados na visão geral, por tópico. */
const PREVIEW_COMMANDS = 5;

/** Comandos por página de tópico. */
export const HELP_PAGE_SIZE = 6;

/**
 * Emojis do catálogo oficial usados na ajuda. Os tópicos usam o próprio id
 * (`public`, `utility`, `fun`, `mod`, `dev`) como chave.
 */
const HELP_EMOJI_NAMES = {
  book: 'book',
  search: 'search',
  usage: 'Documentation',
  example: 'Note',
  permission: 'lock',
  previous: 'left_arrow',
  next: 'right_arrow',
  public: 'home',
  utility: 'settings',
  fun: 'SpinningDancing',
  mod: 'moderation',
  dev: 'developer',
} as const;

export type HelpEmojiKey = keyof typeof HELP_EMOJI_NAMES;
/** Textos já resolvidos pelo resolver (`<:nome:id>` ou a alternativa Unicode); chave ausente ou vazia some da resposta. */
export type HelpEmojis = Readonly<Partial<Record<HelpEmojiKey, string>>>;

/** Resolve todos os emojis da ajuda de uma vez, com o mesmo resolver (e cache) do comando. */
export async function resolveHelpEmojis(resolve: (name: string) => Promise<string>): Promise<HelpEmojis> {
  const entries = await Promise.all(
    Object.entries(HELP_EMOJI_NAMES).map(async ([key, name]) => [key, await resolve(name)] as const),
  );
  return Object.fromEntries(entries);
}

const HELP_CUSTOM_ID = /^kt:help:(\d{1,3}):(\d{15,25})$/u;

/** `custom_id` dos botões de navegação: `kt:help:<página>:<id de quem abriu>`. A página é o índice (0 = visão geral). */
export function helpCustomId(page: number, ownerId: string): string {
  return `kt:help:${page}:${ownerId}`;
}

/** Página e dono de um `custom_id` de navegação do `/help`, ou `null` para qualquer outro formato. */
export function parseHelpCustomId(customId: string): { page: number; ownerId: string } | null {
  const match = HELP_CUSTOM_ID.exec(customId);
  return match ? { page: Number(match[1]), ownerId: match[2] ?? '' } : null;
}

const CUSTOM_EMOJI = /^<(a?):([A-Za-z0-9_]{2,32}):(\d{15,25})>$/u;

/** Imagem grande de um emoji personalizado, para a miniatura do embed. Alternativa Unicode não tem imagem. */
function emojiImage(emoji: string | undefined): { url: string } | undefined {
  const match = emoji === undefined ? null : CUSTOM_EMOJI.exec(emoji);
  return match ? { url: `https://cdn.discordapp.com/emojis/${match[3]}.${match[1] === 'a' ? 'gif' : 'png'}?size=128` } : undefined;
}

/** Emoji de botão: o personalizado quando resolvido, senão a alternativa Unicode. */
function buttonEmoji(emoji: string | undefined, fallback: string): APIMessageComponentEmoji {
  const match = emoji === undefined ? null : CUSTOM_EMOJI.exec(emoji);
  if (match) return { id: match[3] ?? '', name: match[2] ?? '', animated: match[1] === 'a' };
  return { name: emoji !== undefined && emoji !== '' ? emoji : fallback };
}

/** Texto precedido do emoji, quando ele existe. */
function mark(emoji: string | undefined, text: string): string {
  return emoji === undefined || emoji === '' ? text : `${emoji} ${text}`;
}

/** Remove `/` ou `k!` inicial, minúsculas e espaços colapsados. Vazio significa lista. */
function normalizeQuery(query: string): string {
  return query.trim().toLowerCase().replace(/^(?:\/|k!)/u, '').trim().replace(/\s+/gu, ' ');
}

/** Valor de field de até 1024 caracteres; o excedente vira "…". */
function truncateField(value: string): string {
  return value.length <= FIELD_LIMIT ? value : `${value.slice(0, FIELD_LIMIT - 1)}…`;
}

/** Junta linhas em um field de até 1024 caracteres; as que não cabem saem e a última linha vira "…". */
function fitField(lines: readonly string[]): string {
  const whole = lines.join('\n');
  if (whole.length <= FIELD_LIMIT) return whole;
  const kept: string[] = [];
  let length = 0;
  for (const line of lines) {
    const next = length + (kept.length === 0 ? 0 : 1) + line.length;
    // Reserva espaço para "\n…".
    if (next + 2 > FIELD_LIMIT) break;
    kept.push(line);
    length = next;
  }
  while (kept.at(-1) === '') kept.pop();
  return [...kept, '…'].join('\n');
}

function matchesQuery(command: CatalogCommand, query: string): boolean {
  return command.id.toLowerCase() === query
    || command.slash.slice(1).toLowerCase() === query
    || command.prefix.slice(2).toLowerCase() === query
    || command.slash.toLowerCase().startsWith(`/${query} `);
}

type TopicInfo = (typeof COMMAND_TOPICS)[number];

function topicEmoji(emojis: HelpEmojis, topic: TopicInfo): string | undefined {
  return emojis[topic.id];
}

function topicOf(command: CatalogCommand): TopicInfo | undefined {
  return COMMAND_TOPICS.find((topic) => topic.id === command.topic);
}

function countLabel(count: number): string {
  return `${count} ${count === 1 ? 'comando' : 'comandos'}`;
}

/** Lista agrupada por tópico, para uma busca que casa vários comandos. */
function listReply(commands: readonly CatalogCommand[], emojis: HelpEmojis): CommandReply {
  const fields: APIEmbedField[] = COMMAND_TOPICS.flatMap((topic) => {
    const lines = commands
      .filter((command) => command.topic === topic.id)
      .map((command) => `\`${command.slash}\` · ${command.description}`);
    return lines.length === 0 ? [] : [{ name: mark(topicEmoji(emojis, topic), topic.label), value: fitField(lines), inline: false }];
  });
  return {
    content: withEmojis(emojis.book ?? '', 'Encontrei estes comandos. Use **/help comando** para ver os detalhes.'),
    embeds: [{ color: COLOR, fields, footer: { text: 'Também respondo a k! no lugar da /.' } }],
  };
}

/** Detalhe de um comando: como usar, permissão e exemplos. */
function detailReply(command: CatalogCommand, emojis: HelpEmojis): CommandReply {
  const topic = topicOf(command);
  const icon = topic === undefined ? undefined : topicEmoji(emojis, topic);
  const fields: APIEmbedField[] = [
    { name: mark(emojis.usage, 'Como usar'), value: `\`${command.slash}\`\n\`${command.prefix}\``, inline: true },
  ];
  if (command.permissions.length > 0) {
    fields.push({ name: mark(emojis.permission, 'Permissão'), value: `**${command.permissions.join(', ')}**`, inline: true });
  }
  if (command.examples.length > 0) {
    const lines = command.examples.flatMap((example, index) => [
      ...(index === 0 ? [] : ['']),
      `\`${example.slash}\``,
      `\`${example.prefix}\``,
    ]);
    fields.push({ name: mark(emojis.example, 'Exemplos'), value: fitField(lines), inline: false });
  }
  const embed: APIEmbed = {
    color: COLOR,
    title: mark(icon, command.slash),
    description: command.description,
    fields,
    ...(emojiImage(icon) ? { thumbnail: emojiImage(icon) as { url: string } } : {}),
    footer: { text: `Tópico: ${topic?.label ?? command.topic} · /help mostra todos os comandos` },
  };
  return {
    content: withEmojis(emojis.book ?? '', `Aqui está o que sei sobre **${command.slash}**.`),
    embeds: [embed],
  };
}

interface TopicGroup {
  readonly topic: TopicInfo;
  readonly commands: readonly CatalogCommand[];
}

/** Tópicos com comandos públicos, na ordem de `COMMAND_TOPICS`. `dev` nunca entra. */
function topicGroups(catalog: readonly CatalogCommand[]): TopicGroup[] {
  const groups: TopicGroup[] = [];
  for (const topic of COMMAND_TOPICS) {
    if (topic.id === 'dev') continue;
    const commands = catalog.filter((command) => command.topic === topic.id);
    if (commands.length > 0) groups.push({ topic, commands });
  }
  return groups;
}

type HelpPage =
  | { readonly kind: 'overview' }
  | {
      readonly kind: 'topic';
      readonly group: TopicGroup;
      readonly part: number;
      readonly parts: number;
      readonly commands: readonly CatalogCommand[];
    };

/** Visão geral seguida dos blocos de `HELP_PAGE_SIZE` comandos de cada tópico. */
function helpPages(groups: readonly TopicGroup[]): HelpPage[] {
  const pages: HelpPage[] = [{ kind: 'overview' }];
  for (const group of groups) {
    const parts = Math.ceil(group.commands.length / HELP_PAGE_SIZE);
    for (let index = 0; index < parts; index++) {
      pages.push({
        kind: 'topic',
        group,
        part: index + 1,
        parts,
        commands: group.commands.slice(index * HELP_PAGE_SIZE, (index + 1) * HELP_PAGE_SIZE),
      });
    }
  }
  return pages;
}

function clampPage(page: number, total: number): number {
  if (!Number.isFinite(page)) return 0;
  return Math.min(Math.max(Math.trunc(page), 0), total - 1);
}

/** Amostra dos comandos de um tópico para a visão geral: os primeiros nomes e quantos faltam. */
function commandPreview(commands: readonly CatalogCommand[]): string {
  const shown = commands.slice(0, PREVIEW_COMMANDS).map((command) => `\`${command.slash}\``).join(' ');
  const hidden = commands.length - PREVIEW_COMMANDS;
  return hidden > 0 ? `${shown} e mais ${hidden}` : shown;
}

function overviewEmbed(groups: readonly TopicGroup[], emojis: HelpEmojis, footer: string): APIEmbed {
  const image = emojiImage(emojis.book);
  return {
    color: COLOR,
    title: mark(emojis.book, 'Central de ajuda'),
    description: groups.length === 0 ? EMPTY_INTRO : OVERVIEW_HOW_TO,
    fields: groups.map(({ topic, commands }) => ({
      name: mark(topicEmoji(emojis, topic), topic.label),
      value: truncateField(`**${countLabel(commands.length)}** · ${topic.description}\n${commandPreview(commands)}`),
      inline: false,
    })),
    ...(image ? { thumbnail: image } : {}),
    footer: { text: footer },
  };
}

/** Uma linha por informação do comando: descrição, prefixo, permissão e o primeiro exemplo. */
function commandField(command: CatalogCommand, emojis: HelpEmojis): APIEmbedField {
  const lines = [command.description, mark(emojis.usage, `\`${command.prefix}\``)];
  if (command.permissions.length > 0) lines.push(mark(emojis.permission, command.permissions.join(', ')));
  const [example] = command.examples;
  if (example !== undefined) lines.push(mark(emojis.example, `\`${example.slash}\``));
  return { name: command.slash, value: truncateField(lines.join('\n')), inline: false };
}

function topicEmbed(page: Extract<HelpPage, { kind: 'topic' }>, emojis: HelpEmojis, footer: string): APIEmbed {
  const { group, part, parts, commands } = page;
  const icon = topicEmoji(emojis, group.topic);
  const image = emojiImage(icon);
  return {
    color: COLOR,
    title: mark(icon, parts > 1 ? `${group.topic.label} (parte ${part}/${parts})` : group.topic.label),
    description: `*${group.topic.description}*`,
    fields: commands.map((command) => commandField(command, emojis)),
    ...(image ? { thumbnail: image } : {}),
    footer: { text: footer },
  };
}

/** Linha de navegação: anterior, indicador (desabilitado) e próximo. */
function navigationRow(index: number, total: number, ownerId: string, emojis: HelpEmojis): APIActionRowComponent<APIButtonComponent> {
  return {
    type: ComponentType.ActionRow,
    components: [
      {
        type: ComponentType.Button,
        style: ButtonStyle.Secondary,
        custom_id: helpCustomId(index - 1, ownerId),
        emoji: buttonEmoji(emojis.previous, '⬅️'),
        disabled: index === 0,
      },
      {
        type: ComponentType.Button,
        style: ButtonStyle.Secondary,
        custom_id: 'kt:help:noop',
        label: `${index + 1}/${total}`,
        disabled: true,
      },
      {
        type: ComponentType.Button,
        style: ButtonStyle.Secondary,
        custom_id: helpCustomId(index + 1, ownerId),
        emoji: buttonEmoji(emojis.next, '➡️'),
        disabled: index === total - 1,
      },
    ],
  };
}

/**
 * Uma página do `/help` sem query: índice 0 é a visão geral; as seguintes são
 * os comandos de cada tópico. `page` fora do intervalo vai para o limite mais próximo.
 * Os botões só existem com `ownerId`, que é quem pode navegar.
 */
export function buildHelpPage(
  catalog: readonly CatalogCommand[],
  page: number,
  ownerId: string | undefined,
  emojis: HelpEmojis,
): CommandReply {
  const groups = topicGroups(catalog);
  const pages = helpPages(groups);
  const total = pages.length;
  const index = clampPage(page, total);
  const current: HelpPage = pages[index] ?? { kind: 'overview' };
  const position = `Página ${index + 1}/${total}`;
  const book = emojis.book ?? '';

  let content: string;
  let embed: APIEmbed;
  if (current.kind === 'overview') {
    content = withEmojis(book, groups.length === 0 ? EMPTY_INTRO : OVERVIEW_INTRO);
    embed = overviewEmbed(groups, emojis, `${position} · Setas para navegar`);
  } else {
    content = withEmojis(book, `Tópico **${current.group.topic.label}**.`);
    embed = topicEmbed(current, emojis, `${position} · ${current.group.topic.label}`);
  }

  const reply: CommandReply = { content, embeds: [embed] };
  if (ownerId === undefined) return reply;
  return { ...reply, components: [navigationRow(index, total, ownerId, emojis)] };
}

/**
 * Resposta do `/help`: sem query, a página de navegação; com query, detalhe de um
 * comando, lista dos que casam ou aviso de não encontrado (sem botões). Comandos de equipe nunca saem.
 */
export function buildHelpReply(
  catalog: readonly CatalogCommand[],
  query: string | undefined,
  emojis: HelpEmojis,
  ownerId?: string,
): CommandReply {
  const visible = catalog.filter((command) => command.topic !== 'dev');
  const normalized = query === undefined ? '' : normalizeQuery(query);
  if (normalized === '') return buildHelpPage(catalog, 0, ownerId, emojis);

  const matches = visible.filter((command) => matchesQuery(command, normalized));
  const [only] = matches;
  if (matches.length === 0) return withEmojis(emojis.search ?? '', NOT_FOUND);
  if (matches.length === 1 && only !== undefined) return detailReply(only, emojis);
  return listReply(matches, emojis);
}
