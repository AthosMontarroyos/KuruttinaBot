import pg from 'pg';
import { databaseDiagnostic, DatabaseSettingsError } from './diagnostics.js';
import * as templates from './templates.js';
import * as deliveries from './deliveries.js';
import * as folders from './folders.js';
import * as roleGroups from './role-groups.js';
import * as customActions from './custom-actions.js';
import * as customActionsConfig from './custom-actions-config.js';
export { readDatabaseConfig } from './config.js';
/** @typedef {'creator'|'dev'} StaffRole */
/** @typedef {{devGuildId: string, environment: 'development'|'production'}} BotSettings */
const snowflake = /^[1-9]\d{16,19}$/u;
/** @param {unknown} value */
export function isDiscordId(value) {
  return typeof value === 'string' && snowflake.test(value) && BigInt(value) <= 18446744073709551615n;
}
/** @param {import('pg').PoolConfig} config @param {'development'|'production'} environment @param {(diagnostic: import('./diagnostics.js').DatabaseDiagnostic) => void} [onError] */
export function createDatabase(config, environment, onError = () => {}) {
  const pool = new pg.Pool({ ...config, max: 3, idleTimeoutMillis: 30000, connectionTimeoutMillis: 5000 });
  pool.on('error', (error) => onError(databaseDiagnostic(error, 'pool', 'idle')));
  let closing = false;
  // Bound admitted work as well as connections, so an outage cannot grow the queue indefinitely.
  let pending = 0;
  /** @template T @param {(client: import('pg').PoolClient) => Promise<T>} work @param {import('./diagnostics.js').DatabaseOperation} operation */
  async function connection(work, operation) {
    if (closing || pending >= 12) throw new Error('Database unavailable');
    pending++;
    let client;
    try {
      client = await pool.connect();
      return await work(client);
    } catch (error) {
      onError(databaseDiagnostic(error, operation, client ? 'query' : 'connect'));
      client?.release(true);
      client = undefined;
      throw error;
    } finally {
      client?.release();
      pending--;
    }
  }
  /** @param {import('pg').PoolClient} client @returns {Promise<BotSettings>} */
  async function settings(client) {
    const result = await client.query('SELECT dev_guild_id, environment FROM bot_private.bot_settings WHERE singleton = true');
    const row = result.rows[0];
    if (result.rows.length === 0) throw new DatabaseSettingsError('SETTINGS_MISSING');
    if (result.rows.length !== 1 || !isDiscordId(row?.dev_guild_id)) throw new DatabaseSettingsError('SETTINGS_INVALID');
    if (row.environment !== environment) throw new DatabaseSettingsError('ENVIRONMENT_MISMATCH');
    return { devGuildId: row.dev_guild_id, environment };
  }
  return {
    getSettings: () => connection(settings, 'get_settings'),
    /** @param {string} userId @param {string} guildId @returns {Promise<StaffRole|null>} */
    getStaffRole: async (userId, guildId) => {
      if (!isDiscordId(userId) || !isDiscordId(guildId)) return null;
      return connection(async (client) => {
        await client.query('BEGIN READ ONLY');
        try {
          await client.query("SELECT set_config('app.discord_user_id', $1, true), set_config('app.guild_id', $2, true)", [userId, guildId]);
          const result = await client.query(
            `SELECT staff.role FROM bot_private.bot_staff AS staff
             JOIN bot_private.bot_settings AS settings ON settings.singleton = true
             WHERE staff.user_id = $1 AND staff.active = true
               AND settings.dev_guild_id = $2 AND settings.environment = $3`,
            [userId, guildId, environment],
          );
          const role = result.rows[0]?.role;
          if (result.rows.length > 1 || (role !== undefined && role !== 'creator' && role !== 'dev')) {
            throw new Error('Invalid staff role');
          }
          await client.query('COMMIT');
          return role ?? null;
        } catch (error) {
          try { await client.query('ROLLBACK'); } catch { /* connection() destroys the failed connection. */ }
          throw error;
        }
      }, 'get_staff_role');
    },
    // Única leitura de bot_staff concedida a kuruttina_site: a função devolve só o user_id do dev ativo.
    /** @returns {Promise<string|null>} */
    getActiveDevUserId: () => connection(async (client) => {
      const result = await client.query('SELECT bot_private.active_dev_user_id() AS user_id');
      const userId = result.rows[0]?.user_id;
      if (userId == null) return null;
      if (!isDiscordId(userId)) throw new Error('Invalid dev user id');
      return userId;
    }, 'get_active_dev'),
    close: async () => { closing = true; await pool.end(); },
    // Persistência de templates de mensagem (etapa 1C); cada chamada abre e fecha sua própria transação.
    templates: {
      /** @param {string} guildId @param {{limit?: number, after?: string}} [options] */
      list: (guildId, options) => connection((client) => templates.list(client, guildId, options), 'list_templates'),
      /** @param {string} guildId @param {string} name */
      get: (guildId, name) => connection((client) => templates.get(client, guildId, name), 'get_template'),
      /** Leitura do bot: só `message_templates`, sem o join de pastas do site.
       * @param {string} guildId @param {string} name */
      getContent: (guildId, name) => connection((client) => templates.getContent(client, guildId, name), 'get_template'),
      /** @param {string} guildId */
      usage: (guildId) => connection((client) => templates.usage(client, guildId), 'template_usage'),
      /** @param {{guildId: string, name: string, content: unknown, buttonCount: number, menuCount: number, components?: readonly import('./templates.js').ComponentInput[], actorId: string, folderId?: number|null|undefined}} input */
      create: (input) => connection((client) => templates.create(client, input), 'create_template'),
      /** @param {{guildId: string, name: string, expectedVersion: number, content: unknown, buttonCount: number, menuCount: number, components?: readonly import('./templates.js').ComponentInput[], actorId: string, folderId?: number|null|undefined}} input */
      update: (input) => connection((client) => templates.update(client, input), 'update_template'),
      /** @param {string} guildId @param {string} name */
      remove: (guildId, name) => connection((client) => templates.remove(client, guildId, name), 'remove_template'),
      /** @param {string} guildId @param {string} customId */
      findComponent: (guildId, customId) => connection((client) => templates.findComponent(client, guildId, customId), 'find_component'),
      /** @param {string} guildId @param {string} name @param {number|null} folderId */
      move: (guildId, name, folderId) => connection((client) => templates.move(client, guildId, name, folderId), 'move_template'),
    },
    // Pastas de templates de mensagem; só o site administra.
    folders: {
      /** @param {{guildId: string, name: string}} input */
      create: (input) => connection((client) => folders.create(client, input), 'create_folder'),
      /** @param {string} guildId */
      list: (guildId) => connection((client) => folders.list(client, guildId), 'list_folders'),
      /** @param {{guildId: string, id: number, name: string}} input */
      rename: (input) => connection((client) => folders.rename(client, input), 'rename_folder'),
      /** @param {string} guildId @param {number} id */
      remove: (guildId, id) => connection((client) => folders.remove(client, guildId, id), 'remove_folder'),
    },
    // Grupos de cargos: o site administra; o bot lê com `list` (RLS por servidor, sem escrita).
    roleGroups: {
      /** @param {string} guildId */
      list: (guildId) => connection((client) => roleGroups.list(client, guildId), 'list_role_groups'),
      /** @param {{guildId: string, name: string, roleIds: readonly string[], actorId: string}} input */
      create: (input) => connection((client) => roleGroups.create(client, input), 'create_role_group'),
      /** @param {{guildId: string, id: number, expectedVersion: number, name: string, roleIds: readonly string[], actorId: string}} input */
      update: (input) => connection((client) => roleGroups.update(client, input), 'update_role_group'),
      /** @param {string} guildId @param {number} id */
      remove: (guildId, id) => connection((client) => roleGroups.remove(client, guildId, id), 'remove_role_group'),
    },
    // Ações personalizadas (botões e menus de seleção); o site administra e o bot só lê (RLS por servidor).
    customActions: {
      /** @param {import('./custom-actions.js').CustomActionKind} kind @param {string} guildId */
      list: (kind, guildId) => connection((client) => customActions.list(client, kind, guildId), 'list_custom_actions'),
      /** @param {{kind: import('./custom-actions.js').CustomActionKind, guildId: string, name: string, actorId: string}} input */
      create: (input) => connection((client) => customActions.create(client, input), 'create_custom_action'),
      /** Apaga a ação; com `rewriteTemplate` e `actorId`, desvincula os templates do servidor na mesma transação. @param {import('./custom-actions.js').CustomActionKind} kind @param {string} guildId @param {number} id @param {import('./custom-actions.js').RewriteTemplate} [rewriteTemplate] @param {string} [actorId] */
      remove: (kind, guildId, id, rewriteTemplate, actorId) =>
        connection((client) => customActions.remove(client, kind, guildId, id, rewriteTemplate, actorId), 'remove_custom_action'),
    },
    // Configuração das ações personalizadas (funções dos botões, opções dos menus); o site grava e o bot só lê.
    customActionsConfig: {
      /** @param {string} guildId @param {number} id */
      getButton: (guildId, id) => connection((client) => customActionsConfig.getButton(client, guildId, id), 'get_custom_button_config'),
      /** @param {{guildId: string, id: number, expectedVersion: number, functions: readonly import('./custom-actions-config.js').ConfiguredFunction[], actorId: string}} input */
      saveButton: (input) => connection((client) => customActionsConfig.saveButton(client, input), 'save_custom_button_config'),
      /** @param {string} guildId @param {number} id */
      getSelect: (guildId, id) => connection((client) => customActionsConfig.getSelect(client, guildId, id), 'get_custom_select_config'),
      /** @param {{guildId: string, id: number, expectedVersion: number, keepSelection: boolean, options: readonly import('./custom-actions-config.js').SelectOptionConfig[], actorId: string}} input */
      saveSelect: (input) => connection((client) => customActionsConfig.saveSelect(client, input), 'save_custom_select_config'),
    },
    // Fila de entrega de mensagens (etapa 1D); o bot consome sem filtro de servidor.
    deliveries: {
      /** @param {{guildId: string, channelId: string, templateName: string, requestedBy: string}} input */
      create: (input) => connection((client) => deliveries.create(client, input), 'create_delivery'),
      /** @param {number} [limit] */
      claimPending: (limit) => connection((client) => deliveries.claimPending(client, limit), 'claim_deliveries'),
      /** @param {number} id */
      markSent: (id) => connection((client) => deliveries.markSent(client, id), 'mark_delivery_sent'),
      /** @param {number} id @param {string} errorCode */
      markFailed: (id, errorCode) => connection((client) => deliveries.markFailed(client, id, errorCode), 'mark_delivery_failed'),
    },
  };
}
