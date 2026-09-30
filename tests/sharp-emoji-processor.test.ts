import sharp from 'sharp';
import { describe, expect, it, vi } from 'vitest';
import { prepareEmojiImage } from '../apps/bot/src/application/emojis/prepareEmojiImage.js';
import { DEFAULT_EMOJI_IMAGE_LIMITS, EmojiImportError } from '../apps/bot/src/application/emojis/types.js';
import {
  createSharpEmojiProcessor,
  reduceGifFrames,
} from '../apps/bot/src/infrastructure/images/sharpEmojiProcessor.js';
import {
  encodeAnimatedGif,
  jpegImage,
  noisePng,
  noiseRgbaFrame,
  pngWithExif,
  solidPng,
  solidRgbaFrame,
  tiffImage,
  transparentRightHalfFrame,
} from './helpers/emoji-fixtures.js';

vi.setConfig({ testTimeout: 60_000 });

const LIMIT = 256 * 1024;
const processor = createSharpEmojiProcessor();

async function expectErrorCode(promise: Promise<unknown>, code: string): Promise<void> {
  await expect(promise).rejects.toBeInstanceOf(EmojiImportError);
  await expect(promise).rejects.toMatchObject({ code });
}

describe('processador de imagens de emoji (sharp)', () => {
  it('comprime e normaliza imagem estática grande', async () => {
    const source = await noisePng(512, 512);

    const prepared = await prepareEmojiImage({ bytes: source }, processor);

    expect(prepared.animated).toBe(false);
    expect(prepared.contentType).toBe('image/png');
    expect(prepared.bytes.byteLength).toBeLessThanOrEqual(LIMIT);
    expect(prepared.width).toBeLessThanOrEqual(128);
    expect(prepared.height).toBeLessThanOrEqual(128);
    expect(prepared.transformations).toContain('normalized_128');
    expect(prepared.sourceBytes).toBe(source.byteLength);
  });

  it('não amplia imagens menores que 128 px', async () => {
    const source = await solidPng(64, 64, [10, 200, 30, 1]);

    const prepared = await prepareEmojiImage({ bytes: source }, processor);

    expect(prepared.width).toBe(64);
    expect(prepared.height).toBe(64);
    expect(prepared.transformations).not.toContain('normalized_128');
  });

  it('remove metadados (EXIF) na saída', async () => {
    const source = await pngWithExif(100, 100);
    const sourceMeta = await sharp(Buffer.from(source)).metadata();
    expect(sourceMeta.exif).toBeDefined();

    const prepared = await prepareEmojiImage({ bytes: source }, processor);

    const outputMeta = await sharp(Buffer.from(prepared.bytes)).metadata();
    expect(outputMeta.exif).toBeUndefined();
  });

  it('converte JPEG em PNG', async () => {
    const source = await jpegImage(200, 200, [40, 50, 60, 1]);

    const prepared = await prepareEmojiImage({ bytes: source }, processor);

    expect(prepared.contentType).toBe('image/png');
    await expect(processor.inspect(prepared.bytes)).resolves.toMatchObject({ format: 'png' });
  });

  it('rejeita formato fora da allowlist do Discord', async () => {
    const source = await tiffImage(32, 32);
    await expectErrorCode(prepareEmojiImage({ bytes: source }, processor), 'unsupported_format');
  });

  it('rejeita arquivo corrompido', async () => {
    const pngHeader = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0]);
    await expectErrorCode(prepareEmojiImage({ bytes: pngHeader }, processor), 'corrupt_image');
  });

  it('preserva animação, transparência e duração de GIF', async () => {
    const source = encodeAnimatedGif({
      width: 64,
      height: 64,
      frames: [
        transparentRightHalfFrame(64, 64, [255, 0, 0, 255]),
        transparentRightHalfFrame(64, 64, [0, 255, 0, 255]),
      ],
      delays: [80, 120],
    });

    const prepared = await prepareEmojiImage({ bytes: source }, processor);

    expect(prepared.animated).toBe(true);
    expect(prepared.contentType).toBe('image/gif');
    expect(prepared.bytes.byteLength).toBeLessThanOrEqual(LIMIT);
    const info = await processor.inspect(prepared.bytes);
    expect(info.frames).toBe(2);
    expect(info.totalDurationMs).toBe(200);

    const raw = await sharp(Buffer.from(prepared.bytes), { animated: true })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const frameHeight = raw.info.height / 2;
    const alphaAt = (frame: number, x: number, y: number): number =>
      raw.data[(((frame * frameHeight + y) * raw.info.width + x) * raw.info.channels) + 3] ?? 255;
    expect(alphaAt(0, 10, 10)).toBe(255);
    expect(alphaAt(0, 60, 10)).toBe(0);
    expect(alphaAt(1, 10, 10)).toBe(255);
  });

  it('rejeita animação acima do orçamento de quadros', async () => {
    const source = encodeAnimatedGif({
      width: 32,
      height: 32,
      frames: [
        solidRgbaFrame(32, 32, [255, 0, 0, 255]),
        solidRgbaFrame(32, 32, [0, 255, 0, 255]),
        solidRgbaFrame(32, 32, [0, 0, 255, 255]),
      ],
      delays: [50, 50, 50],
    });
    const fullLimits = { ...DEFAULT_EMOJI_IMAGE_LIMITS, maxFrames: 2 };

    await expectErrorCode(prepareEmojiImage({ bytes: source }, processor, fullLimits), 'too_many_frames');
  });

  it('reporta tamanho inatingível quando o limite é absurdo', async () => {
    const source = await solidPng(64, 64, [5, 5, 5, 1]);
    const limits = { ...DEFAULT_EMOJI_IMAGE_LIMITS, maxOutputBytes: 8 };

    await expectErrorCode(prepareEmojiImage({ bytes: source }, processor, limits), 'size_unreachable');
  });

  it('reporta timeout quando o orçamento de tempo é zero', async () => {
    const source = await solidPng(64, 64, [5, 5, 5, 1]);
    const limits = { ...DEFAULT_EMOJI_IMAGE_LIMITS, processingTimeoutMs: 0 };

    await expectErrorCode(prepareEmojiImage({ bytes: source }, processor, limits), 'processing_timeout');
  });

  it('comprime GIF barulhento até 256 KiB preservando a animação', async () => {
    const frames = Array.from({ length: 160 }, (_unused, index) => noiseRgbaFrame(64, 64, index + 1));
    const source = encodeAnimatedGif({ width: 64, height: 64, frames, delays: frames.map(() => 20), maxColors: 64 });
    expect(source.byteLength).toBeGreaterThan(LIMIT);

    const prepared = await prepareEmojiImage({ bytes: source }, processor);

    expect(prepared.animated).toBe(true);
    expect(prepared.bytes.byteLength).toBeLessThanOrEqual(LIMIT);
    expect(prepared.transformations).toContain('palette_reduced');
    const info = await processor.inspect(prepared.bytes);
    expect(info.frames).toBeGreaterThanOrEqual(2);
    expect(info.totalDurationMs).toBe(160 * 20);
  });
});

describe('redução de quadros de GIF (última instância)', () => {
  it('reduz quadros preservando duração total, transparência e loop', async () => {
    const source = encodeAnimatedGif({
      width: 64,
      height: 64,
      frames: [
        transparentRightHalfFrame(64, 64, [40, 120, 200, 255]),
        transparentRightHalfFrame(64, 64, [90, 120, 200, 255]),
        transparentRightHalfFrame(64, 64, [140, 120, 200, 255]),
        transparentRightHalfFrame(64, 64, [190, 120, 200, 255]),
      ],
      delays: [50, 50, 50, 50],
    });

    const reduced = await reduceGifFrames(source, {
      keepEvery: 2,
      maxColors: 64,
      timeoutMs: 10_000,
      maxDecodedPixels: 16_000_000,
    });

    expect(reduced).not.toBeNull();
    expect(reduced?.frames).toBe(2);
    expect(reduced?.totalDurationMs).toBe(200);

    const meta = await sharp(Buffer.from(reduced!.bytes)).metadata();
    expect(meta.pages).toBe(2);
    expect(meta.delay).toEqual([100, 100]);
    expect(meta.loop).toBe(0);

    const raw = await sharp(Buffer.from(reduced!.bytes), { animated: true })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const frameHeight = raw.info.height / 2;
    const alphaAt = (x: number, y: number): number =>
      raw.info.channels === 4
        ? (raw.data[(y * raw.info.width + x) * 4 + 3] ?? 255)
        : 255;
    expect(alphaAt(60, 10)).toBe(0);
    expect(alphaAt(10, 10)).toBe(255);
  });

  it('desiste quando a redução deixaria a animação com menos de 2 quadros', async () => {
    const source = encodeAnimatedGif({
      width: 32,
      height: 32,
      frames: [solidRgbaFrame(32, 32, [1, 2, 3, 255]), solidRgbaFrame(32, 32, [4, 5, 6, 255])],
      delays: [100, 100],
    });

    const reduced = await reduceGifFrames(source, {
      keepEvery: 4,
      maxColors: 64,
      timeoutMs: 10_000,
      maxDecodedPixels: 16_000_000,
    });

    expect(reduced).toBeNull();
  });
});
