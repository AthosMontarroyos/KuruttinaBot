/**
 * Cliente da API de entrada e saída (`/api/guilds/:guildId/member-events`). Mesmo formato de erro
 * de `role-groups-api.ts`: o código vem do servidor e desconhecido vira `unknown`.
 */
export type MemberEventKind = 'join' | 'leave';

export type MemberEvent = {
  event: MemberEventKind;
  enabled: boolean;
  channelId: string | null;
  ignoreBots: boolean;
  contentJson: string;
  version: number;
  updatedAt: string;
};

export type MemberEventInput = {
  expectedVersion: number | null;
  enabled: boolean;
  channelId: string | null;
  ignoreBots: boolean;
  contentJson: string;
};

export type ValidationDetail = { code: string; path: string; message: string };

export type MemberEventErrorCode =
  | 'unauthenticated'
  | 'not_found'
  | 'invalid_json'
  | 'too_large'
  | 'validation'
  | 'channel_required'
  | 'invalid_channel'
  | 'conflict'
  | 'bot_not_in_guild'
  | 'quota'
  | 'unavailable'
  | 'unknown';

export type MemberEventResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: MemberEventErrorCode; details?: ValidationDetail[] };

export type MemberEventTestInput = {
  channelId: string;
  contentJson: string;
};

const knownErrors: MemberEventErrorCode[] = [
  'unauthenticated', 'not_found', 'invalid_json', 'too_large', 'validation', 'channel_required',
  'invalid_channel', 'conflict', 'bot_not_in_guild', 'quota', 'unavailable',
];

async function request<T>(method: 'GET' | 'PUT' | 'POST', path: string, body?: unknown): Promise<MemberEventResult<T>> {
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
    const json = (await response.json()) as T & { error?: string; details?: ValidationDetail[] };
    if (response.ok) return { ok: true, data: json };
    const error = knownErrors.find((known) => known === json.error) ?? 'unknown';
    return Array.isArray(json.details) ? { ok: false, error, details: json.details } : { ok: false, error };
  } catch {
    return response.ok ? { ok: true, data: undefined as T } : { ok: false, error: 'unavailable' };
  }
}

const base = (guildId: string) => `/api/guilds/${encodeURIComponent(guildId)}/member-events`;

export function listMemberEvents(guildId: string) {
  return request<{ items: MemberEvent[] }>('GET', base(guildId));
}

export function saveMemberEvent(guildId: string, event: MemberEventKind, input: MemberEventInput) {
  return request<{ event: MemberEventKind; version: number }>('PUT', `${base(guildId)}/${event}`, input);
}

/** Envia a mensagem de teste ao canal escolhido, sem salvar a configuração. */
export function testMemberEvent(guildId: string, event: MemberEventKind, input: MemberEventTestInput) {
  return request<{ ok: true }>('POST', `${base(guildId)}/${event}/test`, input);
}
