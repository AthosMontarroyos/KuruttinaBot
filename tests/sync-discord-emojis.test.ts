import { describe, expect, it } from 'vitest';
import { bytesEqual, emojiContentChanged, emojiFilename } from '../scripts/discord/sync-discord-emojis.ts';

describe('sincronizacao de emojis', () => {
  it('gera nomes planos e preserva o formato animado', () => {
    expect(emojiFilename({ id: '12345678901234567', name: 'dancing', animated: true })).toBe('dancing.gif');
    expect(emojiFilename({ id: '12345678901234567', name: 'stats' })).toBe('stats.png');
  });

  it('rejeita nomes que poderiam criar subpastas', () => {
    expect(() => emojiFilename({ id: '12345678901234567', name: '../emoji' })).toThrow('Nome');
  });

  it('compara o conteudo para detectar substituicoes', () => {
    expect(bytesEqual(Uint8Array.from([1, 2]), Uint8Array.from([1, 2]))).toBe(true);
    expect(bytesEqual(Uint8Array.from([1, 2]), Uint8Array.from([1, 3]))).toBe(false);
  });

  it('substitui automaticamente um emoji recriado com o mesmo nome e outro conteudo', () => {
    const oldContent = Uint8Array.from([1, 2, 3]);
    const newContent = Uint8Array.from([4, 5, 6]);

    expect(emojiContentChanged(newContent, false, oldContent, false)).toBe(true);
    expect(emojiContentChanged(newContent, true, newContent, false)).toBe(true);
    expect(emojiContentChanged(newContent, false, newContent, false)).toBe(false);
  });
});
