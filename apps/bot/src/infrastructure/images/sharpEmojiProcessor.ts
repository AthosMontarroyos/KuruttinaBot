import { createRequire } from 'node:module';
import sharp, { type GifOptions, type Metadata, type PngOptions, type ResizeOptions } from 'sharp';
import type { GifencModule } from 'gifenc';
import {
  EmojiImportError,
  emojiError,
  SUPPORTED_EMOJI_IMAGE_FORMATS,
  type CompressedImage,
  type EmojiCompressionOptions,
  type EmojiImageProcessor,
  type EmojiTransformation,
  type ImageInspection,
  type SupportedEmojiImageFormat,
} from '#bot/application/emojis/types.js';

// `gifenc` publica CJS (`main`) e ESM (`module`); o require explícito resolve
// o mesmo formato no Node do bot e no vitest, sem depender da interop.
const requireGifenc = createRequire(import.meta.url);
const { GIFEncoder, quantize, applyPalette }: GifencModule = requireGifenc('gifenc');

const EMOJI_SIZE = 128;
const DEFAULT_FRAME_DELAY_MS = 100;
const PALETTE_SAMPLE_FRAMES = 8;

/**
 * Reduz para caber em 128×128 sem nunca ampliar. `fit: 'inside'` +
 * `withoutEnlargement` evita o upscale que, em GIFs com transparência,
 * corrompe o alfa no caminho animado do libvips.
 */
const RESIZE_OPTIONS: ResizeOptions = Object.freeze({
  fit: 'inside',
  width: EMOJI_SIZE,
  height: EMOJI_SIZE,
  background: { r: 0, g: 0, b: 0, alpha: 0 },
  withoutEnlargement: true,
});

interface EncodedAttempt {
  readonly bytes: Uint8Array;
  readonly width: number;
  readonly height: number;
}

interface EncodeStep {
  readonly transformations?: readonly EmojiTransformation[];
  /** Pode retornar `null` quando a etapa não se aplica (ex.: redução sem efeito). */
  readonly run: (timeoutMs: number) => Promise<EncodedAttempt | null>;
}

let sharpConfigured = false;

/** Limita CPU/memória: uma codificação por vez e cache do libvips reduzido. */
function configureSharp(): void {
  if (sharpConfigured) return;
  sharp.concurrency(1);
  sharp.cache({ memory: 64, files: 0, items: 64 });
  sharpConfigured = true;
}

export function createSharpEmojiProcessor(): EmojiImageProcessor {
  configureSharp();
  return { inspect, compress };
}

function isSupportedFormat(format: string): format is SupportedEmojiImageFormat {
  return (SUPPORTED_EMOJI_IMAGE_FORMATS as readonly string[]).includes(format);
}

function asBuffer(bytes: Uint8Array): Buffer {
  return Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

function timeoutOptions(timeoutMs: number): { seconds: number } {
  return { seconds: Math.max(1, Math.ceil(timeoutMs / 1000)) };
}

async function readMetadata(bytes: Uint8Array): Promise<Metadata> {
  try {
    return await sharp(asBuffer(bytes), { limitInputPixels: false }).metadata();
  } catch {
    throw emojiError('corrupt_image', 'Não consegui decodificar a imagem enviada.');
  }
}

async function inspect(bytes: Uint8Array): Promise<ImageInspection> {
  const metadata = await readMetadata(bytes);
  const format = metadata.format;
  if (!format || !isSupportedFormat(format)) {
    throw emojiError('unsupported_format', 'O formato não é suportado. Use PNG, JPEG, GIF, WebP ou AVIF.');
  }
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;
  if (width < 1 || height < 1) {
    throw emojiError('corrupt_image', 'A imagem enviada não tem dimensões válidas.');
  }
  const frames = metadata.pages !== undefined && metadata.pages > 0 ? metadata.pages : 1;
  const delays = metadata.delay;
  const totalDurationMs = Array.isArray(delays) ? delays.reduce((sum, value) => sum + value, 0) : 0;
  return { format, width, height, frames, totalDurationMs };
}

/**
 * Escada de codificação: tenta primeiro a melhor qualidade e só aumenta a
 * agressividade (paleta, dither, quadros) enquanto a saída exceder 256 KiB.
 * Interrompe na primeira saída dentro do limite; nunca desanima silenciosamente.
 */
async function compress(bytes: Uint8Array, options: EmojiCompressionOptions): Promise<CompressedImage> {
  const startedAt = Date.now();
  const inspection = await inspect(bytes);
  const animated = inspection.frames > 1;
  const transformations = new Set<EmojiTransformation>();
  if (inspection.width > EMOJI_SIZE || inspection.height > EMOJI_SIZE) {
    transformations.add('normalized_128');
  }

  const steps = animated ? createAnimatedSteps(bytes, options) : createStaticSteps(bytes, options);
  const attemptLimit = Math.min(steps.length, options.maxEncodeAttempts);
  let animationLost = false;
  for (let index = 0; index < attemptLimit; index += 1) {
    const step = steps[index];
    if (!step) break;
    const remainingMs = options.timeoutMs - (Date.now() - startedAt);
    if (remainingMs <= 0) {
      throw emojiError('processing_timeout', 'Não consegui processar a imagem dentro do tempo limite.');
    }

    let encoded: EncodedAttempt | null;
    try {
      encoded = await step.run(remainingMs);
    } catch (error: unknown) {
      if (error instanceof EmojiImportError) throw error;
      if (error instanceof Error && /timeout/iu.test(error.message)) {
        throw emojiError('processing_timeout', 'Não consegui processar a imagem dentro do tempo limite.');
      }
      throw error;
    }
    if (!encoded) continue;
    for (const transformation of step.transformations ?? []) transformations.add(transformation);
    if (encoded.bytes.byteLength > options.maxOutputBytes) continue;

    if (animated) {
      const produced = await inspect(encoded.bytes);
      if (produced.frames < 2) {
        // O libvips funde quadros iguais ou quase iguais: tenta o próximo degrau
        // (o gifenc não funde) antes de desistir.
        animationLost = true;
        continue;
      }
      return finish(encoded, 'image/gif', true, transformations);
    }
    return finish(encoded, 'image/png', false, transformations);
  }
  if (animationLost) {
    throw emojiError('animation_lost', 'Não consegui preservar a animação dentro do limite do Discord.');
  }
  throw emojiError(
    'size_unreachable',
    `Não consegui comprimir a imagem para até ${options.maxOutputBytes} bytes.`,
  );
}

function finish(
  encoded: EncodedAttempt,
  contentType: 'image/png' | 'image/gif',
  animated: boolean,
  transformations: ReadonlySet<EmojiTransformation>,
): CompressedImage {
  return {
    bytes: encoded.bytes,
    contentType,
    animated,
    width: encoded.width,
    height: encoded.height,
    transformations: [...transformations],
  };
}

function createStaticSteps(bytes: Uint8Array, options: EmojiCompressionOptions): EncodeStep[] {
  const encode = (png: PngOptions) => async (timeoutMs: number): Promise<EncodedAttempt> => {
    const { data, info } = await sharp(asBuffer(bytes), { limitInputPixels: options.maxDecodedPixels })
      .rotate()
      .toColourspace('srgb')
      .resize(RESIZE_OPTIONS)
      .png(png)
      .timeout(timeoutOptions(timeoutMs))
      .toBuffer({ resolveWithObject: true });
    return { bytes: data, width: info.width, height: info.height };
  };

  return [
    { run: encode({ compressionLevel: 9, adaptiveFiltering: true }) },
    {
      transformations: ['palette_reduced'],
      run: encode({ palette: true, quality: 100, colors: 256, dither: 1, compressionLevel: 9 }),
    },
    {
      transformations: ['palette_reduced'],
      run: encode({ palette: true, quality: 80, colors: 128, dither: 1, compressionLevel: 9 }),
    },
    {
      transformations: ['palette_reduced', 'dithering_reduced'],
      run: encode({ palette: true, quality: 60, colors: 64, dither: 0.5, compressionLevel: 9 }),
    },
    {
      transformations: ['palette_reduced', 'dithering_reduced'],
      run: encode({ palette: true, quality: 45, colors: 32, dither: 0, compressionLevel: 9 }),
    },
  ];
}

function createAnimatedSteps(bytes: Uint8Array, options: EmojiCompressionOptions): EncodeStep[] {
  const encode = (gif: GifOptions) => async (timeoutMs: number): Promise<EncodedAttempt> => {
    const { data, info } = await sharp(asBuffer(bytes), {
      animated: true,
      limitInputPixels: options.maxDecodedPixels,
    })
      .toColourspace('srgb')
      .resize(RESIZE_OPTIONS)
      .gif(gif)
      .timeout(timeoutOptions(timeoutMs))
      .toBuffer({ resolveWithObject: true });
    return { bytes: data, width: info.width, height: info.height };
  };
  const reduce = (keepEvery: number, maxColors: number) => async (timeoutMs: number): Promise<EncodedAttempt | null> => {
    const reduced = await reduceGifFrames(bytes, {
      keepEvery,
      maxColors,
      timeoutMs,
      maxDecodedPixels: options.maxDecodedPixels,
    });
    if (!reduced) return null;
    return { bytes: reduced.bytes, width: reduced.width, height: reduced.height };
  };

  return [
    { run: encode({ effort: 10, colors: 256, dither: 1, interFrameMaxError: 0 }) },
    {
      transformations: ['palette_reduced'],
      run: encode({ effort: 10, colors: 192, dither: 0.75, interFrameMaxError: 10 }),
    },
    {
      transformations: ['palette_reduced'],
      run: encode({ effort: 10, colors: 128, dither: 0.5, interFrameMaxError: 18 }),
    },
    {
      transformations: ['palette_reduced', 'dithering_reduced'],
      run: encode({ effort: 10, colors: 64, dither: 0.25, interFrameMaxError: 26 }),
    },
    {
      transformations: ['palette_reduced', 'dithering_reduced'],
      run: encode({ effort: 10, colors: 32, dither: 0, interFrameMaxError: 32 }),
    },
    // Sem remover quadros: o gifenc não funde quadros iguais, ao contrário do libvips.
    { transformations: ['palette_reduced'], run: reduce(1, 128) },
    { transformations: ['frames_reduced'], run: reduce(2, 64) },
    { transformations: ['frames_reduced'], run: reduce(3, 32) },
  ];
}

export interface GifFrameReductionOptions {
  readonly keepEvery: number;
  readonly maxColors: number;
  readonly timeoutMs: number;
  readonly maxDecodedPixels: number;
}

export interface ReducedGif {
  readonly bytes: Uint8Array;
  readonly width: number;
  readonly height: number;
  readonly frames: number;
  readonly totalDurationMs: number;
}

/**
 * Última instância da escada: remove quadros do GIF preservando a duração
 * total (o tempo de cada quadro removido é absorvido pelo anterior mantido),
 * transparência e o loop. Retorna `null` quando a redução deixaria a animação
 * com menos de 2 quadros.
 */
export async function reduceGifFrames(
  source: Uint8Array,
  options: GifFrameReductionOptions,
): Promise<ReducedGif | null> {
  const metadata = await readMetadata(source);
  const pages = metadata.pages !== undefined && metadata.pages > 0 ? metadata.pages : 1;
  if (pages < 2 || !Number.isInteger(options.keepEvery) || options.keepEvery < 1) return null;
  const keptCount = Math.ceil(pages / options.keepEvery);
  if (keptCount < 2) return null;

  const { data, info } = await sharp(asBuffer(source), {
    animated: true,
    limitInputPixels: options.maxDecodedPixels,
  })
    .resize(RESIZE_OPTIONS)
    .ensureAlpha()
    .raw()
    .timeout(timeoutOptions(options.timeoutMs))
    .toBuffer({ resolveWithObject: true });

  const frameCount = info.pages !== undefined && info.pages > 0 ? info.pages : 1;
  const channels = info.channels;
  if (channels !== 3 && channels !== 4) {
    throw emojiError('corrupt_image', 'Não consegui converter a animação.');
  }
  const totalRows = data.length / (info.width * channels);
  if (!Number.isInteger(totalRows) || frameCount < 1 || totalRows % frameCount !== 0) {
    throw emojiError('corrupt_image', 'Não consegui converter a animação.');
  }
  const frameHeight = totalRows / frameCount;
  const rgba = channels === 4 ? data : expandToRgba(data, data.length / channels);
  clearTransparentRgb(rgba);
  const frameSize = info.width * frameHeight * 4;

  const delays = Array.isArray(metadata.delay) ? metadata.delay : [];
  const kept: Array<{ srcIndex: number; delay: number }> = [];
  for (let index = 0; index < frameCount; index += options.keepEvery) {
    const end = Math.min(index + options.keepEvery, frameCount);
    let delay = 0;
    for (let sourceIndex = index; sourceIndex < end; sourceIndex += 1) {
      delay += delays[sourceIndex] ?? DEFAULT_FRAME_DELAY_MS;
    }
    kept.push({ srcIndex: index, delay });
  }

  const copyFrame = (srcIndex: number): Uint8Array => {
    const start = srcIndex * frameSize;
    const copy = new Uint8Array(frameSize);
    copy.set(rgba.subarray(start, start + frameSize));
    return copy;
  };

  // Paleta única a partir de uma amostra dos quadros mantidos.
  const sampleCount = Math.min(kept.length, PALETTE_SAMPLE_FRAMES);
  const combined = new Uint8Array(frameSize * sampleCount);
  for (let index = 0; index < sampleCount; index += 1) {
    const entry = kept[Math.floor((index * kept.length) / sampleCount)];
    if (entry) combined.set(copyFrame(entry.srcIndex), index * frameSize);
  }
  const hasTransparency = containsTransparency(combined);
  const budget = Math.min(options.maxColors, hasTransparency ? 255 : 256);
  let palette = quantize(combined, budget, { format: 'rgba4444', oneBitAlpha: true });
  if (hasTransparency && !palette.some(isTransparentEntry)) palette = [...palette, [0, 0, 0, 0]];
  const transparentIndex = palette.findIndex(isTransparentEntry);

  // gifenc lê `rgba.buffer` inteiro (ignora byteOffset): cada quadro é copiado
  // para um buffer próprio antes de aplicar a paleta.
  const gif = GIFEncoder();
  for (const [order, entry] of kept.entries()) {
    const frame = copyFrame(entry.srcIndex);
    const index = applyPalette(frame, palette, 'rgba4444');
    gif.writeFrame(index, info.width, frameHeight, {
      palette: order === 0 ? palette : undefined,
      delay: entry.delay,
      transparent: transparentIndex >= 0,
      transparentIndex: transparentIndex >= 0 ? transparentIndex : 0,
      dispose: transparentIndex >= 0 ? 2 : undefined,
      repeat: order === 0 ? metadata.loop ?? 0 : undefined,
    });
  }
  gif.finish();

  return {
    bytes: gif.bytes(),
    width: info.width,
    height: frameHeight,
    frames: kept.length,
    totalDurationMs: kept.reduce((sum, entry) => sum + entry.delay, 0),
  };
}

function isTransparentEntry(entry: number[]): boolean {
  return (entry[3] ?? 255) === 0;
}

/**
 * Zera o RGB de pixels com alfa 0 no buffer decodificado. Decodificadores de
 * GIF preservam a cor da paleta sob o índice transparente; sem a normalização,
 * esses pixels empatam a distância na paleta do gifenc e a animação perde
 * transparência na etapa de redução de quadros.
 */
function clearTransparentRgb(rgba: Uint8Array): void {
  for (let index = 0; index < rgba.length; index += 4) {
    if (rgba[index + 3] === 0) {
      rgba[index] = 0;
      rgba[index + 1] = 0;
      rgba[index + 2] = 0;
    }
  }
}

function containsTransparency(rgba: Uint8Array): boolean {
  for (let index = 3; index < rgba.length; index += 4) {
    if ((rgba[index] ?? 255) <= 127) return true;
  }
  return false;
}

function expandToRgba(data: Uint8Array, pixelCount: number): Uint8Array {
  const rgba = new Uint8Array(pixelCount * 4);
  for (let index = 0; index < pixelCount; index += 1) {
    rgba[index * 4] = data[index * 3] ?? 0;
    rgba[index * 4 + 1] = data[index * 3 + 1] ?? 0;
    rgba[index * 4 + 2] = data[index * 3 + 2] ?? 0;
    rgba[index * 4 + 3] = 255;
  }
  return rgba;
}
