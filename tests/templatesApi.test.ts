import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTemplate, deleteTemplate, getTemplate, listTemplates, updateTemplate } from '../apps/site/src/app/dashboard/[serverId]/messages/templates-api.js';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

describe('templatesApi', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('lists templates with same-origin credentials and a cursor', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { items: [{ name: 'boas-vindas', buttonCount: 1, menuCount: 0, version: 1, updatedAt: '2026-01-01T00:00:00Z' }], nextCursor: 'cursor-1' }));
    const result = await listTemplates('guild-1', 'cursor-0');
    expect(fetchMock).toHaveBeenCalledWith('/api/guilds/guild-1/templates?after=cursor-0', expect.objectContaining({ method: 'GET', credentials: 'same-origin' }));
    expect(result).toEqual({ ok: true, data: { items: [{ name: 'boas-vindas', buttonCount: 1, menuCount: 0, version: 1, updatedAt: '2026-01-01T00:00:00Z' }], nextCursor: 'cursor-1' } });
  });

  it('gets a template detail', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { name: 'boas-vindas', content: { content: 'oi' }, buttonCount: 0, menuCount: 0, version: 2, createdBy: 'u1', updatedBy: 'u1', createdAt: 'a', updatedAt: 'b' }));
    const result = await getTemplate('guild-1', 'boas-vindas');
    expect(fetchMock).toHaveBeenCalledWith('/api/guilds/guild-1/templates/boas-vindas', expect.objectContaining({ method: 'GET' }));
    expect(result.ok).toBe(true);
  });

  it('reports not_found for a missing template', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(404, { error: 'not_found' }));
    const result = await getTemplate('guild-1', 'inexistente');
    expect(result).toEqual({ ok: false, status: 404, error: 'not_found', details: undefined });
  });

  it('creates a template with JSON content and headers', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(201, { name: 'boas-vindas', version: 1 }));
    const result = await createTemplate('guild-1', 'boas-vindas', '{"content":"oi"}');
    expect(fetchMock).toHaveBeenCalledWith('/api/guilds/guild-1/templates', expect.objectContaining({
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'boas-vindas', contentJson: '{"content":"oi"}' }),
    }));
    expect(result).toEqual({ ok: true, data: { name: 'boas-vindas', version: 1 } });
  });

  it('surfaces validation details on create', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(422, { error: 'validation', details: [{ code: 'too_many_buttons', path: 'components', message: 'Limite de botões excedido' }] }));
    const result = await createTemplate('guild-1', 'nome', '{}');
    expect(result).toEqual({ ok: false, status: 422, error: 'validation', details: [{ code: 'too_many_buttons', path: 'components', message: 'Limite de botões excedido' }] });
  });

  it('updates a template with the expected version', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { name: 'boas-vindas', version: 2 }));
    const result = await updateTemplate('guild-1', 'boas-vindas', 1, '{"content":"novo"}');
    expect(fetchMock).toHaveBeenCalledWith('/api/guilds/guild-1/templates/boas-vindas', expect.objectContaining({
      method: 'PUT',
      body: JSON.stringify({ expectedVersion: 1, contentJson: '{"content":"novo"}' }),
    }));
    expect(result).toEqual({ ok: true, data: { name: 'boas-vindas', version: 2 } });
  });

  it('reports a version conflict on update', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(409, { error: 'conflict' }));
    const result = await updateTemplate('guild-1', 'boas-vindas', 1, '{}');
    expect(result).toEqual({ ok: false, status: 409, error: 'conflict', details: undefined });
  });

  it('deletes a template', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { ok: true }));
    const result = await deleteTemplate('guild-1', 'boas-vindas');
    expect(fetchMock).toHaveBeenCalledWith('/api/guilds/guild-1/templates/boas-vindas', expect.objectContaining({ method: 'DELETE' }));
    expect(result).toEqual({ ok: true, data: { ok: true } });
  });

  it('returns an unavailable error on network failure', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network down'));
    const result = await listTemplates('guild-1');
    expect(result).toEqual({ ok: false, status: 0, error: 'unavailable' });
  });

  it('falls back to unknown for an unrecognized error code', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(500, { error: 'boom' }));
    const result = await listTemplates('guild-1');
    expect(result).toEqual({ ok: false, status: 500, error: 'unknown', details: undefined });
  });
});
