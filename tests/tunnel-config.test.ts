import { describe, expect, it } from 'vitest';
import { parseTunnelManifest, readTunnelIdFromToken } from '../scripts/cloudflare/tunnel-config.mjs';

const validManifest = JSON.stringify({
  development: {
    name: 'kuruttina-development',
    id: 'ef7d23f9-b164-45a1-b316-f45a02045102',
    hostname: 'kuruttina.dev.example.com',
  },
  production: {
    name: 'kuruttina-production',
    id: 'b1460ee3-03f7-49e7-a35c-12d6a6f07ba7',
    hostname: 'kuruttina.example.com',
  },
});

describe('Cloudflare tunnel configuration', () => {
  it('accepts the exact environment manifest', () => {
    expect(parseTunnelManifest(validManifest).production.name).toBe('kuruttina-production');
  });

  it.each([
    '{}',
    JSON.stringify({ development: {}, production: {} }),
    JSON.stringify({ development: JSON.parse(validManifest).development, production: { name: 'prod', id: 'invalid', hostname: 'localhost' } }),
  ])('rejects an invalid manifest %#', (manifest) => {
    expect(() => parseTunnelManifest(manifest)).toThrow();
  });

  it('accepts only a string tunnel ID in the decoded token', () => {
    expect(readTunnelIdFromToken({ t: 'tunnel-id' })).toBe('tunnel-id');
    expect(() => readTunnelIdFromToken({ t: 123 })).toThrow('Invalid tunnel token payload');
  });
});
