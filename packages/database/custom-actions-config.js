/** Configuração das ações personalizadas: as funções de cada botão e as opções de cada menu de
 * seleção (cada opção com as suas funções). Vive em `bot_private.custom_button_functions`,
 * `bot_private.custom_select_options` e `bot_private.custom_select_option_functions`; o nome e a
 * versão ficam na linha do pai (`custom_buttons` e `custom_selects`, em `custom-actions.js`).
 * O site grava com concorrência otimista pela versão; o bot só lê.
 * Cada operação abre sua própria transação. Os tipos de função chegam validados pela aplicação
 * (`@kuruttina/message-templates/custom-functions`); o banco só confere o formato e os limites.
 * @typedef {{type: string, config: Record<string, unknown>}} ConfiguredFunction
 * @typedef {{id: number, name: string, version: number, functions: ConfiguredFunction[]}} ButtonConfig
 * @typedef {{key: string, label: string, functions: ConfiguredFunction[]}} SelectOptionConfig
 * @typedef {{id: number, name: string, version: number, keepSelection: boolean, options: SelectOptionConfig[]}} SelectConfig */

import { withGuildTransaction } from './transaction.js';

/** Grava as funções de um botão na ordem recebida (position = índice), dentro da transação do chamador.
 * @param {import('pg').PoolClient} client @param {string} guildId @param {number} buttonId @param {readonly ConfiguredFunction[]} functions */
async function insertButtonFunctions(client, guildId, buttonId, functions) {
  for (const [position, fn] of functions.entries()) {
    await client.query(
      'INSERT INTO bot_private.custom_button_functions (guild_id, button_id, position, type, config) VALUES ($1, $2, $3, $4, $5::jsonb)',
      [guildId, buttonId, position, fn.type, JSON.stringify(fn.config)],
    );
  }
}

/** Grava as opções de um menu na ordem recebida (com a chave de cada uma), e as funções de cada opção, dentro da transação do chamador.
 * @param {import('pg').PoolClient} client @param {string} guildId @param {number} selectId @param {readonly SelectOptionConfig[]} options */
async function insertSelectOptions(client, guildId, selectId, options) {
  for (const [position, option] of options.entries()) {
    const inserted = await client.query(
      'INSERT INTO bot_private.custom_select_options (guild_id, select_id, position, option_key, label) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      [guildId, selectId, position, option.key, option.label],
    );
    const optionId = Number(inserted.rows[0].id);
    for (const [fnPosition, fn] of option.functions.entries()) {
      await client.query(
        'INSERT INTO bot_private.custom_select_option_functions (guild_id, option_id, position, type, config) VALUES ($1, $2, $3, $4, $5::jsonb)',
        [guildId, optionId, fnPosition, fn.type, JSON.stringify(fn.config)],
      );
    }
  }
}

/** @param {{type: string, config: Record<string, unknown>}} row @returns {ConfiguredFunction} */
function toFunction(row) {
  return { type: row.type, config: row.config };
}

/** Lê a configuração de um botão do servidor, com as funções na ordem de execução.
 * @param {import('pg').PoolClient} client @param {string} guildId @param {number} id @returns {Promise<ButtonConfig|null>} */
export async function getButton(client, guildId, id) {
  return withGuildTransaction(client, guildId, async (tx) => {
    const button = await tx.query(
      'SELECT id, name, version FROM bot_private.custom_buttons WHERE guild_id = $1 AND id = $2',
      [guildId, id],
    );
    const row = button.rows[0];
    if (row === undefined) return null;
    const functions = await tx.query(
      'SELECT type, config FROM bot_private.custom_button_functions WHERE guild_id = $1 AND button_id = $2 ORDER BY position',
      [guildId, id],
    );
    return { id: Number(row.id), name: row.name, version: row.version, functions: functions.rows.map(toFunction) };
  });
}

/** Substitui as funções de um botão, com concorrência otimista pela versão.
 * A aplicação valida `functions` antes (limites e tipos); o banco recusa o que estourar 10 funções ou o formato.
 * @param {import('pg').PoolClient} client
 * @param {{guildId: string, id: number, expectedVersion: number, functions: readonly ConfiguredFunction[], actorId: string}} input
 * @returns {Promise<{ok: true, version: number}|{ok: false, code: 'not_found'|'conflict'}>} */
export async function saveButton(client, { guildId, id, expectedVersion, functions, actorId }) {
  return withGuildTransaction(client, guildId, async (tx) => {
    const result = await tx.query(
      `UPDATE bot_private.custom_buttons
          SET updated_by = $4, version = version + 1
        WHERE guild_id = $1 AND id = $2 AND version = $3
        RETURNING version`,
      [guildId, id, expectedVersion, actorId],
    );
    if (result.rows.length === 0) {
      const existing = await tx.query('SELECT 1 FROM bot_private.custom_buttons WHERE guild_id = $1 AND id = $2', [guildId, id]);
      return { ok: false, code: existing.rows.length === 0 ? 'not_found' : 'conflict' };
    }
    // Reescreve a lista inteira de funções: mais simples que calcular o diff, como em role-groups.js.
    await tx.query('DELETE FROM bot_private.custom_button_functions WHERE guild_id = $1 AND button_id = $2', [guildId, id]);
    await insertButtonFunctions(tx, guildId, id, functions);
    return { ok: true, version: result.rows[0].version };
  });
}

/** Lê a configuração de um menu do servidor: opções (com a chave de cada uma) na ordem do menu, e funções na ordem de cada opção.
 * @param {import('pg').PoolClient} client @param {string} guildId @param {number} id @returns {Promise<SelectConfig|null>} */
export async function getSelect(client, guildId, id) {
  return withGuildTransaction(client, guildId, async (tx) => {
    const select = await tx.query(
      'SELECT id, name, version, keep_selection FROM bot_private.custom_selects WHERE guild_id = $1 AND id = $2',
      [guildId, id],
    );
    const row = select.rows[0];
    if (row === undefined) return null;
    const options = await tx.query(
      'SELECT id, option_key, label FROM bot_private.custom_select_options WHERE guild_id = $1 AND select_id = $2 ORDER BY position',
      [guildId, id],
    );
    const functions = await tx.query(
      `SELECT fn.option_id, fn.type, fn.config
         FROM bot_private.custom_select_option_functions AS fn
         JOIN bot_private.custom_select_options AS opt ON opt.id = fn.option_id AND opt.guild_id = fn.guild_id
        WHERE fn.guild_id = $1 AND opt.select_id = $2
        ORDER BY fn.option_id, fn.position`,
      [guildId, id],
    );
    /** @type {Map<number, ConfiguredFunction[]>} */
    const functionsByOption = new Map();
    for (const fn of functions.rows) {
      const key = Number(fn.option_id);
      functionsByOption.set(key, [...(functionsByOption.get(key) ?? []), toFunction(fn)]);
    }
    return {
      id: Number(row.id),
      name: row.name,
      version: row.version,
      keepSelection: row.keep_selection,
      options: options.rows.map((option) => ({
        key: option.option_key,
        label: option.label,
        functions: functionsByOption.get(Number(option.id)) ?? [],
      })),
    };
  });
}

/** Substitui as opções (e as funções de cada opção) de um menu, com concorrência otimista pela versão.
 * A aplicação valida `options` antes (até 25 opções, chaves, rótulos e funções); o banco recusa o que estourar.
 * Chave repetida no mesmo menu é recusada pelo banco (23505) e nada é gravado; a aplicação confere antes.
 * @param {import('pg').PoolClient} client
 * @param {{guildId: string, id: number, expectedVersion: number, keepSelection: boolean, options: readonly SelectOptionConfig[], actorId: string}} input
 * @returns {Promise<{ok: true, version: number}|{ok: false, code: 'not_found'|'conflict'}>} */
export async function saveSelect(client, { guildId, id, expectedVersion, keepSelection, options, actorId }) {
  return withGuildTransaction(client, guildId, async (tx) => {
    const result = await tx.query(
      `UPDATE bot_private.custom_selects
          SET keep_selection = $4, updated_by = $5, version = version + 1
        WHERE guild_id = $1 AND id = $2 AND version = $3
        RETURNING version`,
      [guildId, id, expectedVersion, keepSelection, actorId],
    );
    if (result.rows.length === 0) {
      const existing = await tx.query('SELECT 1 FROM bot_private.custom_selects WHERE guild_id = $1 AND id = $2', [guildId, id]);
      return { ok: false, code: existing.rows.length === 0 ? 'not_found' : 'conflict' };
    }
    // Apagar as opções leva junto as funções delas (ON DELETE CASCADE); depois reinserir na ordem recebida.
    await tx.query('DELETE FROM bot_private.custom_select_options WHERE guild_id = $1 AND select_id = $2', [guildId, id]);
    await insertSelectOptions(tx, guildId, id, options);
    return { ok: true, version: result.rows[0].version };
  });
}
