/**
 * Cliente da API de grupos de cargos (`/api/guilds/:guildId/role-groups`). Mesmo formato de erro
 * de `templates-api.ts`: o código vem do servidor e desconhecido vira `unknown`.
 */
export type RoleGroup = { id: number; name: string; version: number; roleIds: string[]; createdAt: string; updatedAt: string };

export type RoleGroupErrorCode =
  | 'unauthenticated'
  | 'not_found'
  | 'invalid_group_name'
  | 'invalid_roles'
  | 'duplicate_role'
  | 'duplicate'
  | 'conflict'
  | 'quota'
  | 'too_large'
  | 'invalid_json'
  | 'bot_not_in_guild'
  | 'unavailable'
  | 'unknown';

export type RoleGroupInput = { name: string; roleIds: string[] };

export type RoleGroupResult<T> = { ok: true; data: T } | { ok: false; error: RoleGroupErrorCode };

const knownErrors: RoleGroupErrorCode[] = [
  'unauthenticated', 'not_found', 'invalid_group_name', 'invalid_roles', 'duplicate_role', 'duplicate', 'conflict',
  'quota', 'too_large', 'invalid_json', 'bot_not_in_guild', 'unavailable',
];

async function request<T>(method: 'GET' | 'POST' | 'PUT' | 'DELETE', path: string, body?: unknown): Promise<RoleGroupResult<T>> {
  let response: Response;
  try {
    response = await fetch(path, {
      method,
      credentials: 'same-origin',
      ...(body === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
    });
  } catch {
    return { ok: false, error: 'unavailable' };
  }
  try {
    const json = (await response.json()) as T & { error?: string };
    if (response.ok) return { ok: true, data: json };
    return { ok: false, error: knownErrors.find((known) => known === json.error) ?? 'unknown' };
  } catch {
    return response.ok ? { ok: true, data: undefined as T } : { ok: false, error: 'unavailable' };
  }
}

const base = (guildId: string) => `/api/guilds/${encodeURIComponent(guildId)}/role-groups`;

export function listRoleGroups(guildId: string) {
  return request<{ items: RoleGroup[] }>('GET', base(guildId));
}

export function createRoleGroup(guildId: string, input: RoleGroupInput) {
  return request<{ id: number; version: number }>('POST', base(guildId), input);
}

export function updateRoleGroup(guildId: string, group: { id: number; expectedVersion: number }, input: RoleGroupInput) {
  return request<{ id: number; version: number }>('PUT', `${base(guildId)}/${group.id}`, { ...input, expectedVersion: group.expectedVersion });
}

export function deleteRoleGroup(guildId: string, id: number) {
  return request<{ ok: true }>('DELETE', `${base(guildId)}/${id}`);
}
