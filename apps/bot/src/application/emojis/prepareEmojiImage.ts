import { sniffImageFormat } from './imageSignature.js';
import {
  DEFAULT_EMOJI_IMAGE_LIMITS,
  EmojiImportError,
  emojiError,
  inputTooLargeError,
  type EmojiImageLimits,
  type EmojiImageProcessor,
  type PreparedEmojiImage,
  type RawEmojiImage,
} from './types.js';

const genericProcessingFailure = (): EmojiImportError =>
  emojiError('corrupt_image', 'Não consegui processar a imagem enviada.');

const unsupportedFormat = (): EmojiImportError =>
  emojiError('unsupported_format', 'O formato não é suportado. Use PNG, JPEG, GIF, WebP ou AVIF.');

export async function prepareEmojiImage(
  raw: RawEmojiImage,
  processor: EmojiImageProcessor,
  limits: EmojiImageLimits = DEFAULT_EMOJI_IMAGE_LIMITS,
): Promise<PreparedEmojiImage> {
  if (raw.bytes.byteLength === 0) {
    throw emojiError('empty_input', 'A imagem enviada está vazia.');
  }
  if (raw.bytes.byteLength > limits.maxInputBytes) {
    throw inputTooLargeError(limits.maxInputBytes);
  }

  // Assinatura antes de qualquer decodificador: extensão e Content-Type não autorizam o arquivo.
  const sniffed = sniffImageFormat(raw.bytes);
  if (sniffed === undefined) throw unsupportedFormat();

  const inspection = await inspect(processor, raw.bytes);
  if (inspection.format !== sniffed) throw genericProcessingFailure();
  if (inspection.frames > limits.maxFrames) {
    throw emojiError('too_many_frames', `A animação excede ${limits.maxFrames} quadros.`);
  }
  if (inspection.width * inspection.height * inspection.frames > limits.maxDecodedPixels) {
    throw emojiError('too_many_pixels', 'A imagem excede o volume de pixels que consigo decodificar.');
  }
  if (inspection.totalDurationMs > limits.maxDurationMs) {
    throw emojiError('duration_exceeded', `A animação excede ${limits.maxDurationMs} ms de duração.`);
  }

  const compressed = await compress(processor, raw.bytes, {
    maxOutputBytes: limits.maxOutputBytes,
    maxEncodeAttempts: limits.maxEncodeAttempts,
    timeoutMs: limits.processingTimeoutMs,
    maxDecodedPixels: limits.maxDecodedPixels,
  });

  // Validação final defensiva: o Discord recusa qualquer coisa acima do limite.
  if (compressed.bytes.byteLength === 0 || compressed.bytes.byteLength > limits.maxOutputBytes) {
    throw emojiError('size_unreachable', 'A imagem continua acima do limite do Discord.');
  }
  const sourceAnimated = inspection.frames > 1;
  if (compressed.animated !== sourceAnimated) {
    throw emojiError(
      'animation_lost',
      'Não consegui preservar a animação dentro do limite do Discord.',
    );
  }

  return Object.freeze({
    bytes: compressed.bytes,
    contentType: compressed.contentType,
    animated: compressed.animated,
    width: compressed.width,
    height: compressed.height,
    sourceBytes: raw.bytes.byteLength,
    transformations: Object.freeze([...compressed.transformations]),
  });
}

async function inspect(
  processor: EmojiImageProcessor,
  bytes: Uint8Array,
): ReturnType<EmojiImageProcessor['inspect']> {
  try {
    return await processor.inspect(bytes);
  } catch (error: unknown) {
    if (error instanceof EmojiImportError) throw error;
    throw genericProcessingFailure();
  }
}

async function compress(
  processor: EmojiImageProcessor,
  bytes: Uint8Array,
  options: Parameters<EmojiImageProcessor['compress']>[1],
): ReturnType<EmojiImageProcessor['compress']> {
  try {
    return await processor.compress(bytes, options);
  } catch (error: unknown) {
    if (error instanceof EmojiImportError) throw error;
    throw genericProcessingFailure();
  }
}
