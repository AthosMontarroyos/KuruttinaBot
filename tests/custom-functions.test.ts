import { describe, expect, it } from 'vitest';
import {
  CUSTOM_FUNCTION_TYPES,
  MAX_ROLES_PER_FUNCTION,
  functionReferences,
  isFunctionConfigComplete,
  validateFunctions,
} from '@kuruttina/message-templates/custom-functions';

const CHANNEL = '123456789012345678';
const VOICE = '223456789012345678';
const ROLE = '323456789012345678';
const ROLE_2 = '423456789012345678';

const fn = (type: string, config: unknown) => ({ type, config });
const accepts = (functions: unknown) => validateFunctions(functions).ok;
const uniqueIds = (count: number) => Array.from({ length: count }, (_, index) => (BigInt('100000000000000000') + BigInt(index)).toString());

const EXAMPLES: Array<[string, Record<string, unknown>]> = [
  ['send_message', { template: 'welcome', ephemeral: true }],
  ['send_channel_message', { template: 'welcome', channelId: CHANNEL }],
  ['edit_message', { template: 'welcome' }],
  ['delete_message', {}],
  ['dm_user', { template: 'welcome' }],
  ['move_users_in_voice', { channelId: VOICE }],
  ['toggle_roles', { roleIds: [ROLE] }],
  ['add_roles', { roleIds: [ROLE] }],
  ['remove_roles', { roleIds: [ROLE] }],
  ['set_roles', { roleIds: [ROLE] }],
];

describe('catálogo de funções', () => {
  it('lists the ten types in the selector order, with pt-BR labels', () => {
    expect(Object.keys(CUSTOM_FUNCTION_TYPES)).toEqual([
      'send_message', 'send_channel_message', 'edit_message', 'delete_message', 'dm_user',
      'move_users_in_voice', 'toggle_roles', 'add_roles', 'remove_roles', 'set_roles',
    ]);
    expect(Object.values(CUSTOM_FUNCTION_TYPES).map((type) => type.label)).toEqual([
      'Enviar mensagem', 'Enviar mensagem em canal', 'Editar mensagem', 'Apagar mensagem', 'Enviar DM',
      'Mover usuário na voz', 'Alternar cargos', 'Adicionar cargos', 'Remover cargos', 'Definir cargos',
    ]);
  });

  it('is frozen and declares the fields of each type', () => {
    expect(Object.isFrozen(CUSTOM_FUNCTION_TYPES)).toBe(true);
    expect(CUSTOM_FUNCTION_TYPES.send_message?.fields.map((field) => [field.key, field.kind])).toEqual([
      ['template', 'template'], ['ephemeral', 'boolean'],
    ]);
    expect(CUSTOM_FUNCTION_TYPES.delete_message?.fields).toEqual([]);
    expect(CUSTOM_FUNCTION_TYPES.move_users_in_voice?.fields.map((field) => field.kind)).toEqual(['voice_channel']);
    expect(MAX_ROLES_PER_FUNCTION).toBe(25);
  });
});

describe('validateFunctions', () => {
  it.each(EXAMPLES)('accepts a valid example of %s', (type, config) => {
    expect(accepts([fn(type, config)])).toBe(true);
  });

  it('rejects an unknown type', () => {
    expect(accepts([fn('nope', {})])).toBe(false);
    expect(accepts([fn('constructor', {})])).toBe(false);
  });

  it('rejects extra and missing fields', () => {
    expect(accepts([fn('edit_message', { template: 'welcome', extra: 1 })])).toBe(false);
    expect(accepts([fn('delete_message', { extra: true })])).toBe(false);
    expect(accepts([fn('send_channel_message', { template: 'welcome' })])).toBe(false);
    expect(accepts([fn('move_users_in_voice', {})])).toBe(false);
    expect(accepts([fn('edit_message', {})])).toBe(false);
  });

  it('rejects a template with an invalid name', () => {
    for (const template of ['Bem Vindo', 'bem/vindo', '', 'a'.repeat(33)]) {
      expect(accepts([fn('edit_message', { template })])).toBe(false);
    }
    expect(accepts([fn('edit_message', { template: 'a'.repeat(32) })])).toBe(true);
  });

  it('rejects an invalid snowflake', () => {
    for (const channelId of ['0123', '1234567890123456', '123456789012345678901', 'abc', '12345678901234567a']) {
      expect(accepts([fn('send_channel_message', { template: 'welcome', channelId })])).toBe(false);
      expect(accepts([fn('move_users_in_voice', { channelId })])).toBe(false);
    }
    expect(accepts([fn('move_users_in_voice', { channelId: 123456789012345678 })])).toBe(false);
  });

  it('rejects roles that are empty, duplicated, too many or not snowflakes', () => {
    expect(accepts([fn('toggle_roles', { roleIds: [] })])).toBe(false);
    expect(accepts([fn('add_roles', { roleIds: [ROLE, ROLE] })])).toBe(false);
    expect(accepts([fn('set_roles', { roleIds: uniqueIds(26) })])).toBe(false);
    expect(accepts([fn('remove_roles', { roleIds: ['x'] })])).toBe(false);
    expect(accepts([fn('remove_roles', { roleIds: [123] })])).toBe(false);
    expect(accepts([fn('remove_roles', { roleIds: ROLE })])).toBe(false);
  });

  it('accepts up to MAX_ROLES_PER_FUNCTION distinct roles', () => {
    expect(accepts([fn('set_roles', { roleIds: uniqueIds(25) })])).toBe(true);
    expect(accepts([fn('set_roles', { roleIds: [ROLE, ROLE_2] })])).toBe(true);
  });

  it('rejects more than ten functions and accepts exactly ten', () => {
    expect(accepts(Array.from({ length: 11 }, () => fn('delete_message', {})))).toBe(false);
    expect(accepts(Array.from({ length: 10 }, () => fn('delete_message', {})))).toBe(true);
  });

  it('rejects a config above 2048 bytes', () => {
    expect(accepts([fn('edit_message', { template: 'welcome', pad: 'x'.repeat(2100) })])).toBe(false);
  });

  it('rejects ephemeral of a non-boolean type', () => {
    expect(accepts([fn('send_message', { template: 'welcome', ephemeral: 'sim' })])).toBe(false);
  });

  it('turns a missing ephemeral into false and returns clean copies', () => {
    const result = validateFunctions([fn('send_message', { template: 'welcome' })]);
    expect(result).toEqual({ ok: true, value: [{ type: 'send_message', config: { template: 'welcome', ephemeral: false } }] });
  });

  it('keeps the order of the functions received', () => {
    const result = validateFunctions([fn('delete_message', {}), fn('edit_message', { template: 'welcome' })]);
    expect(result.ok && result.value.map((item) => item.type)).toEqual(['delete_message', 'edit_message']);
  });
});

describe('functionReferences', () => {
  it('lists the templates, channels, voice channels and roles referenced', () => {
    expect(functionReferences({ type: 'send_channel_message', config: { template: 'welcome', channelId: CHANNEL } }))
      .toEqual({ templates: ['welcome'], channels: [CHANNEL], voiceChannels: [], roles: [] });
    expect(functionReferences({ type: 'move_users_in_voice', config: { channelId: VOICE } }))
      .toEqual({ templates: [], channels: [], voiceChannels: [VOICE], roles: [] });
    expect(functionReferences({ type: 'set_roles', config: { roleIds: [ROLE, ROLE_2] } }))
      .toEqual({ templates: [], channels: [], voiceChannels: [], roles: [ROLE, ROLE_2] });
    expect(functionReferences({ type: 'send_message', config: { template: 'welcome', ephemeral: false } }))
      .toEqual({ templates: ['welcome'], channels: [], voiceChannels: [], roles: [] });
  });

  it('returns nothing for delete_message and removes duplicates', () => {
    expect(functionReferences({ type: 'delete_message', config: {} }))
      .toEqual({ templates: [], channels: [], voiceChannels: [], roles: [] });
    expect(functionReferences({ type: 'add_roles', config: { roleIds: [ROLE, ROLE] } }))
      .toEqual({ templates: [], channels: [], voiceChannels: [], roles: [ROLE] });
  });
});

describe('isFunctionConfigComplete', () => {
  it.each(EXAMPLES)('is true for a complete %s', (type, config) => {
    expect(isFunctionConfigComplete(fn(type, config))).toBe(true);
  });

  it('accepts the optional ephemeral when absent', () => {
    expect(isFunctionConfigComplete(fn('send_message', { template: 'welcome' }))).toBe(true);
  });

  it('is false for a missing or empty required field', () => {
    expect(isFunctionConfigComplete(fn('send_channel_message', { template: 'welcome' }))).toBe(false);
    expect(isFunctionConfigComplete(fn('send_channel_message', { template: '', channelId: CHANNEL }))).toBe(false);
    expect(isFunctionConfigComplete(fn('toggle_roles', { roleIds: [] }))).toBe(false);
    expect(isFunctionConfigComplete(fn('edit_message', {}))).toBe(false);
  });

  it('is false for an extra field or an invalid value', () => {
    expect(isFunctionConfigComplete(fn('dm_user', { template: 'welcome', extra: 1 }))).toBe(false);
    expect(isFunctionConfigComplete(fn('move_users_in_voice', { channelId: 'abc' }))).toBe(false);
  });

  it('does not throw on malformed input', () => {
    expect(() => isFunctionConfigComplete(null)).not.toThrow();
    expect(isFunctionConfigComplete(null)).toBe(false);
    expect(isFunctionConfigComplete('x')).toBe(false);
    expect(isFunctionConfigComplete({ type: 'delete_message' })).toBe(false);
    expect(isFunctionConfigComplete(fn('nope', {}))).toBe(false);
  });
});
