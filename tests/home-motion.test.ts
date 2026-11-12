import { describe, expect, it } from 'vitest';
import { chainLinks, swagLow } from '../apps/site/src/components/home/necklace.js';
import { compactSpots, cycleMs, deckLayout, desktopSpots, pileTransform, planCycle } from '../apps/site/src/components/home/deck-motion.js';

/** Gerador determinístico, para o plano do ciclo ser reproduzível no teste. */
function seeded(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

describe('necklace geometry', () => {
  const shape = { x0: -10, x1: 330, sag: 180, top: -8, spacing: 6.6, rx: 4.4, ry: 2.7 };

  it('spaces the links along the curve and alternates face-on and edge-on', () => {
    const links = chainLinks(shape);
    expect(links.length).toBeGreaterThan(60);
    expect(links[0]?.ry).toBe(2.7);
    expect(links[1]?.ry).toBeCloseTo(2.7 * 0.38, 5);
    for (const link of links) expect(link.x).toBeGreaterThanOrEqual(-10);
  });

  it('hangs the moon from the lowest point of the curve', () => {
    expect(swagLow(shape)).toEqual({ x: 160, y: 172 });
    const lowestLink = Math.max(...chainLinks(shape).map((link) => link.y));
    expect(lowestLink).toBeLessThanOrEqual(172.5);
  });
});

describe('joker deck layout', () => {
  it('uses the stacked column below 1101px and the composition from 1101px', () => {
    expect(deckLayout(390, 844).compact).toBe(true);
    expect(deckLayout(1100, 800).compact).toBe(true);
    expect(deckLayout(1101, 800).compact).toBe(false);
  });

  it('keeps every landing spot inside the stage', () => {
    for (const [width, height] of [[1440, 900], [1920, 1080], [390, 844], [820, 1000]] as const) {
      const layout = deckLayout(width, height);
      expect(layout.spots.length).toBeGreaterThanOrEqual(6);
      for (const spot of layout.spots) {
        expect(spot.x).toBeGreaterThan(0);
        expect(spot.x).toBeLessThan(width);
        expect(spot.y).toBeGreaterThan(0);
        expect(spot.y).toBeLessThan(height);
      }
    }
  });

  it('never lands a card on the title band or the text blocks of the desktop composition', () => {
    for (const spot of desktopSpots) {
      const insideTitle = spot.y > 0.3 && spot.y < 0.48 && spot.x > 0.09 && spot.x < 0.89;
      const overText = spot.y > 0.7;
      expect(insideTitle || overText, JSON.stringify(spot)).toBe(false);
    }
    for (const spot of compactSpots) expect(spot.x < 0.15 || spot.x > 0.85, JSON.stringify(spot)).toBe(true);
  });
});

describe('joker deck cycle plan', () => {
  const layout = deckLayout(1440, 900);

  it('gives every card ordered frames that start and end on its pile pose', () => {
    const plan = planCycle(layout, 9, seeded(1));
    expect(plan).toHaveLength(9);
    plan.forEach((frames, index) => {
      expect(frames[0]?.offset).toBe(0);
      expect(frames.at(-1)?.offset).toBe(1);
      for (let position = 1; position < frames.length; position += 1) expect(frames[position]!.offset).toBeGreaterThanOrEqual(frames[position - 1]!.offset);
      // Termina de verso para cima (rotateY 180), pronta para o próximo ciclo, e a pilha é a mesma de `pileTransform` salvo o giro.
      expect(frames.at(-1)?.transform).toContain('rotateY(180deg)');
      expect(pileTransform(layout, index)).toContain(`translate(${(layout.anchor.x - 0.6 * index).toFixed(1)}px`);
    });
  });

  it('draws different landing spots on every cycle instead of repeating', () => {
    const first = JSON.stringify(planCycle(layout, 9, seeded(1)));
    const second = JSON.stringify(planCycle(layout, 9, seeded(2)));
    expect(first).not.toBe(second);
  });

  it('keeps the cycle long enough to feel unhurried', () => {
    expect(cycleMs).toBeGreaterThanOrEqual(20000);
  });
});

describe('home parallax', () => {
  const box = { left: 100, top: 50, width: 1000, height: 600 };

  it('maps the pointer inside the stage to -1..1 and clamps outside it', async () => {
    const { pointerToUnit } = await import('../apps/site/src/components/home/parallax.js');
    expect(pointerToUnit({ x: 600, y: 350 }, box)).toEqual({ x: 0, y: 0 });
    expect(pointerToUnit({ x: 100, y: 50 }, box)).toEqual({ x: -1, y: -1 });
    expect(pointerToUnit({ x: 5000, y: -900 }, box)).toEqual({ x: 1, y: -1 });
    expect(pointerToUnit({ x: 10, y: 10 }, { left: 0, top: 0, width: 0, height: 0 })).toEqual({ x: 0, y: 0 });
  });

  it('eases toward the target without overshooting and settles exactly on it', async () => {
    const { stepParallax } = await import('../apps/site/src/components/home/parallax.js');
    let value = { x: 0, y: 0 };
    let settled = false;
    for (let step = 0; step < 400 && !settled; step += 1) {
      const next = stepParallax(value, { x: 1, y: -0.5 });
      expect(next.value.x).toBeGreaterThanOrEqual(value.x);
      expect(next.value.x).toBeLessThanOrEqual(1);
      value = next.value;
      settled = next.settled;
    }
    expect(settled).toBe(true);
    expect(value).toEqual({ x: 1, y: -0.5 });
  });
});
