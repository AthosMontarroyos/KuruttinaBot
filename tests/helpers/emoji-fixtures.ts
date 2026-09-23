import { createRequire } from 'node:module';
import sharp from 'sharp';
import type { GifencModule } from 'gifenc';

const requireGifenc = createRequire(import.meta.url);
const { GIFEncoder, quantize, applyPalette }: GifencModule = requireGifenc('gifenc');

export type RgbaColor = readonly [number, number, number, number];

export function solidRgbaFrame(width: number, height: number, color: RgbaColor): Uint8Array {
  const rgba = new Uint8Array(width * height * 4);
  for (let index = 0; index < width * height; index += 1) {
    rgba[index * 4] = color[0];
    rgba[index * 4 + 1] = color[1];
    rgba[index * 4 + 2] = color[2];
    rgba[index * 4 + 3] = color[3];
  }
  return rgba;
}

/** Quadro sólido com a metade direita totalmente transparente. */
export function transparentRightHalfFrame(width: number, height: number, color: RgbaColor): Uint8Array {
  const rgba = solidRgbaFrame(width, height, color);
  for (let y = 0; y < height; y += 1) {
    for (let x = Math.floor(width / 2); x < width; x += 1) {
      rgba[(y * width + x) * 4 + 3] = 0;
    }
  }
  return rgba;
}

/** Ruído determinístico (LCG) para fixtures que resistem à compressão. */
export function noiseRgbaFrame(width: number, height: number, seed = 1): Uint8Array {
  const rgba = new Uint8Array(width * height * 4);
  let state = seed >>> 0;
  for (let index = 0; index < rgba.length; index += 1) {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
    rgba[index] = (state >>> 24) & 0xff;
    if (index % 4 === 3) rgba[index] = 0xff;
  }
  return rgba;
}

export interface AnimatedGifFixture {
  readonly width: number;
  readonly height: number;
  readonly frames: readonly Uint8Array[];
  readonly delays: readonly number[];
  readonly maxColors?: number;
}

/**
 * Monta um GIF89a animado com uma única paleta global, transparência binária
 * e delays em milissegundos.
 */
export function encodeAnimatedGif(fixture: AnimatedGifFixture): Uint8Array {
  const { width, height, delays } = fixture;
  if (fixture.frames.length === 0 || fixture.frames.length !== delays.length) {
    throw new RangeError('fixtures de GIF exigem quadros e delays com o mesmo tamanho.');
  }
  const frameSize = width * height * 4;
  const frames = fixture.frames.map((frame) => {
    if (frame.byteLength !== frameSize) throw new RangeError('frame com tamanho incompatível.');
    return clearTransparentRgb(frame);
  });
  const combined = new Uint8Array(frameSize * frames.length);
  frames.forEach((frame, index) => {
    combined.set(frame, index * frameSize);
  });

  const hasTransparency = containsTransparency(combined);
  let palette = quantize(combined, Math.min(fixture.maxColors ?? 256, hasTransparency ? 255 : 256), {
    format: 'rgba4444',
    oneBitAlpha: true,
  });
  if (hasTransparency && !palette.some((entry) => (entry[3] ?? 255) === 0)) {
    palette = [...palette, [0, 0, 0, 0]];
  }
  const transparentIndex = palette.findIndex((entry) => (entry[3] ?? 255) === 0);

  const gif = GIFEncoder();
  frames.forEach((frame, order) => {
    const index = applyPalette(frame, palette, 'rgba4444');
    gif.writeFrame(index, width, height, {
      palette: order === 0 ? palette : undefined,
      delay: delays[order] ?? 100,
      transparent: transparentIndex >= 0,
      transparentIndex: transparentIndex >= 0 ? transparentIndex : 0,
      dispose: transparentIndex >= 0 ? 2 : undefined,
      repeat: order === 0 ? 0 : undefined,
    });
  });
  gif.finish();
  return gif.bytes();
}

/**
 * Zera o RGB de pixels totalmente transparentes. Sem isso, um pixel
 * `[255,0,0,0]` empata a distância contra a entrada transparente `[0,0,0,0]`
 * no `applyPalette` do gifenc e o mapeamento escolhe a cor opaca.
 */
function clearTransparentRgb(rgba: Uint8Array): Uint8Array {
  const cleared = new Uint8Array(rgba);
  for (let index = 0; index < cleared.length; index += 4) {
    if (cleared[index + 3] === 0) {
      cleared[index] = 0;
      cleared[index + 1] = 0;
      cleared[index + 2] = 0;
    }
  }
  return cleared;
}

function containsTransparency(rgba: Uint8Array): boolean {
  for (let index = 3; index < rgba.length; index += 4) {
    if ((rgba[index] ?? 255) <= 127) return true;
  }
  return false;
}

export async function solidPng(width: number, height: number, color: RgbaColor): Promise<Uint8Array> {
  const buffer = await sharp({ create: { width, height, channels: 4, background: { r: color[0], g: color[1], b: color[2], alpha: color[3] / 255 } } })
    .png()
    .toBuffer();
  return new Uint8Array(buffer);
}

export async function noisePng(width: number, height: number, seed = 7): Promise<Uint8Array> {
  const buffer = await sharp(Buffer.from(noiseRgbaFrame(width, height, seed)), {
    raw: { width, height, channels: 4 },
  })
    .png()
    .toBuffer();
  return new Uint8Array(buffer);
}

export async function jpegImage(width: number, height: number, color: RgbaColor): Promise<Uint8Array> {
  const buffer = await sharp({ create: { width, height, channels: 3, background: { r: color[0], g: color[1], b: color[2] } } })
    .jpeg()
    .toBuffer();
  return new Uint8Array(buffer);
}

export async function tiffImage(width: number, height: number): Promise<Uint8Array> {
  const buffer = await sharp({ create: { width, height, channels: 3, background: { r: 10, g: 20, b: 30 } } })
    .tiff()
    .toBuffer();
  return new Uint8Array(buffer);
}

export async function pngWithExif(width: number, height: number): Promise<Uint8Array> {
  const buffer = await sharp({ create: { width, height, channels: 4, background: { r: 1, g: 2, b: 3, alpha: 1 } } })
    .withExif({ IFD0: { Copyright: 'KuruttinaBot fixture' } })
    .png()
    .toBuffer();
  return new Uint8Array(buffer);
}
