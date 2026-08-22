import sharp from 'sharp';

export const DISCORD_EMOJI_MAX_BYTES = 256 * 1024;
export const EMOJI_SOURCE_MAX_BYTES = 10 * 1024 * 1024;

// Leave a small margin so the API never receives a borderline 256 KiB payload.
const EMOJI_TARGET_BYTES = 255 * 1024;
const IMAGE_MAX_DIMENSION = 4_096;
const IMAGE_MAX_FRAMES = 200;
const IMAGE_MAX_TOTAL_PIXELS = 32 * 1024 * 1024;

const IMAGE_FORMAT_BY_MIME_TYPE = new Map<string, string>([
  ['image/gif', 'gif'],
  ['image/jpeg', 'jpeg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
  ['image/avif', 'heif'],
]);

export interface EmojiSourceHints {
  contentType?: string | null;
  size?: number;
  consumer?: 'emoji-add' | 'dev-emoji-add';
}

type ImageAuditFailureReason =
  | 'source_unavailable_or_http_validation_failed'
  | 'source_too_large'
  | 'empty_source_body'
  | 'mime_format_mismatch'
  | 'invalid_dimensions'
  | 'unsafe_image_complexity'
  | 'sanitization_failed'
  | 'malformed_or_truncated_image'
  | 'invalid_attachment_size'
  | 'unsupported_attachment_mime'
  | 'attachment_size_mismatch'
  | 'attachment_mime_mismatch';

type ImageAuditDetail = string | number | boolean | null;

interface ImageAuditFailure {
  reason: ImageAuditFailureReason;
  details?: Record<string, ImageAuditDetail>;
}

type ImagePreparationResult =
  | { ok: true; dataUri: string }
  | { ok: false; failure: ImageAuditFailure };

interface AnimatedCompressionPreset {
  size: number;
  colours: number;
  dither: number;
  interFrameMaxError: number;
}

const ANIMATED_PRESETS: AnimatedCompressionPreset[] = [
  { size: 128, colours: 256, dither: 1, interFrameMaxError: 0 },
  { size: 128, colours: 192, dither: 0.8, interFrameMaxError: 4 },
  { size: 112, colours: 128, dither: 0.7, interFrameMaxError: 8 },
  { size: 96, colours: 96, dither: 0.5, interFrameMaxError: 12 },
  { size: 80, colours: 64, dither: 0.35, interFrameMaxError: 18 },
  { size: 64, colours: 48, dither: 0.2, interFrameMaxError: 24 },
  { size: 48, colours: 32, dither: 0, interFrameMaxError: 32 },
];

const STATIC_PRESETS = [
  { size: 128, quality: 92 },
  { size: 128, quality: 82 },
  { size: 112, quality: 76 },
  { size: 96, quality: 68 },
  { size: 80, quality: 58 },
  { size: 64, quality: 48 },
];

function toDataUri(buffer: Buffer, contentType: string): string {
  return `data:${contentType};base64,${buffer.toString('base64')}`;
}

function normalizeContentType(contentType: string | null): string {
  return (contentType || '').split(';')[0].trim().toLowerCase();
}

function isSupportedContentType(contentType: string): boolean {
  return IMAGE_FORMAT_BY_MIME_TYPE.has(contentType);
}

function logImageAuditRejection(
  source: string,
  hints: EmojiSourceHints,
  failure: ImageAuditFailure
): void {
  const sourceKind =
    hints.size !== undefined || hints.contentType !== undefined
      ? 'discord_attachment'
      : /<a?:[A-Za-z0-9_]+:(\d+)>/.test(source)
        ? 'custom_emoji'
        : 'remote_url';

  const entry: Record<string, ImageAuditDetail> = {
    event: 'untrusted_image_rejected',
    consumer: hints.consumer || 'unknown',
    sourceKind,
    reason: failure.reason,
  };

  if (hints.contentType !== undefined) {
    entry.declaredContentType = normalizeContentType(hints.contentType || null) || null;
  }
  if (hints.size !== undefined) entry.declaredSize = hints.size;
  if (failure.details) Object.assign(entry, failure.details);

  // Never include file bytes, filenames, signed URLs, tokens or Discord IDs here.
  console.warn('🛡️ [FileAudit]', JSON.stringify(entry));
}

async function readBodyWithLimit(response: Response): Promise<Buffer | null> {
  const contentLength = response.headers.get('content-length');
  if (contentLength && /^\d+$/.test(contentLength)) {
    const declaredLength = Number(contentLength);
    if (!Number.isSafeInteger(declaredLength) || declaredLength > EMOJI_SOURCE_MAX_BYTES) {
      await response.body?.cancel().catch(() => undefined);
      return null;
    }
  }

  if (!response.body) return null;

  const reader = response.body.getReader();
  const chunks: Buffer[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      totalBytes += value.byteLength;
      if (totalBytes > EMOJI_SOURCE_MAX_BYTES) {
        await reader.cancel().catch(() => undefined);
        return null;
      }

      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }

  return totalBytes > 0 ? Buffer.concat(chunks, totalBytes) : null;
}

async function downloadImage(url: string): Promise<{ buffer: Buffer; contentType: string } | null> {
  try {
    const parsedUrl = new URL(url);
    if (!['http:', 'https:'].includes(parsedUrl.protocol) || parsedUrl.username || parsedUrl.password) {
      return null;
    }

    const response = await fetch(parsedUrl, { signal: AbortSignal.timeout(15_000) });
    if (!response.ok) return null;

    const contentType = normalizeContentType(response.headers.get('content-type'));
    if (!isSupportedContentType(contentType)) {
      await response.body?.cancel().catch(() => undefined);
      return null;
    }

    const buffer = await readBodyWithLimit(response);
    if (!buffer) return null;

    return {
      buffer,
      contentType,
    };
  } catch {
    return null;
  }
}

function getDownloadCandidates(source: string): string[] {
  const customEmojiMatch = source.match(/<a?:[A-Za-z0-9_]+:(\d+)>/);
  if (!customEmojiMatch) return [source];

  const animated = source.startsWith('<a:');
  const emojiId = customEmojiMatch[1];
  const extensions = animated ? ['gif', 'webp', 'png'] : ['webp', 'png', 'gif'];

  return extensions.map((extension) => {
    const animatedQuery = extension === 'webp' && animated ? '&animated=true' : '';
    return `https://cdn.discordapp.com/emojis/${emojiId}.${extension}?size=128&quality=lossless${animatedQuery}`;
  });
}

async function compressAnimatedImage(input: Buffer): Promise<Buffer | null> {
  for (const preset of ANIMATED_PRESETS) {
    const output = await sharp(input, {
      animated: true,
      failOn: 'warning',
      limitInputPixels: IMAGE_MAX_TOTAL_PIXELS,
    })
      .resize(preset.size, preset.size, { fit: 'inside', withoutEnlargement: true })
      .gif({
        colours: preset.colours,
        dither: preset.dither,
        effort: 10,
        interFrameMaxError: preset.interFrameMaxError,
        interPaletteMaxError: Math.max(3, preset.interFrameMaxError),
        keepDuplicateFrames: false,
      })
      .toBuffer();

    if (output.length <= EMOJI_TARGET_BYTES) return output;
  }

  return null;
}

async function compressStaticImage(input: Buffer): Promise<Buffer | null> {
  for (const preset of STATIC_PRESETS) {
    const output = await sharp(input, {
      failOn: 'warning',
      limitInputPixels: IMAGE_MAX_TOTAL_PIXELS,
    })
      .resize(preset.size, preset.size, { fit: 'inside', withoutEnlargement: true })
      .webp({
        quality: preset.quality,
        alphaQuality: preset.quality,
        effort: 6,
        smartSubsample: true,
      })
      .toBuffer();

    if (output.length <= EMOJI_TARGET_BYTES) return output;
  }

  return null;
}

async function prepareDiscordEmojiDataUri(
  buffer: Buffer,
  declaredContentType: string
): Promise<ImagePreparationResult> {
  if (buffer.length === 0) {
    return { ok: false, failure: { reason: 'empty_source_body' } };
  }
  if (buffer.length > EMOJI_SOURCE_MAX_BYTES) {
    return {
      ok: false,
      failure: { reason: 'source_too_large', details: { receivedBytes: buffer.length } },
    };
  }

  try {
    const metadata = await sharp(buffer, {
      animated: true,
      failOn: 'warning',
      limitInputPixels: IMAGE_MAX_TOTAL_PIXELS,
    }).metadata();

    const expectedFormat = IMAGE_FORMAT_BY_MIME_TYPE.get(declaredContentType);
    const width = metadata.width || 0;
    const frameHeight = metadata.pageHeight || metadata.height || 0;
    const frames = metadata.pages || 1;
    const totalPixels = width * frameHeight * frames;

    if (!expectedFormat || metadata.format !== expectedFormat) {
      return {
        ok: false,
        failure: {
          reason: 'mime_format_mismatch',
          details: {
            declaredContentType,
            detectedFormat: metadata.format || null,
          },
        },
      };
    }

    if (
      width <= 0 ||
      frameHeight <= 0 ||
      width > IMAGE_MAX_DIMENSION ||
      frameHeight > IMAGE_MAX_DIMENSION
    ) {
      return {
        ok: false,
        failure: { reason: 'invalid_dimensions', details: { width, frameHeight } },
      };
    }

    if (
      frames > IMAGE_MAX_FRAMES ||
      !Number.isSafeInteger(totalPixels) ||
      totalPixels > IMAGE_MAX_TOTAL_PIXELS
    ) {
      return {
        ok: false,
        failure: {
          reason: 'unsafe_image_complexity',
          details: { width, frameHeight, frames, totalPixels },
        },
      };
    }

    const isAnimated = frames > 1;
    const sanitized = isAnimated
      ? await compressAnimatedImage(buffer)
      : await compressStaticImage(buffer);

    if (!sanitized) {
      return { ok: false, failure: { reason: 'sanitization_failed' } };
    }

    return {
      ok: true,
      dataUri: toDataUri(sanitized, isAnimated ? 'image/gif' : 'image/webp'),
    };
  } catch {
    return {
      ok: false,
      failure: { reason: 'malformed_or_truncated_image' },
    };
  }
}

/**
 * Downloads, verifies and sanitizes an untrusted emoji/image before returning a
 * Discord-compatible data URI at most 128x128 and below the 256 KiB API limit.
 */
export async function fetchDiscordEmojiDataUri(
  source: string,
  hints: EmojiSourceHints = {}
): Promise<string | null> {
  const hintedContentType =
    hints.contentType === undefined || hints.contentType === null
      ? null
      : normalizeContentType(hints.contentType);

  if (
    hints.size !== undefined &&
    (!Number.isSafeInteger(hints.size) || hints.size <= 0 || hints.size > EMOJI_SOURCE_MAX_BYTES)
  ) {
    logImageAuditRejection(source, hints, { reason: 'invalid_attachment_size' });
    return null;
  }

  if (hintedContentType !== null && !isSupportedContentType(hintedContentType)) {
    logImageAuditRejection(source, hints, { reason: 'unsupported_attachment_mime' });
    return null;
  }

  let selectedFailure: ImageAuditFailure = {
    reason: 'source_unavailable_or_http_validation_failed',
  };

  for (const candidate of getDownloadCandidates(source)) {
    const downloaded = await downloadImage(candidate);
    if (!downloaded) continue;

    if (hints.size !== undefined && downloaded.buffer.length !== hints.size) {
      selectedFailure = {
        reason: 'attachment_size_mismatch',
        details: { actualSize: downloaded.buffer.length },
      };
      continue;
    }

    if (hintedContentType !== null && downloaded.contentType !== hintedContentType) {
      selectedFailure = {
        reason: 'attachment_mime_mismatch',
        details: { responseContentType: downloaded.contentType },
      };
      continue;
    }

    const auditResult = await prepareDiscordEmojiDataUri(
      downloaded.buffer,
      downloaded.contentType
    );
    if (auditResult.ok) return auditResult.dataUri;

    selectedFailure = auditResult.failure;
  }

  logImageAuditRejection(source, hints, selectedFailure);
  return null;
}
