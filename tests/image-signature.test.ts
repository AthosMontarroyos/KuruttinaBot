import { describe, expect, it } from 'vitest';
import { sniffImageFormat } from '../apps/bot/src/application/emojis/imageSignature.js';

const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
const JPEG = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0]);
const GIF89 = Uint8Array.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);
const GIF87 = Uint8Array.from([0x47, 0x49, 0x46, 0x38, 0x37, 0x61]);
const WEBP = Uint8Array.from([
  0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
]);

function ftyp(major: string, compatible: readonly string[] = []): Uint8Array {
  const brands = [major, '\0\0\0\0', ...compatible].map((brand) => brand.padEnd(4, '\0').slice(0, 4));
  const payload = new TextEncoder().encode(`ftyp${brands.join('')}`);
  const box = new Uint8Array(4 + payload.byteLength);
  const size = box.byteLength;
  box[0] = (size >>> 24) & 0xff;
  box[1] = (size >>> 16) & 0xff;
  box[2] = (size >>> 8) & 0xff;
  box[3] = size & 0xff;
  box.set(payload, 4);
  return box;
}

describe('assinatura de imagem', () => {
  it.each([
    ['png', PNG],
    ['jpeg', JPEG],
    ['gif', GIF89],
    ['gif', GIF87],
    ['webp', WEBP],
    ['avif', ftyp('avif')],
    ['avif', ftyp('avis')],
    ['avif', ftyp('mif1', ['avif'])],
  ] as const)('reconhece %s', (format, bytes) => {
    expect(sniffImageFormat(bytes)).toBe(format);
  });

  it.each([
    ['vazio', new Uint8Array(0)],
    ['curto demais para JPEG', Uint8Array.from([0xff, 0xd8])],
    ['GIF incompleto', Uint8Array.from([0x47, 0x49, 0x46, 0x38, 0x39])],
    ['RIFF sem WEBP', Uint8Array.from([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x41, 0x56, 0x45])],
    ['ftyp HEIC', ftyp('heic')],
    ['ftyp curto demais', Uint8Array.from([0, 0, 0, 8, 0x66, 0x74, 0x79, 0x70])],
    ['PDF', new TextEncoder().encode('%PDF-1.7')],
    ['SVG', new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"></svg>')],
    ['bytes aleatórios', Uint8Array.from([1, 2, 3, 4, 5, 6, 7, 8, 9])],
  ])('rejeita %s', (_label, bytes) => {
    expect(sniffImageFormat(bytes)).toBeUndefined();
  });
});
