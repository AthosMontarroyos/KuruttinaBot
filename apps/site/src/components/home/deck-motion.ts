/**
 * Coreografia do baralho da Home, em lógica pura: onde o baralho fica, para onde cada carta voa e os quadros de cada ciclo.
 * Os pontos de pouso são sorteados a cada ciclo (`random` entra por parâmetro, para o teste fixar o resultado), então a cena
 * nunca se repete igual. `JokerDeck.tsx` só anima o que sai daqui.
 *
 * Ciclo: pilha → embaralha (duas vezes) → leque → voo para um ponto → segundo voo → volta girando → pilha.
 */

type Point = { x: number; y: number };
type DeckLayout = { compact: boolean; anchor: Point; cardWidth: number; fanRadius: number; spots: Point[] };
type Pose = { x: number; y: number; rotate: number; flip: number; scale: number };
type Frame = { offset: number; transform: string };

/** Pontos livres (frações do palco) onde as cartas pousam: nunca sobre o título nem sobre os textos da Home. */
const desktopSpots: Point[] = [
  { x: 0.056, y: 0.133 }, { x: 0.042, y: 0.522 }, { x: 0.924, y: 0.178 }, { x: 0.944, y: 0.333 },
  { x: 0.931, y: 0.522 }, { x: 0.278, y: 0.167 }, { x: 0.361, y: 0.133 }, { x: 0.694, y: 0.156 },
  { x: 0.771, y: 0.167 }, { x: 0.174, y: 0.622 }, { x: 0.083, y: 0.622 },
];
const compactSpots: Point[] = [
  { x: 0.09, y: 0.178 }, { x: 0.91, y: 0.2 }, { x: 0.09, y: 0.355 }, { x: 0.91, y: 0.379 }, { x: 0.09, y: 0.521 }, { x: 0.9, y: 0.545 },
];

/** Posição e tamanho do baralho para um palco de `width` × `height` (a coluna do celular abaixo de 1101px, a composição acima). */
function deckLayout(width: number, height: number): DeckLayout {
  const compact = width < 1101;
  const scale = (spots: Point[]): Point[] => spots.map((spot) => ({ x: spot.x * width, y: spot.y * height }));
  if (compact) {
    const cardWidth = Math.min(56, Math.max(38, width * 0.108));
    return { compact, anchor: { x: width * 0.815, y: height * 0.557 }, cardWidth, fanRadius: cardWidth * 1.5, spots: scale(compactSpots) };
  }
  const cardWidth = Math.min(92, Math.max(66, width * 0.054));
  return { compact, anchor: { x: width * 0.854, y: height * 0.617 }, cardWidth, fanRadius: cardWidth * 1.25, spots: scale(desktopSpots) };
}

/** Duração de cada ciclo e marcos (em % do ciclo) onde a carta muda de pose. */
const cycleMs = 26000;
const marks = { hold: 0.1, split1: 0.14, merge1: 0.17, split2: 0.2, merge2: 0.23, fan: 0.3, fanEnd: 0.36, flyA: 0.46, flyB: 0.58, gather: 0.7, settle: 0.78 };

function transformOf(anchor: Point, pose: Pose): string {
  return `translate(${(anchor.x + pose.x).toFixed(1)}px, ${(anchor.y + pose.y).toFixed(1)}px) rotateZ(${pose.rotate.toFixed(1)}deg) rotateY(${pose.flip}deg) scale(${pose.scale})`;
}

/** Pose de repouso do baralho (a carta `index` de `count`), usada também quando o usuário prefere menos movimento. */
function pilePose(index: number, random: () => number): Pose {
  return { x: -0.6 * index, y: -0.9 * index, rotate: 6 + (random() - 0.5) * 3, flip: 180, scale: 1 };
}

function pileTransform(layout: DeckLayout, index: number): string {
  return transformOf(layout.anchor, { x: -0.6 * index, y: -0.9 * index, rotate: 6, flip: 180, scale: 1 });
}

/** Quadros de uma carta num ciclo. Os pontos de pouso vêm de `pickSpot` (sorteio sem repetir até esgotar a lista). */
function planCard(layout: DeckLayout, index: number, count: number, spotA: Point, spotB: Point, random: () => number): Frame[] {
  const { anchor, cardWidth, fanRadius } = layout;
  const jitter = (range: number): number => (random() - 0.5) * 2 * range;
  const pile = pilePose(index, random);
  const side = index % 2 === 0 ? -1 : 1;
  const split: Pose = { ...pile, x: pile.x + side * cardWidth * 0.34, y: pile.y - 4, rotate: pile.rotate + side * 7 };
  const half: Pose = { ...pile, x: pile.x + side * cardWidth * 0.18, y: pile.y - 2, rotate: pile.rotate + side * 3.5 };
  const angle = ((-28 + (100 * index) / Math.max(1, count - 1)) * Math.PI) / 180;
  const fan: Pose = { x: fanRadius * Math.sin(angle), y: -fanRadius * Math.cos(angle) + fanRadius * 0.15, rotate: (angle * 180) / Math.PI, flip: 0, scale: 1 };
  const pick = <T,>(items: T[]): T => items[Math.floor(random() * items.length)] as T;
  const fly = (spot: Point, flips: number[], scale: number): Pose => ({ x: spot.x - anchor.x, y: spot.y - anchor.y, rotate: Math.round(jitter(40)), flip: pick(flips), scale });
  const gather: Pose = { x: pile.x + jitter(30), y: pile.y - 20 - random() * 40, rotate: pile.rotate + Math.round(jitter(90)), flip: pick([540, 720]), scale: 1.1 };
  const steps: Array<[number, Pose]> = [
    [0, pile], [marks.hold + jitter(0.01), pile],
    [marks.split1 + jitter(0.008), split], [marks.merge1 + jitter(0.005), pile], [marks.split2 + jitter(0.005), half], [marks.merge2 + jitter(0.004), pile],
    [marks.fan + jitter(0.01), fan], [marks.fanEnd + jitter(0.01), fan],
    [marks.flyA + jitter(0.02), fly(spotA, [360, 540, 720], 1.15)], [marks.flyB + jitter(0.02), fly(spotB, [-180, -360, 0], 1.05)],
    [marks.gather + jitter(0.015), gather], [marks.settle + jitter(0.008), pile], [1, pile],
  ];
  steps.sort((a, b) => a[0] - b[0]);
  return steps.map(([offset, pose], position) => ({ offset: position === 0 ? 0 : position === steps.length - 1 ? 1 : offset, transform: transformOf(anchor, pose) }));
}

/** Todos os quadros de um ciclo novo: cada carta ganha dois pontos de pouso distintos, sorteados sem repetir enquanto houver. */
function planCycle(layout: DeckLayout, count: number, random: () => number = Math.random): Frame[][] {
  let pool = [...layout.spots];
  const take = (): Point => {
    if (pool.length === 0) pool = [...layout.spots];
    const [spot] = pool.splice(Math.floor(random() * pool.length), 1);
    return spot as Point;
  };
  return Array.from({ length: count }, (_, index) => planCard(layout, index, count, take(), take(), random));
}

export { cycleMs, deckLayout, desktopSpots, compactSpots, pileTransform, planCycle };
export type { DeckLayout, Frame, Point };
