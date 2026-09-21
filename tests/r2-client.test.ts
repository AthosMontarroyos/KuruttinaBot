import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createR2Client, loadR2Config } from '../scripts/r2/client.mjs';

vi.mock('node:fs', () => ({ readFileSync: vi.fn() }));

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.restoreAllMocks(); vi.useRealTimers(); });

const config = { accountId: 'test-account', apiToken: 'test-token' };

describe('R2 client', () => {
  it('parses dotenv quoting, selects only R2 credentials and prioritizes process variables', () => {
    vi.mocked(readFileSync).mockReturnValue('CLOUDFLARE_ACCOUNT_ID="local-account"\nCLOUDFLARE_API_TOKEN="local-token" # comment\nUNRELATED=private');
    vi.stubEnv('CLOUDFLARE_ACCOUNT_ID', 'process-account');
    vi.stubEnv('CLOUDFLARE_API_TOKEN', undefined);
    expect(loadR2Config()).toEqual({ accountId: 'process-account', apiToken: 'local-token' });
    expect(() => loadR2Config({})).toThrow('obrigatorios');
    expect(process.env.CLOUDFLARE_API_TOKEN).toBeUndefined();
  });

  it('paginates with encoded prefix/cursor and validates the returned objects', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(Response.json({ success: true, result: [{ key: 'emojis/a.png', size: 1 }], result_info: { is_truncated: true, cursor: 'next+/=' } }))
      .mockResolvedValueOnce(Response.json({ success: true, result: [{ key: 'emojis/b.png', size: 2 }] }));
    vi.stubGlobal('fetch', fetch);
    const keys = [];
    for await (const object of createR2Client(config).list('emojis/')) keys.push(object.key);
    expect(keys).toEqual(['emojis/a.png', 'emojis/b.png']);
    const url = new URL(String(fetch.mock.calls[1]?.[0]));
    expect(url.searchParams.get('prefix')).toBe('emojis/');
    expect(url.searchParams.get('cursor')).toBe('next+/=');
    expect(new Headers(fetch.mock.calls[0]?.[1]?.headers).get('Authorization')).toBe('Bearer test-token');
    expect(fetch.mock.calls[0]?.[1]?.signal).toBeInstanceOf(AbortSignal);
  });

  it.each([
    { success: true, result: [{ key: 'bad', size: -1 }] },
    { success: true, result: [], result_info: { is_truncated: true } },
    { success: false, errors: [{ message: 'private upstream detail' }] },
  ])('rejects malformed or failed list responses', async (payload) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(payload)));
    await expect(createR2Client(config).list().next()).rejects.toThrow();
  });

  it('encodes object key segments consistently for put/delete without changing the body', async () => {
    const fetch = vi.fn().mockImplementation(async () => Response.json({ success: true }));
    vi.stubGlobal('fetch', fetch);
    const r2 = createR2Client(config);
    const body = new Uint8Array([1, 2]).buffer;
    await r2.put('emojis/a #.png', body, 'image/png');
    await r2.delete('emojis/a #.png');
    expect(fetch.mock.calls[0]?.[0]).toBe(fetch.mock.calls[1]?.[0]);
    expect(fetch.mock.calls[0]?.[0]).toContain('/objects/emojis/a%20%23.png');
    expect(fetch.mock.calls[0]?.[1]).toMatchObject({ method: 'PUT', body });
    expect(fetch.mock.calls[1]?.[1]).toMatchObject({ method: 'DELETE' });
  });

  it('waits for Retry-After before retrying a rate-limited upload', async () => {
    vi.useFakeTimers();
    const fetch = vi.fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(new Response(null, { status: 429, headers: { 'Retry-After': '2' } }))
      .mockResolvedValueOnce(Response.json({ success: true }));
    vi.stubGlobal('fetch', fetch);
    const upload = createR2Client(config).put('emojis/a.png', new ArrayBuffer(0), 'image/png');
    await vi.advanceTimersByTimeAsync(1999);
    expect(fetch).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    await upload;
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('does not expose upstream details or retry permanent errors', async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json({ success: false, errors: [{ message: 'private detail' }] }, { status: 403 }));
    vi.stubGlobal('fetch', fetch);
    await expect(createR2Client(config).delete('emojis/a.png')).rejects.toThrow('HTTP 403; operacao recusada.');
    expect(fetch).toHaveBeenCalledOnce();
  });
});
