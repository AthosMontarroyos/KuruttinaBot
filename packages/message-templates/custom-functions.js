/**
 * Registro compartilhado das funções de botões e menus de seleção (ações personalizadas).
 * Módulo puro: o site valida o que o usuário envia e o bot confere o mesmo formato.
 */

import { TEMPLATE_NAME_PATTERN } from './template.js';

export const MAX_FUNCTIONS = 10;
export const MAX_OPTIONS = 25;
export const MAX_OPTION_LABEL = 100;
export const MAX_ROLES_PER_FUNCTION = 25;

const MAX_CONFIG_BYTES = 2048;
const SNOWFLAKE_PATTERN = /^[1-9][0-9]{16,19}$/u;

/** Tipo de campo do config: nome de template, canal de texto, canal de voz, lista de cargos ou booleano.
 * @typedef {'template'|'channel'|'voice_channel'|'roles'|'boolean'} FunctionFieldKind */

/** @typedef {{key: string, kind: FunctionFieldKind, label: string}} FunctionField */

/** @typedef {{label: string, description: string, fields: ReadonlyArray<FunctionField>}} FunctionType */

/** Valores referenciados pelo config de uma função, sem duplicatas.
 * @typedef {{templates: string[], channels: string[], voiceChannels: string[], roles: string[]}} FunctionReferences */

/** @typedef {{type: string, config: Record<string, unknown>}} CustomFunction */

/**
 * Catálogo de tipos na ordem do seletor "+". Único campo opcional: `ephemeral` (ausente vira false).
 * @type {Record<string, FunctionType>}
 */
const FUNCTION_TYPES = {
  send_message: {
    label: 'Enviar mensagem',
    description: 'Responde a quem clicou com um template.',
    fields: [
      { key: 'template', kind: 'template', label: 'Template' },
      { key: 'ephemeral', kind: 'boolean', label: 'Só quem clicou vê' },
    ],
  },
  send_channel_message: {
    label: 'Enviar mensagem em canal',
    description: 'Envia um template em um canal.',
    fields: [
      { key: 'template', kind: 'template', label: 'Template' },
      { key: 'channelId', kind: 'channel', label: 'Canal' },
    ],
  },
  edit_message: {
    label: 'Editar mensagem',
    description: 'Edita a mensagem do clique com um template.',
    fields: [{ key: 'template', kind: 'template', label: 'Template' }],
  },
  delete_message: {
    label: 'Apagar mensagem',
    description: 'Apaga a mensagem do clique.',
    fields: [],
  },
  dm_user: {
    label: 'Enviar DM',
    description: 'Envia um template no privado de quem clicou.',
    fields: [{ key: 'template', kind: 'template', label: 'Template' }],
  },
  move_users_in_voice: {
    label: 'Mover usuário na voz',
    description: 'Move quem clicou para um canal de voz.',
    fields: [{ key: 'channelId', kind: 'voice_channel', label: 'Canal de voz' }],
  },
  toggle_roles: {
    label: 'Alternar cargos',
    description: 'Dá o cargo se a pessoa não tem, tira se tem.',
    fields: [{ key: 'roleIds', kind: 'roles', label: 'Cargos' }],
  },
  add_roles: {
    label: 'Adicionar cargos',
    description: 'Dá os cargos a quem clicou.',
    fields: [{ key: 'roleIds', kind: 'roles', label: 'Cargos' }],
  },
  remove_roles: {
    label: 'Remover cargos',
    description: 'Tira os cargos de quem clicou.',
    fields: [{ key: 'roleIds', kind: 'roles', label: 'Cargos' }],
  },
  set_roles: {
    label: 'Definir cargos',
    description: 'Define os cargos de quem clicou como exatamente estes.',
    fields: [{ key: 'roleIds', kind: 'roles', label: 'Cargos' }],
  },
};

/** Congela o catálogo, inclusive as definições, os campos e a lista de campos de cada tipo.
 * @param {Record<string, FunctionType>} types
 * @returns {Readonly<Record<string, FunctionType>>} */
function freezeTypes(types) {
  for (const type of Object.values(types)) {
    for (const field of type.fields) Object.freeze(field);
    Object.freeze(type.fields);
    Object.freeze(type);
  }
  return Object.freeze(types);
}

/** @type {Readonly<Record<string, FunctionType>>} */
export const CUSTOM_FUNCTION_TYPES = freezeTypes(FUNCTION_TYPES);

/** @param {unknown} value @returns {value is Record<string, unknown>} */
function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** @param {unknown} value @returns {value is string} */
function isSnowflake(value) {
  return typeof value === 'string' && SNOWFLAKE_PATTERN.test(value);
}

/** Lista de cargos: de 1 a MAX_ROLES_PER_FUNCTION snowflakes, sem repetição.
 * @param {unknown} value @returns {boolean} */
function isRoleList(value) {
  if (!Array.isArray(value) || value.length < 1 || value.length > MAX_ROLES_PER_FUNCTION) return false;
  return value.every(isSnowflake) && new Set(value).size === value.length;
}

/** @param {FunctionFieldKind} kind @param {unknown} value @returns {boolean} */
function isFieldValue(kind, value) {
  switch (kind) {
    case 'template': return typeof value === 'string' && TEMPLATE_NAME_PATTERN.test(value);
    case 'channel':
    case 'voice_channel': return isSnowflake(value);
    case 'roles': return isRoleList(value);
    case 'boolean': return typeof value === 'boolean';
    default: return false;
  }
}

/** Config serializado em JSON com no máximo 2048 bytes UTF-8.
 * @param {Record<string, unknown>} config @returns {boolean} */
function fitsConfigLimit(config) {
  try {
    return new TextEncoder().encode(JSON.stringify(config)).length <= MAX_CONFIG_BYTES;
  } catch {
    return false;
  }
}

/** Confere o config contra os fields do tipo. Devolve o config normalizado (só as chaves dos
 * fields, na ordem deles, com `ephemeral` ausente em false) ou `null` se for inválido.
 * @param {FunctionType} type
 * @param {Record<string, unknown>} config
 * @returns {Record<string, unknown>|null} */
function normalizeConfig(type, config) {
  const keys = new Set(type.fields.map((field) => field.key));
  if (Object.keys(config).some((key) => !keys.has(key))) return null;
  /** @type {Record<string, unknown>} */
  const normalized = {};
  for (const field of type.fields) {
    if (!Object.hasOwn(config, field.key)) {
      if (field.kind === 'boolean' && field.key === 'ephemeral') {
        normalized[field.key] = false;
        continue;
      }
      return null;
    }
    const value = config[field.key];
    if (!isFieldValue(field.kind, value)) return null;
    normalized[field.key] = value;
  }
  return fitsConfigLimit(normalized) ? normalized : null;
}

/** Valida a lista de funções de um botão ou de uma opção de menu. Devolve cópias limpas
 * (só `type` e `config`, com o config normalizado), na ordem recebida.
 * @param {unknown} value
 * @returns {{ok: true, value: CustomFunction[]}|{ok: false}} */
export function validateFunctions(value) {
  if (!Array.isArray(value) || value.length > MAX_FUNCTIONS) return { ok: false };
  /** @type {CustomFunction[]} */
  const functions = [];
  for (const item of value) {
    if (!isRecord(item)) return { ok: false };
    if (Object.keys(item).length !== 2 || !Object.hasOwn(item, 'type') || !Object.hasOwn(item, 'config')) return { ok: false };
    const { type, config } = item;
    if (typeof type !== 'string' || !Object.hasOwn(CUSTOM_FUNCTION_TYPES, type)) return { ok: false };
    const definition = CUSTOM_FUNCTION_TYPES[type];
    if (definition === undefined || !isRecord(config)) return { ok: false };
    const normalized = normalizeConfig(definition, config);
    if (normalized === null) return { ok: false };
    functions.push({ type, config: normalized });
  }
  return { ok: true, value: functions };
}

/** Valores referenciados pelo config de uma função já validada (sem duplicatas), para a API
 * conferir existência e para o desvínculo futuro.
 * @param {CustomFunction} fn
 * @returns {FunctionReferences} */
export function functionReferences(fn) {
  /** @type {FunctionReferences} */
  const refs = { templates: [], channels: [], voiceChannels: [], roles: [] };
  if (!Object.hasOwn(CUSTOM_FUNCTION_TYPES, fn.type)) return refs;
  const type = CUSTOM_FUNCTION_TYPES[fn.type];
  if (type === undefined) return refs;
  for (const field of type.fields) {
    const value = fn.config[field.key];
    /** @type {string[]|null} */
    let bucket = null;
    switch (field.kind) {
      case 'template': bucket = refs.templates; break;
      case 'channel': bucket = refs.channels; break;
      case 'voice_channel': bucket = refs.voiceChannels; break;
      case 'roles': bucket = refs.roles; break;
      default: bucket = null;
    }
    if (bucket === null) continue;
    const ids = Array.isArray(value) ? value : [value];
    for (const id of ids) {
      if (typeof id === 'string' && id !== '' && !bucket.includes(id)) bucket.push(id);
    }
  }
  return refs;
}

/** True se `fn.config` satisfaz os fields do tipo: campos obrigatórios presentes e válidos
 * (template/canal preenchidos, cargos com pelo menos 1). Aceita entrada parcial ou malformada
 * sem lançar exceção; devolve false nesses casos.
 * @param {unknown} fn
 * @returns {boolean} */
export function isFunctionConfigComplete(fn) {
  if (!isRecord(fn) || typeof fn.type !== 'string' || !Object.hasOwn(CUSTOM_FUNCTION_TYPES, fn.type)) return false;
  const definition = CUSTOM_FUNCTION_TYPES[fn.type];
  if (definition === undefined || !isRecord(fn.config)) return false;
  return normalizeConfig(definition, fn.config) !== null;
}
