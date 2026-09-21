import { describe, expect, it, vi } from 'vitest';
import { bytesEqual, emojiContentChanged, emojiFilename, replaceR2Emojis } from '../scripts/discord/sync-discord-emojis.ts';
import { createR2Client } from '../scripts/r2/client.mjs';

describe('sincronizacao de emojis', () => {
  it.each([false, true])('removes stale objects only after every upload and page succeeds (upload failure=%s)', async (failUpload) => {
    const events: string[] = [];
    const r2 = {
      ...createR2Client({ accountId: 'test', apiToken: 'test' }),
      put: vi.fn(async (key: string) => { events.push(`put:${key}`); if (failUpload) throw new Error('Upload failed'); }),
      list: vi.fn(async function* () {
        yield { key: 'emojis/old.png', size: 1 };
        yield { key: 'other/keep.png', size: 1 };
        events.push('listed');
      }),
      delete: vi.fn(async (key: string) => { events.push(`delete:${key}`); }),
    };
    const assets = [{ emoji: { id: '12345678901234567', name: 'new' }, bytes: new Uint8Array([1]), filename: 'new.png', contentType: 'image/png' }];
    if (failUpload) {
      await expect(replaceR2Emojis(assets, r2)).rejects.toThrow('Upload failed');
      expect(r2.list).not.toHaveBeenCalled();
      expect(r2.delete).not.toHaveBeenCalled();
    } else {
      await replaceR2Emojis(assets, r2);
      expect(events).toEqual(['put:emojis/new.png', 'listed', 'delete:emojis/old.png']);
      expect(r2.list).toHaveBeenCalledWith('emojis/');
    }
  });

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
