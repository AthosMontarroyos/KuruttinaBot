import { describe, expect, it, vi } from 'vitest';
import { prepareEmojiImage } from '../apps/bot/src/application/emojis/prepareEmojiImage.js';
import {
  DEFAULT_EMOJI_IMAGE_LIMITS,
  EmojiImportError,
  type CompressedImage,
  type EmojiImageLimits,
  type EmojiImageProcessor,
  type ImageInspection,
} from '../apps/bot/src/application/emojis/types.js';

const STATIC_INSPECTION: ImageInspection = {
  format: 'png',
  width: 128,
  height: 128,
  frames: 1,
  totalDurationMs: 0,
};

const STATIC_COMPRESSION: CompressedImage = {
  bytes: Uint8Array.from([1, 2, 3]),
  contentType: 'image/png',
  animated: false,
  width: 64,
  height: 64,
  transformations: ['normalized_128'],
};

function processorStub(overrides?: Partial<EmojiImageProcessor>): EmojiImageProcessor {
  return {
    inspect: vi.fn(async () => STATIC_INSPECTION),
    compress: vi.fn(async () => STATIC_COMPRESSION),
    ...overrides,
  };
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] as const;

function pngBytes(...extra: number[]): Uint8Array {
  return Uint8Array.from([...PNG_SIGNATURE, ...extra]);
}

async function expectErrorCode(promise: Promise<unknown>, code: string): Promise<void> {
  await expect(promise).rejects.toBeInstanceOf(EmojiImportError);
  await expect(promise).rejects.toMatchObject({ code });
}

describe('preparação de imagem de emoji', () => {
  it('valida a origem, comprime e devolve o relatório da transformação', async () => {
    const processor = processorStub();
    const bytes = pngBytes(9, 9, 9);

    const prepared = await prepareEmojiImage({ bytes }, processor);

    expect(prepared.bytes).toBe(STATIC_COMPRESSION.bytes);
    expect(prepared.contentType).toBe('image/png');
    expect(prepared.animated).toBe(false);
    expect(prepared.width).toBe(64);
    expect(prepared.sourceBytes).toBe(11);
    expect(prepared.transformations).toEqual(['normalized_128']);
    expect(processor.inspect).toHaveBeenCalledTimes(1);
    expect(processor.compress).toHaveBeenCalledWith(bytes, {
      maxOutputBytes: DEFAULT_EMOJI_IMAGE_LIMITS.maxOutputBytes,
      maxEncodeAttempts: DEFAULT_EMOJI_IMAGE_LIMITS.maxEncodeAttempts,
      timeoutMs: DEFAULT_EMOJI_IMAGE_LIMITS.processingTimeoutMs,
      maxDecodedPixels: DEFAULT_EMOJI_IMAGE_LIMITS.maxDecodedPixels,
    });
  });

  it('rejeita entrada vazia', async () => {
    await expectErrorCode(prepareEmojiImage({ bytes: new Uint8Array(0) }, processorStub()), 'empty_input');
  });

  it('rejeita entrada acima do limite interno de bytes', async () => {
    const limits: EmojiImageLimits = { ...DEFAULT_EMOJI_IMAGE_LIMITS, maxInputBytes: 4 };
    await expectErrorCode(
      prepareEmojiImage({ bytes: new Uint8Array(5) }, processorStub(), limits),
      'input_too_large',
    );
  });

  it('rejeita animação com quadros acima do orçamento', async () => {
    const limits: EmojiImageLimits = { ...DEFAULT_EMOJI_IMAGE_LIMITS, maxFrames: 2 };
    const processor = processorStub({
      inspect: vi.fn(async () => ({ ...STATIC_INSPECTION, frames: 3 })),
    });
    await expectErrorCode(prepareEmojiImage({ bytes: pngBytes(1) }, processor, limits), 'too_many_frames');
  });

  it('rejeita imagem com volume de pixels acima do orçamento', async () => {
    const limits: EmojiImageLimits = { ...DEFAULT_EMOJI_IMAGE_LIMITS, maxDecodedPixels: 1_000 };
    const processor = processorStub({
      inspect: vi.fn(async () => ({ ...STATIC_INSPECTION, width: 200, height: 200 })),
    });
    await expectErrorCode(prepareEmojiImage({ bytes: pngBytes(1) }, processor, limits), 'too_many_pixels');
  });

  it('rejeita animação mais longa que o orçamento', async () => {
    const limits: EmojiImageLimits = { ...DEFAULT_EMOJI_IMAGE_LIMITS, maxDurationMs: 100 };
    const processor = processorStub({
      inspect: vi.fn(async () => ({ ...STATIC_INSPECTION, frames: 2, totalDurationMs: 101 })),
    });
    await expectErrorCode(prepareEmojiImage({ bytes: pngBytes(1) }, processor, limits), 'duration_exceeded');
  });

  it('falha fechado quando a saída comprimida ainda excede o limite do Discord', async () => {
    const limits: EmojiImageLimits = { ...DEFAULT_EMOJI_IMAGE_LIMITS, maxOutputBytes: 2 };
    const processor = processorStub({
      compress: vi.fn(async () => ({ ...STATIC_COMPRESSION, bytes: Uint8Array.from([1, 2, 3]) })),
    });
    await expectErrorCode(prepareEmojiImage({ bytes: pngBytes(1) }, processor, limits), 'size_unreachable');
  });

  it('nunca converte animação em estático silenciosamente', async () => {
    const processor = processorStub({
      inspect: vi.fn(async () => ({ ...STATIC_INSPECTION, frames: 2 })),
      compress: vi.fn(async () => ({ ...STATIC_COMPRESSION, contentType: 'image/gif' as const })),
    });
    await expectErrorCode(prepareEmojiImage({ bytes: pngBytes(1) }, processor), 'animation_lost');
  });

  it('preserva erros de domínio do processador', async () => {
    const processor = processorStub({
      inspect: vi.fn(async () => {
        throw new EmojiImportError('unsupported_format', 'Formato não suportado.');
      }),
    });
    await expectErrorCode(prepareEmojiImage({ bytes: pngBytes(1) }, processor), 'unsupported_format');
  });

  it('traduz falhas inesperadas do processador em erro sanitizado', async () => {
    const inspectingFailure = processorStub({
      inspect: vi.fn(async () => {
        throw new Error('EACCES /caminho/interno');
      }),
    });
    const inspectError = await prepareEmojiImage({ bytes: pngBytes(1) }, inspectingFailure).catch(
      (error: unknown) => error,
    );
    expect(inspectError).toBeInstanceOf(EmojiImportError);
    expect(inspectError).toMatchObject({ code: 'corrupt_image' });
    expect((inspectError as Error).message).not.toContain('EACCES');

    const compressFailing = processorStub({
      compress: vi.fn(async () => {
        throw new Error('ENOSPC disco cheio');
      }),
    });
    const compressError = await prepareEmojiImage({ bytes: pngBytes(1) }, compressFailing).catch(
      (error: unknown) => error,
    );
    expect(compressError).toBeInstanceOf(EmojiImportError);
    expect(compressError).toMatchObject({ code: 'corrupt_image' });
    expect((compressError as Error).message).not.toContain('ENOSPC');
  });

  it.each([
    ['SVG', new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"></svg>')],
    ['PDF', new TextEncoder().encode('%PDF-1.7\n')],
    ['bytes aleatórios', Uint8Array.from([1, 2, 3, 4, 5, 6, 7, 8])],
  ])('rejeita %s antes de decodificar', async (_label, bytes) => {
    const processor = processorStub();

    await expectErrorCode(prepareEmojiImage({ bytes }, processor), 'unsupported_format');

    expect(processor.inspect).not.toHaveBeenCalled();
    expect(processor.compress).not.toHaveBeenCalled();
  });

  it('rejeita quando o decodificador discorda da assinatura', async () => {
    const processor = processorStub({
      inspect: vi.fn(async () => ({ ...STATIC_INSPECTION, format: 'jpeg' as const })),
    });

    await expectErrorCode(prepareEmojiImage({ bytes: pngBytes(1) }, processor), 'corrupt_image');

    expect(processor.inspect).toHaveBeenCalledTimes(1);
    expect(processor.compress).not.toHaveBeenCalled();
  });
});
