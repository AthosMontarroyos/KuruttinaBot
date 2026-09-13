import { afterEach, describe, expect, it, vi } from 'vitest';
import { verifyBotIdentity } from '../apps/bot/src/infrastructure/discord/identity.js';

const botId = '12345678901234567';

afterEach(() => vi.unstubAllGlobals());

describe('Discord bot identity', () => {
  it('returns the verified bot ID', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: botId, bot: true }))));
    await expect(verifyBotIdentity('fake-token', botId)).resolves.toBe(botId);
  });

  it('fails closed on HTTP errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 401 })));
    await expect(verifyBotIdentity('fake-token', botId)).rejects.toThrow('validation failed (401)');
  });

  it.each([
    { id: botId, bot: false },
    { id: '98765432109876543', bot: true },
    { id: 123, bot: true },
    null,
  ])('fails closed on an invalid identity payload %#', async (payload) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(payload))));
    await expect(verifyBotIdentity('fake-token', botId)).rejects.toThrow('identity mismatch');
  });
});
