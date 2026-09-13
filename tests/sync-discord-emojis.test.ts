import { describe, expect, it } from 'vitest';
import { parseVaults, renderGallery, safeSegment } from '../scripts/sync-discord-emojis.ts';

describe('sync de emojis', () => {
  it('aceita nome e o alias legado name sem depender de categoria', () => {
    expect(parseVaults({ vaults: [{ token: 'secret-a', nome: 'A' }, { token: 'secret-b', name: 'B', categoria: 'ignorada' }] }))
      .toEqual([{ label: 'vault:A', token: 'secret-a' }, { label: 'vault:B', token: 'secret-b' }]);
  });

  it('rejeita campos inesperados e tokens vazios', () => {
    expect(() => parseVaults({ vaults: [{ token: '', nome: 'A' }] })).toThrow('token');
    expect(() => parseVaults({ vaults: [{ token: 'x', nome: 'A', extra: true }] })).toThrow('campos desconhecidos');
  });

  it('produz segmentos seguros para Windows e uma galeria escapada', () => {
    expect(safeSegment('Team: A/B. ')).toBe('Team- A-B');
    const html = renderGallery([{ app: { id: '1', name: '<App>' }, teamName: 'A&B', emojis: [{ id: '2', name: 'wow"', relativePath: 'A&B/wow#1.webp' }] }]);
    expect(html).toContain('A&amp;B');
    expect(html).toContain('&lt;App&gt;');
    expect(html).toContain('wow&quot;');
    expect(html).toContain('A%26B/wow%231.webp');
  });
});
