/**
 * Tópicos e formato do catálogo público de commands. O `/help` lê a lista
 * viva do bot (`buildCatalog`). O site lê `catalog.js`, que o build do site e o
 * `npm run typecheck` regeneram sozinhos a partir dos módulos de
 * `apps/bot/src/commands/` (`scripts/commands-catalog.mjs`); não edite à mão.
 */

/**
 * @typedef {'public' | 'mod' | 'dev' | 'fun' | 'utility'} CommandTopic
 * @typedef {{ readonly slash: string, readonly prefix: string }} CommandExample
 * @typedef {{
 *   readonly id: string,
 *   readonly topic: CommandTopic,
 *   readonly slash: string,
 *   readonly prefix: string,
 *   readonly description: string,
 *   readonly examples: readonly CommandExample[],
 *   readonly permissions: readonly string[],
 * }} CatalogCommand
 */

/** Ordem de exibição dos tópicos; `dev` é interno e nunca aparece no catálogo público. */
export const COMMAND_TOPICS = /** @type {const} */ ([
  { id: 'public', label: 'Público', description: 'Comandos abertos a todos.' },
  { id: 'utility', label: 'Utilidades', description: 'Ferramentas e consultas do dia a dia.' },
  { id: 'fun', label: 'Diversão', description: 'Comandos para brincar.' },
  { id: 'mod', label: 'Moderação', description: 'Exigem permissões de moderação no servidor.' },
  { id: 'dev', label: 'Equipe', description: 'Exclusivos da equipe de desenvolvimento.' },
]);

/** @type {readonly string[]} */
export const COMMAND_TOPIC_IDS = COMMAND_TOPICS.map((topic) => topic.id);

/** @param {unknown} value @returns {value is CommandTopic} */
export function isCommandTopic(value) {
  return typeof value === 'string' && COMMAND_TOPIC_IDS.includes(value);
}
