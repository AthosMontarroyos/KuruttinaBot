import { COMMAND_TOPICS } from '@kuruttina/command-catalog';
import type { CatalogCommand } from '@kuruttina/command-catalog';
import type { APIEmbed, APIEmbedField } from 'discord.js';
import { withEmojis } from './responses.js';
import type { CommandReply } from './types.js';

const COLOR = 0xf08db4;
const FIELD_LIMIT = 1024;
const INTRO = 'Estes são os comandos que posso fazer por você. Use **/help comando** para ver os detalhes.';
const FOOTER = 'Também respondo a k! no lugar da /.';
const NOT_FOUND = 'Não encontrei esse comando. Use **/help** para ver a lista.';

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

/** Resposta do `/help`: lista geral, detalhe de um comando ou aviso de não encontrado. Comandos de equipe nunca saem. */
export function buildHelpReply(
  catalog: readonly CatalogCommand[],
  query: string | undefined,
  emojis: { book: string; search: string },
): CommandReply {
  const visible = catalog.filter((command) => command.topic !== 'dev');
  const normalized = query === undefined ? '' : normalizeQuery(query);
  if (normalized === '') return listReply(visible, emojis);

  const matches = visible.filter((command) => matchesQuery(command, normalized));
  const [only] = matches;
  if (matches.length === 0) return withEmojis(emojis.search, NOT_FOUND);
  if (matches.length === 1 && only !== undefined) return detailReply(only, emojis);
  return listReply(matches, emojis);
}
