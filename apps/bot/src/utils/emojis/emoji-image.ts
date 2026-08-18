import sharp from 'sharp';

export const DISCORD_EMOJI_MAX_BYTES = 256 * 1024;

// Leave a small margin so the API never receives a borderline 256 KiB payload.
const EMOJI_TARGET_BYTES = 255 * 1024;
const EMOJI_DIMENSION = 128;
const DISCORD_EMOJI_MIME_TYPES = new Set([
  'image/gif',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
]);

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

async function downloadImage(url: string): Promise<{ buffer: Buffer; contentType: string } | null> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!response.ok) return null;

    const contentType = (response.headers.get('content-type') || '').split(';')[0].trim();
    if (!contentType.startsWith('image/')) return null;

    return {
      buffer: Buffer.from(await response.arrayBuffer()),
      contentType,
    };
  } catch {
    return null;
  }
}

async function downloadEmojiSource(
  source: string
): Promise<{ buffer: Buffer; contentType: string } | null> {
  const customEmojiMatch = source.match(/<a?:[A-Za-z0-9_]+:(\d+)>/);
  if (!customEmojiMatch) return downloadImage(source);

  const animated = source.startsWith('<a:');
  const emojiId = customEmojiMatch[1];
  const extensions = animated ? ['gif', 'webp', 'png'] : ['webp', 'png', 'gif'];

  for (const extension of extensions) {
    const animatedQuery = extension === 'webp' && animated ? '&animated=true' : '';
    const downloaded = await downloadImage(
      `https://cdn.discordapp.com/emojis/${emojiId}.${extension}?size=128&quality=lossless${animatedQuery}`
    );
    if (downloaded) return downloaded;
  }

  return null;
}

async function compressAnimatedImage(input: Buffer): Promise<Buffer | null> {
  for (const preset of ANIMATED_PRESETS) {
    const output = await sharp(input, { animated: true })
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
    const output = await sharp(input)
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

/**
 * Downloads an emoji/image and guarantees a Discord-compatible data URI:
 * at most 128x128 and safely below the 256 KiB API limit.
 */
export async function fetchDiscordEmojiDataUri(source: string): Promise<string | null> {
  const downloaded = await downloadEmojiSource(source);
  if (!downloaded) return null;

  const metadata = await sharp(downloaded.buffer, { animated: true }).metadata();
  const frameHeight = metadata.pageHeight || metadata.height || 0;
  const isAnimated = (metadata.pages || 1) > 1;
  const alreadyCompatible =
    DISCORD_EMOJI_MIME_TYPES.has(downloaded.contentType) &&
    downloaded.buffer.length <= EMOJI_TARGET_BYTES &&
    (metadata.width || 0) <= EMOJI_DIMENSION &&
    frameHeight <= EMOJI_DIMENSION;

  if (alreadyCompatible) {
    return toDataUri(downloaded.buffer, downloaded.contentType);
  }

  const compressed = isAnimated
    ? await compressAnimatedImage(downloaded.buffer)
    : await compressStaticImage(downloaded.buffer);

  if (!compressed) {
    throw new Error(
      `Não foi possível comprimir a imagem abaixo do limite de ${DISCORD_EMOJI_MAX_BYTES} bytes sem torná-la inválida.`
    );
  }

  return toDataUri(compressed, isAnimated ? 'image/gif' : 'image/webp');
}
