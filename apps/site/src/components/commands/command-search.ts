import { COMMAND_CATALOG } from '@kuruttina/command-catalog/catalog';
import { COMMAND_TOPICS } from '@kuruttina/command-catalog';

type CatalogCommand = (typeof COMMAND_CATALOG)[number];
type CommandTopic = (typeof COMMAND_TOPICS)[number];

/** Tópico interno da equipe: fica fora do catálogo público. */
const HIDDEN_TOPIC = 'dev';

/** Valor do filtro que mostra todos os tópicos. */
const ALL_TOPICS = 'todos';

type CommandGroup = { topic: CommandTopic; commands: CatalogCommand[] };

const publicCommands = COMMAND_CATALOG.filter((command) => command.topic !== HIDDEN_TOPIC);

/** Tópicos públicos que têm pelo menos um comando, na ordem do catálogo. */
const publicTopics = COMMAND_TOPICS.filter(
  (topic) => topic.id !== HIDDEN_TOPIC && publicCommands.some((command) => command.topic === topic.id),
);

/** Minúsculas e sem acento, para a busca ignorar caixa e acentuação. */
function normalizeSearch(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

function matchesTerms(command: CatalogCommand, topicLabel: string, terms: readonly string[]): boolean {
  const haystack = normalizeSearch([command.slash, command.prefix, command.description, topicLabel].join(' '));
  return terms.every((term) => haystack.includes(term));
}

/** Grupos por tópico após a busca e o filtro de tópico; grupos vazios saem da lista. */
function filterCommandGroups(query: string, topicId: string): CommandGroup[] {
  const terms = normalizeSearch(query).trim().split(/\s+/u).filter(Boolean);
  return publicTopics
    .filter((topic) => topicId === ALL_TOPICS || topic.id === topicId)
    .map((topic) => ({
      topic,
      commands: publicCommands.filter((command) => command.topic === topic.id && matchesTerms(command, topic.label, terms)),
    }))
    .filter((group) => group.commands.length > 0);
}

export { ALL_TOPICS, filterCommandGroups, publicTopics };
export type { CatalogCommand, CommandGroup };
