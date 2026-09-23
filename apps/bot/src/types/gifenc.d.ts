/**
 * Tipagem mínima para `gifenc` (biblioteca CommonJS sem tipos próprios).
 * Usada apenas no caminho de última instância: redução de quadros de GIF.
 */
declare module 'gifenc' {
  export type GifPalette = number[][];

  export interface GifWriteFrameOptions {
    readonly palette?: GifPalette | undefined;
    readonly first?: boolean | undefined;
    readonly transparent?: boolean | undefined;
    readonly transparentIndex?: number | undefined;
    readonly delay?: number | undefined;
    readonly repeat?: number | undefined;
    readonly dispose?: number | undefined;
  }

  export interface GifEncoderInstance {
    writeFrame(index: Uint8Array, width: number, height: number, options?: GifWriteFrameOptions): void;
    finish(): void;
    bytes(): Uint8Array;
    bytesView(): Uint8Array;
  }

  export interface GifQuantizeOptions {
    readonly format?: 'rgb565' | 'rgb444' | 'rgba4444';
    readonly oneBitAlpha?: boolean | number;
    readonly clearAlpha?: boolean;
    readonly clearAlphaThreshold?: number;
    readonly clearAlphaColor?: number;
  }

  export interface GifencModule {
    GIFEncoder(options?: { readonly initialCapacity?: number; readonly auto?: boolean }): GifEncoderInstance;
    quantize(rgba: Uint8Array | Uint8ClampedArray, maxColors: number, options?: GifQuantizeOptions): GifPalette;
    applyPalette(rgba: Uint8Array | Uint8ClampedArray, palette: GifPalette, format?: 'rgb565' | 'rgb444' | 'rgba4444'): Uint8Array;
  }

  const gifenc: GifencModule;
  export default gifenc;
}
