/**
 * Geometria dos cordões da Home: uma curva em "V" suave (parábola) coberta por elos pequenos que alternam entre de frente e de
 * lado, como o colar da personagem. Lógica pura, sem DOM: `Necklaces.tsx` só desenha o que sai daqui.
 */

type Link = { x: number; y: number; angle: number; ry: number };
type SwagShape = { x0: number; x1: number; sag: number; top: number; spacing: number; rx: number; ry: number };

const samples = 2000;

/** Elos ao longo da curva, um a cada `spacing` de comprimento; os pares ficam de lado (achatados) e os ímpares de frente. */
function chainLinks({ x0, x1, sag, top, spacing, ry }: SwagShape): Link[] {
  const center = (x0 + x1) / 2;
  const half = (x1 - x0) / 2;
  const point = (x: number): [number, number] => [x, top + sag * (1 - ((x - center) / half) ** 2)];
  const links: Link[] = [];
  let previous = point(x0);
  let walked = 0;
  let next = 0;
  for (let index = 1; index <= samples; index += 1) {
    const current = point(x0 + ((x1 - x0) * index) / samples);
    walked += Math.hypot(current[0] - previous[0], current[1] - previous[1]);
    if (walked >= next) {
      const angle = (Math.atan2(current[1] - previous[1], current[0] - previous[0]) * 180) / Math.PI;
      links.push({ x: current[0], y: current[1], angle, ry: links.length % 2 === 0 ? ry : ry * 0.38 });
      next += spacing;
    }
    previous = current;
  }
  return links;
}

/** Ponto mais baixo da curva, onde a lua pende. */
function swagLow(shape: Pick<SwagShape, 'x0' | 'x1' | 'sag' | 'top'>): { x: number; y: number } {
  return { x: (shape.x0 + shape.x1) / 2, y: shape.top + shape.sag };
}

export { chainLinks, swagLow };
export type { Link, SwagShape };
