import { COMMAND_TOPICS } from '@kuruttina/command-catalog';
import type { CatalogCommand } from '@kuruttina/command-catalog';
import {
  ButtonStyle,
  ComponentType,
  type APIActionRowComponent,
  type APIButtonComponent,
  type APIEmbed,
  type APIEmbedField,
} from 'discord.js';
import { withEmojis } from './responses.js';
import type { CommandReply } from './types.js';

const COLOR = 0xf08db4;
const FIELD_LIMIT = 1024;
const INTRO = 'Estes são os comandos que posso fazer por você. Use **/help comando** para ver os detalhes.';
const OVERVIEW_INTRO = 'Estes são os comandos que posso fazer por você. Use as setas para navegar ou **/help comando** para ver os detalhes.';
const EMPTY_INTRO = 'Não há comandos para mostrar agora.';
const FOOTER = 'Também respondo a k! no lugar da /.';
const NOT_FOUND = 'Não encontrei esse comando. Use **/help** para ver a lista.';

/** Comandos por página de tópico. */
export const HELP_PAGE_SIZE = 6;

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

/** Remove `/` ou `k!` inicial, minúsculas e espaços colapsados. Vazio significa lista. */
function normalizeQuery(query: string): string {
  return query.trim().toLowerCase().replace(/^(?:\/|k!)/u, '').trim().replace(/\s+/gu, ' ');
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

/** Lista agrupada por tópico, na ordem de `COMMAND_TOPICS`. */
function listReply(commands: readonly CatalogCommand[], emojis: { book: string; search: string }): CommandReply {
  const fields: APIEmbedField[] = COMMAND_TOPICS.flatMap((topic) => {
    const lines = commands
      .filter((command) => command.topic === topic.id)
      .map((command) => `\`${command.slash}\` · ${command.description}`);
    return lines.length === 0 ? [] : [{ name: topic.label, value: fitField(lines), inline: false }];
  });
  return {
    content: withEmojis(emojis.book, INTRO),
    embeds: [{ color: COLOR, fields, footer: { text: FOOTER } }],
  };
}

/** Detalhe de um comando: como usar, exemplos e permissões quando houver. */
function detailReply(command: CatalogCommand, emojis: { book: string; search: string }): CommandReply {
  const fields: APIEmbedField[] = [
    { name: 'Como usar', value: `\`${command.slash}\`\n\`${command.prefix}\``, inline: false },
  ];
  if (command.examples.length > 0) {
    const lines = command.examples.flatMap((example, index) => [
      ...(index === 0 ? [] : ['']),
      `\`${example.slash}\``,
      `\`${example.prefix}\``,
    ]);
    fields.push({ name: 'Exemplos', value: fitField(lines), inline: false });
  }
  if (command.permissions.length > 0) {
    fields.push({ name: 'Permissão', value: `Você precisa de: **${command.permissions.join(', ')}**`, inline: false });
  }
  const embed: APIEmbed = {
    color: COLOR,
    title: command.slash,
    description: command.description,
    fields,
  };
  return {
    content: withEmojis(emojis.book, `Aqui está o que sei sobre **${command.slash}**.`),
    embeds: [embed],
  };
}

type TopicInfo = (typeof COMMAND_TOPICS)[number];

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

/** Valor de field de até 1024 caracteres; o excedente vira "…". */
function truncateField(value: string): string {
  return value.length <= FIELD_LIMIT ? value : `${value.slice(0, FIELD_LIMIT - 1)}…`;
}

function countLabel(count: number): string {
  return `${count} ${count === 1 ? 'comando' : 'comandos'}`;
}

function overviewEmbed(groups: readonly TopicGroup[], footer: string): APIEmbed {
  return {
    color: COLOR,
    title: 'Ajuda',
    fields: groups.map(({ topic, commands }) => ({
      name: topic.label,
      value: `${countLabel(commands.length)} · ${topic.description}`,
      inline: false,
    })),
    footer: { text: footer },
  };
}

function topicEmbed(page: Extract<HelpPage, { kind: 'topic' }>, footer: string): APIEmbed {
  const { group, part, parts, commands } = page;
  return {
    color: COLOR,
    title: parts > 1 ? `${group.topic.label} (parte ${part}/${parts})` : group.topic.label,
    description: group.topic.description,
    fields: commands.map((command) => ({
      name: command.slash,
      value: truncateField(`${command.description}\n\`${command.prefix}\``),
      inline: false,
    })),
    footer: { text: footer },
  };
}

/** Linha de navegação: anterior, indicador (desabilitado) e próximo. */
function navigationRow(index: number, total: number, ownerId: string): APIActionRowComponent<APIButtonComponent> {
  return {
    type: ComponentType.ActionRow,
    components: [
      {
        type: ComponentType.Button,
        style: ButtonStyle.Secondary,
        custom_id: helpCustomId(index - 1, ownerId),
        emoji: { name: '⬅️' },
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
        emoji: { name: '➡️' },
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
  emojis: { book: string },
): CommandReply {
  const groups = topicGroups(catalog);
  const pages = helpPages(groups);
  const total = pages.length;
  const index = clampPage(page, total);
  const current: HelpPage = pages[index] ?? { kind: 'overview' };
  const footer = `Página ${index + 1}/${total}`;

  let content: string;
  let embed: APIEmbed;
  if (current.kind === 'overview') {
    content = withEmojis(emojis.book, groups.length === 0 ? EMPTY_INTRO : OVERVIEW_INTRO);
    embed = overviewEmbed(groups, footer);
  } else {
    content = withEmojis(emojis.book, `Tópico **${current.group.topic.label}**.`);
    embed = topicEmbed(current, footer);
  }

  const reply: CommandReply = { content, embeds: [embed] };
  if (ownerId === undefined) return reply;
  return { ...reply, components: [navigationRow(index, total, ownerId)] };
}

/**
 * Resposta do `/help`: sem query, a página de navegação; com query, detalhe de um
 * comando, lista dos que casam ou aviso de não encontrado (sem botões). Comandos de equipe nunca saem.
 */
export function buildHelpReply(
  catalog: readonly CatalogCommand[],
  query: string | undefined,
  emojis: { book: string; search: string },
  ownerId?: string,
): CommandReply {
  const visible = catalog.filter((command) => command.topic !== 'dev');
  const normalized = query === undefined ? '' : normalizeQuery(query);
  if (normalized === '') return buildHelpPage(catalog, 0, ownerId, emojis);

  const matches = visible.filter((command) => matchesQuery(command, normalized));
  const [only] = matches;
  if (matches.length === 0) return withEmojis(emojis.search, NOT_FOUND);
  if (matches.length === 1 && only !== undefined) return detailReply(only, emojis);
  return listReply(matches, emojis);
}
