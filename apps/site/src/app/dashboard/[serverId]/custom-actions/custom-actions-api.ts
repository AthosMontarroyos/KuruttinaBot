/**
 * Cliente da API de ações personalizadas (`/api/guilds/:guildId/custom-buttons` e `/custom-selects`).
 * Mesmo formato de erro de `role-groups-api.ts`: o código vem do servidor e desconhecido vira `unknown`.
 */
export type CustomActionKind = 'buttons' | 'selects';

export type CustomAction = { id: number; name: string; version: number; createdAt: string; updatedAt: string };

export type CustomFunction = { type: string; config: Record<string, unknown> };

export type ButtonConfig = { id: number; name: string; version: number; functions: CustomFunction[] };

/** `key` é a chave estável da opção (8 caracteres `[a-z0-9]`, gerada pelo painel); o template aponta para ela. */
export type SelectOption = { key: string; label: string; functions: CustomFunction[] };

export type SelectConfig = { id: number; name: string; version: number; keepSelection: boolean; options: SelectOption[] };

export type CustomActionErrorCode =
  | 'unauthenticated'
  | 'not_found'
  | 'invalid_name'
  | 'quota'
  | 'duplicate'
  | 'conflict'
  | 'invalid_functions'
  | 'invalid_options'
  | 'invalid_reference'
  | 'bot_not_in_guild'
  | 'too_large'
  | 'invalid_json'
  | 'unavailable'
  | 'unknown';

export type CustomActionResult<T> = { ok: true; data: T } | { ok: false; error: CustomActionErrorCode };

const knownErrors: CustomActionErrorCode[] = [
  'unauthenticated', 'not_found', 'invalid_name', 'quota', 'duplicate', 'conflict', 'invalid_functions', 'invalid_options', 'invalid_reference', 'bot_not_in_guild', 'too_large', 'invalid_json', 'unavailable',
];

async function request<T>(method: 'GET' | 'POST' | 'PUT' | 'DELETE', path: string, body?: unknown): Promise<CustomActionResult<T>> {
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

const base = (guildId: string, kind: CustomActionKind) => `/api/guilds/${encodeURIComponent(guildId)}/custom-${kind}`;

export function listCustomActions(guildId: string, kind: CustomActionKind) {
  return request<{ items: CustomAction[] }>('GET', base(guildId, kind));
}

export function createCustomAction(guildId: string, kind: CustomActionKind, name: string) {
  return request<{ id: number; version: number }>('POST', base(guildId, kind), { name });
}

export function deleteCustomAction(guildId: string, kind: CustomActionKind, id: number) {
  return request<{ ok: true; unlinked: number }>('DELETE', `${base(guildId, kind)}/${id}`);
}

export function getButtonConfig(guildId: string, id: number) {
  return request<ButtonConfig>('GET', `${base(guildId, 'buttons')}/${id}`);
}

export function saveButtonConfig(guildId: string, id: number, body: { expectedVersion: number; functions: CustomFunction[] }) {
  return request<{ id: number; version: number }>('PUT', `${base(guildId, 'buttons')}/${id}`, body);
}

export function getSelectConfig(guildId: string, id: number) {
  return request<SelectConfig>('GET', `${base(guildId, 'selects')}/${id}`);
}

export function saveSelectConfig(
  guildId: string,
  id: number,
  body: { expectedVersion: number; keepSelection: boolean; options: SelectOption[] },
) {
  return request<{ id: number; version: number }>('PUT', `${base(guildId, 'selects')}/${id}`, body);
}
