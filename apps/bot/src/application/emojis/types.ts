/**
 * Contratos, limites e erros do fluxo de importação de imagens para emojis.
 *
 * Este módulo não conhece Discord, sharp nem rede: apenas define as fronteiras
 * entre a orquestração (application) e os adapters (infrastructure).
 */

/** Limite oficial do Discord para Application/Guild Emojis, em bytes. */
export const DISCORD_EMOJI_MAX_BYTES = 256 * 1024;

/** Capacidade documentada de Application Emojis (2000 por aplicação). */
export const DISCORD_APPLICATION_EMOJI_LIMIT = 2000;

/** Formatos aceitos pelo Discord como upload de emoji. */
export const SUPPORTED_EMOJI_IMAGE_FORMATS = ['png', 'jpeg', 'gif', 'webp', 'avif'] as const;
export type SupportedEmojiImageFormat = (typeof SUPPORTED_EMOJI_IMAGE_FORMATS)[number];

/** Nome de emoji pessoalizado: 2–32 caracteres de A–Z, a–z, 0–9 e _. */
export const EMOJI_NAME_PATTERN = /^[A-Za-z0-9_]{2,32}$/u;

export type EmojiImportErrorCode =
  | 'empty_input'
  | 'input_too_large'
  | 'unsupported_format'
  | 'corrupt_image'
  | 'too_many_pixels'
  | 'too_many_frames'
  | 'duration_exceeded'
  | 'processing_timeout'
  | 'size_unreachable'
  | 'animation_lost'
  | 'queue_full'
  | 'invalid_source'
  | 'invalid_name'
  | 'missing_source'
  | 'invalid_input'
  | 'download_blocked'
  | 'download_failed'
  | 'source_missing'
  | 'destination_unavailable'
  | 'capacity_reached'
  | 'create_failed';

/**
 * Erro de domínio do fluxo de importação. `code` é seguro para mapear em
 * mensagens públicas; a mensagem pode ser exibida sem sanitização adicional
 * (nenhum secret ou caminho interno é interpolado aqui).
 */
export class EmojiImportError extends Error {
  readonly code: EmojiImportErrorCode;

  constructor(code: EmojiImportErrorCode, message: string) {
    super(message);
    this.name = 'EmojiImportError';
    this.code = code;
  }
}

export function emojiError(code: EmojiImportErrorCode, message: string): EmojiImportError {
  return new EmojiImportError(code, message);
}

/** Origem com falha barata: recusa antes do download quando o tamanho já declarado estoura. */
export function inputTooLargeError(maxInputBytes: number): EmojiImportError {
  return emojiError('input_too_large', `A imagem excede o limite de ${maxInputBytes} bytes.`);
}

/** Limites técnicos internos; não confundir com os limites do Discord. */
export interface EmojiImageLimits {
  /** Tamanho máximo do arquivo de origem (anexo ou CDN). */
  readonly maxInputBytes: number;
  /** Deve ser ≤ DISCORD_EMOJI_MAX_BYTES; validação final obrigatória. */
  readonly maxOutputBytes: number;
  /** Soma de pixels decodificáveis (largura × altura × quadros). */
  readonly maxDecodedPixels: number;
  readonly maxFrames: number;
  readonly maxDurationMs: number;
  readonly downloadTimeoutMs: number;
  readonly processingTimeoutMs: number;
  readonly maxEncodeAttempts: number;
}

export const DEFAULT_EMOJI_IMAGE_LIMITS: EmojiImageLimits = Object.freeze({
  maxInputBytes: 8 * 1024 * 1024,
  maxOutputBytes: DISCORD_EMOJI_MAX_BYTES,
  maxDecodedPixels: 16_000_000,
  maxFrames: 300,
  maxDurationMs: 15_000,
  downloadTimeoutMs: 15_000,
  processingTimeoutMs: 20_000,
  maxEncodeAttempts: 8,
});

/** Controle de concorrência do pipeline de compressão. */
export interface EmojiQueueLimits {
  /** Processamentos simultâneos. */
  readonly concurrency: number;
  /** Solicitações aguardando lugar na fila. */
  readonly maxQueued: number;
}

export const DEFAULT_EMOJI_QUEUE_LIMITS: EmojiQueueLimits = Object.freeze({
  concurrency: 1,
  maxQueued: 5,
});

export type EmojiTransformation =
  | 'normalized_128'
  | 'palette_reduced'
  | 'dithering_reduced'
  | 'frames_reduced';

export interface ImageInspection {
  readonly format: SupportedEmojiImageFormat;
  readonly width: number;
  readonly height: number;
  readonly frames: number;
  readonly totalDurationMs: number;
}

export interface EmojiCompressionOptions {
  readonly maxOutputBytes: number;
  readonly maxEncodeAttempts: number;
  readonly timeoutMs: number;
  readonly maxDecodedPixels: number;
}

export interface CompressedImage {
  readonly bytes: Uint8Array;
  readonly contentType: 'image/png' | 'image/gif';
  readonly animated: boolean;
  readonly width: number;
  readonly height: number;
  readonly transformations: readonly EmojiTransformation[];
}

/** Porte de decodificação/compressão de imagem (implementado com sharp). */
export interface EmojiImageProcessor {
  inspect(bytes: Uint8Array): Promise<ImageInspection>;
  compress(bytes: Uint8Array, options: EmojiCompressionOptions): Promise<CompressedImage>;
}

export interface RawEmojiImage {
  readonly bytes: Uint8Array;
}

export interface PreparedEmojiImage {
  readonly bytes: Uint8Array;
  readonly contentType: 'image/png' | 'image/gif';
  readonly animated: boolean;
  readonly width: number;
  readonly height: number;
  readonly sourceBytes: number;
  readonly transformations: readonly EmojiTransformation[];
}

export interface EmojiDownloadOptions {
  readonly maxBytes: number;
  readonly timeoutMs: number;
}

/** Porte de download restrito ao CDN do Discord (implementado com fetch). */
export type EmojiDownloadPort = (url: string, options: EmojiDownloadOptions) => Promise<Uint8Array>;

/** Imagem anexada a uma mensagem ou fornecida como opção de anexo em slash. */
export interface EmojiAttachment {
  readonly url: string;
  /** Nome original do arquivo; origem preferencial para derivar o nome do emoji. */
  readonly name?: string | undefined;
  /** Tamanho declarado pelo Discord; permite recusar antes de baixar. */
  readonly size?: number | undefined;
  /**
   * MIME declarado pelo Discord. `null` e ausência não autorizam o formato;
   * só um valor fora de `image/` recusa antes do download.
   */
  readonly contentType?: string | null | undefined;
}

export type EmojiSource =
  | { readonly kind: 'guild-emoji'; readonly ref: string }
  | {
      readonly kind: 'attachment';
      readonly url: string;
      readonly filename?: string | undefined;
      readonly size?: number | undefined;
      /** MIME declarado. Só recusa cedo; a assinatura dos bytes é quem autoriza. */
      readonly contentType?: string | null | undefined;
    };

export type EmojiDestination =
  | {
      readonly kind: 'application';
      /** Autor da operação, só para auditoria. Não escolhe a aplicação de destino. */
      readonly actorUserId?: string | undefined;
      /** Guilda em que o comando foi executado, só para auditoria. */
      readonly guildId?: string | undefined;
    }
  | { readonly kind: 'guild'; readonly guildId: string };

export interface CreatedEmoji {
  readonly id: string;
  readonly name: string;
}

/** Porte de criação/consulta de emojis no destino (implementado com discord.js). */
export interface EmojiCreationPort {
  countApplicationEmojis(): Promise<number>;
  create(destination: EmojiDestination, name: string, image: PreparedEmojiImage): Promise<CreatedEmoji>;
}
