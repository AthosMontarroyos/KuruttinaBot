'use client';

import { useEffect, useRef, type CSSProperties } from 'react';
import { JokerBack, JokerFace } from './JokerCard';
import { cycleMs, deckLayout, pileTransform, planCycle } from './deck-motion';

const cardCount = 9;
const compactCount = 6;

/**
 * Baralho de coringas atrás da personagem: a pilha se embaralha, abre em leque, as cartas voam para pontos sorteados, giram em
 * 3D e se juntam de novo. A coreografia vem de `deck-motion.ts` e é sorteada a cada ciclo (nunca se repete igual); aqui só se
 * anima com a Web Animations API, sem biblioteca. Refaz o plano quando o palco muda de tamanho e pausa com a aba escondida. Quem
 * prefere menos movimento vê só a pilha parada. Brilho, halo e estrelas são CSS (`.joker-*` em `globals.css`). Decoração: fica
 * fora da leitura de tela e não recebe cliques.
 *
 *     <JokerDeck />
 */
function JokerDeck() {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;
    const cards = Array.from(root.querySelectorAll<HTMLElement>('[data-joker]'));
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    let animations: Animation[] = [];
    let run = 0;
    let stopped = false;

    const start = async (): Promise<void> => {
      run += 1;
      const current = run;
      animations.forEach((animation) => animation.cancel());
      while (!stopped && current === run) {
        const { width, height } = root.getBoundingClientRect();
        const layout = deckLayout(width, height);
        const count = layout.compact ? compactCount : cardCount;
        root.style.setProperty('--card-w', `${layout.cardWidth}px`);
        cards.forEach((card, index) => {
          card.style.display = index < count ? '' : 'none';
        });
        if (reduced.matches) {
          cards.slice(0, count).forEach((card, index) => {
            card.style.transform = pileTransform(layout, index);
            card.style.visibility = 'visible';
          });
          return;
        }
        const plan = planCycle(layout, count);
        animations = plan.map((frames, index) =>
          (cards[index] as HTMLElement).animate(
            frames.map((frame) => ({ offset: frame.offset, transform: frame.transform, easing: 'ease-in-out' })),
            { duration: cycleMs, fill: 'forwards' },
          ),
        );
        cards.slice(0, count).forEach((card) => {
          card.style.visibility = 'visible';
        });
        try {
          await Promise.all(animations.map((animation) => animation.finished));
        } catch {
          return; // ciclo cancelado (redimensionou ou saiu da tela): outro `start` assume
        }
      }
    };

    let size = '';
    let timer: number | undefined;
    const observer = new ResizeObserver(() => {
      const box = root.getBoundingClientRect();
      const next = `${Math.round(box.width)}x${Math.round(box.height)}`;
      if (next === size) return;
      const first = size === '';
      size = next;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => void start(), first ? 0 : 250);
    });
    observer.observe(root);
    const onVisibility = (): void => animations.forEach((animation) => (document.hidden ? animation.pause() : animation.play()));
    const onMotion = (): void => {
      cards.forEach((card) => (card.style.transform = ''));
      void start();
    };
    document.addEventListener('visibilitychange', onVisibility);
    reduced.addEventListener('change', onMotion);
    return () => {
      stopped = true;
      window.clearTimeout(timer);
      observer.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      reduced.removeEventListener('change', onMotion);
      animations.forEach((animation) => animation.cancel());
    };
  }, []);

  return (
    <div ref={rootRef} className="pointer-events-none absolute inset-0 z-[1] [perspective:900px]" aria-hidden="true">
      {Array.from({ length: cardCount }, (_, index) => (
        <div
          key={index}
          data-joker=""
          className="absolute top-0 left-0 size-0 [transform-style:preserve-3d]"
          style={{ visibility: 'hidden', '--joker-delay': `-${((index * 0.37) % 3.4).toFixed(2)}s` } as CSSProperties}
        >
          <div className="joker-face"><JokerFace /></div>
          <div className="joker-face [transform:rotateY(180deg)]"><JokerBack /></div>
        </div>
      ))}
    </div>
  );
}

export { JokerDeck };
