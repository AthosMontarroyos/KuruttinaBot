import { describe, expect, it } from 'vitest';
import { bytesEqual, parseVaults, previousMirrorState, renderGallery, safeSegment } from '../scripts/discord/sync-discord-emojis.ts';

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

  it('compara o conteudo dos emojis sem considerar apenas nome ou tamanho', () => {
    expect(bytesEqual(Uint8Array.from([1, 2, 3]), Uint8Array.from([1, 2, 3]))).toBe(true);
    expect(bytesEqual(Uint8Array.from([1, 2, 3]), Uint8Array.from([1, 2, 4]))).toBe(false);
    expect(bytesEqual(Uint8Array.from([1, 2]), Uint8Array.from([1, 2, 3]))).toBe(false);
  });

  it('preserva a identidade anterior da origem para detectar recriacao com o mesmo nome', () => {
    const state = previousMirrorState({ applications: [
      { applicationId: 'production', emojis: [{ id: 'source-old', name: 'dancing' }] },
      { applicationId: 'development', emojis: [{ id: 'target-old', name: 'dancing' }] },
    ] }, 'production', 'development');
    expect(state.get('dancing')).toEqual({ sourceEmojiId: 'source-old', targetEmojiId: 'target-old' });

    const explicit = previousMirrorState({ applications: [
      { applicationId: 'production', emojis: [] },
      { applicationId: 'development', emojis: [{ id: 'target-new', name: 'dancing', sourceEmojiId: 'source-new' }] },
    ] }, 'production', 'development');
    expect(explicit.get('dancing')).toEqual({ sourceEmojiId: 'source-new', targetEmojiId: 'target-new' });
  });
});
