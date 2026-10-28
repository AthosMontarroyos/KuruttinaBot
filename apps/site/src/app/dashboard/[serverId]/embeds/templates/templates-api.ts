type TemplateSummary = { name: string; buttonCount: number; menuCount: number; version: number; updatedAt: string };
type TemplateDetail = {
  name: string;
  content: unknown;
  buttonCount: number;
  menuCount: number;
  version: number;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
};
type ValidationDetail = { code: string; path: string; message: string };

type TemplateErrorCode = 'unauthenticated' | 'not_found' | 'invalid_name' | 'too_large' | 'validation' | 'duplicate' | 'conflict' | 'quota' | 'unavailable' | 'unknown';

type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; error: TemplateErrorCode; details?: ValidationDetail[] };

async function parseError(response: Response): Promise<{ error: TemplateErrorCode; details?: ValidationDetail[] }> {
  try {
    const body = (await response.json()) as { error?: string; details?: ValidationDetail[] };
    const error = body.error as TemplateErrorCode | undefined;
    const known: TemplateErrorCode[] = ['unauthenticated', 'not_found', 'invalid_name', 'too_large', 'validation', 'duplicate', 'conflict', 'quota', 'unavailable'];
    const resolved = error && known.includes(error) ? error : 'unknown';
    return body.details ? { error: resolved, details: body.details } : { error: resolved };
  } catch {
    return { error: 'unknown' };
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<ApiResult<T>> {
  let response: Response;
  try {
    response = await fetch(path, { ...init, credentials: 'same-origin' });
  } catch {
    return { ok: false, status: 0, error: 'unavailable' };
  }
  if (!response.ok) {
    const { error, details } = await parseError(response);
    return details ? { ok: false, status: response.status, error, details } : { ok: false, status: response.status, error };
  }
  const data = (await response.json()) as T;
  return { ok: true, data };
}

function basePath(guildId: string): string {
  return `/api/guilds/${encodeURIComponent(guildId)}/templates`;
}

async function listTemplates(guildId: string, after?: string): Promise<ApiResult<{ items: TemplateSummary[]; nextCursor: string | null }>> {
  const query = after ? `?after=${encodeURIComponent(after)}` : '';
  return request(`${basePath(guildId)}${query}`, { method: 'GET' });
}

async function getTemplate(guildId: string, name: string): Promise<ApiResult<TemplateDetail>> {
  return request(`${basePath(guildId)}/${encodeURIComponent(name)}`, { method: 'GET' });
}

async function createTemplate(guildId: string, name: string, contentJson: string): Promise<ApiResult<{ name: string; version: number }>> {
  return request(basePath(guildId), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, contentJson }),
  });
}

async function updateTemplate(guildId: string, name: string, expectedVersion: number, contentJson: string): Promise<ApiResult<{ name: string; version: number }>> {
  return request(`${basePath(guildId)}/${encodeURIComponent(name)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ expectedVersion, contentJson }),
  });
}

async function deleteTemplate(guildId: string, name: string): Promise<ApiResult<{ ok: true }>> {
  return request(`${basePath(guildId)}/${encodeURIComponent(name)}`, { method: 'DELETE' });
}

export { listTemplates, getTemplate, createTemplate, updateTemplate, deleteTemplate };
export type { TemplateSummary, TemplateDetail, ValidationDetail, TemplateErrorCode, ApiResult };
