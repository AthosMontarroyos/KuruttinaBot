import type { SupportedEmojiImageFormat } from './types.js';

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] as const;
const AVIF_BRANDS: ReadonlySet<string> = new Set(['avif', 'avis']);

/**
 * Identifica PNG, JPEG, GIF, WebP ou AVIF pela assinatura, sem decodificar.
 * Qualquer outro conteúdo — inclusive um tipo declarado como imagem — fica de fora.
 */
export function sniffImageFormat(bytes: Uint8Array): SupportedEmojiImageFormat | undefined {
  if (hasBytes(bytes, 0, PNG_SIGNATURE)) return 'png';
  if (bytes.byteLength >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpeg';
  if (hasAscii(bytes, 0, 'GIF87a') || hasAscii(bytes, 0, 'GIF89a')) return 'gif';
  if (hasAscii(bytes, 0, 'RIFF') && hasAscii(bytes, 8, 'WEBP')) return 'webp';
  if (isAvif(bytes)) return 'avif';
  return undefined;
}

function hasBytes(bytes: Uint8Array, offset: number, signature: readonly number[]): boolean {
  if (bytes.byteLength < offset + signature.length) return false;
  return signature.every((byte, index) => bytes[offset + index] === byte);
}

function hasAscii(bytes: Uint8Array, offset: number, text: string): boolean {
  if (bytes.byteLength < offset + text.length) return false;
  for (let index = 0; index < text.length; index += 1) {
    if (bytes[offset + index] !== text.charCodeAt(index)) return false;
  }
  return true;
}

/** ISO BMFF: `ftyp` no offset 4 e brand `avif`/`avis` como major ou compatível. */
function isAvif(bytes: Uint8Array): boolean {
  if (bytes.byteLength < 12 || !hasAscii(bytes, 4, 'ftyp')) return false;
  const declared = readUint32BE(bytes, 0);
  if (declared !== 0 && declared < 12) return false;
  if (isAvifBrand(readBrand(bytes, 8))) return true;

  const end = declared === 0 ? bytes.byteLength : Math.min(bytes.byteLength, declared);
  for (let offset = 16; offset + 4 <= end; offset += 4) {
    if (isAvifBrand(readBrand(bytes, offset))) return true;
  }
  return false;
}

function isAvifBrand(brand: string | undefined): boolean {
  return brand !== undefined && AVIF_BRANDS.has(brand);
}

function readBrand(bytes: Uint8Array, offset: number): string | undefined {
  if (bytes.byteLength < offset + 4) return undefined;
  let brand = '';
  for (let index = 0; index < 4; index += 1) {
    const byte = bytes[offset + index] ?? 0;
    if (byte < 0x20 || byte > 0x7e) return undefined;
    brand += String.fromCharCode(byte);
  }
  return brand;
}

function readUint32BE(bytes: Uint8Array, offset: number): number {
  return (
    ((bytes[offset] ?? 0) * 0x1000000) +
    ((bytes[offset + 1] ?? 0) * 0x10000) +
    ((bytes[offset + 2] ?? 0) * 0x100) +
    (bytes[offset + 3] ?? 0)
  );
}
