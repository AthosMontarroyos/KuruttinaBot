import { useEffect, type RefObject } from 'react';
import { pointerToUnit, stepParallax, type Offset } from './parallax.js';

/**
 * Liga o parallax do mouse ao palco: grava `--px` e `--py` (-1 a 1) nele, e as camadas da Home leem esses valores no CSS. Só
 * com mouse (`pointer: fine`) e sem pedido de menos movimento; no toque e no teclado nada muda. O quadro só roda enquanto o
 * valor ainda está andando para o alvo.
 */
function useParallax(stage: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const element = stage.current;
    if (!element) return undefined;
    const allowed = window.matchMedia('(pointer: fine) and (prefers-reduced-motion: no-preference)');
    if (!allowed.matches) return undefined;
    let current: Offset = { x: 0, y: 0 };
    let target: Offset = { x: 0, y: 0 };
    let frame = 0;
    const tick = (): void => {
      const next = stepParallax(current, target);
      current = next.value;
      element.style.setProperty('--px', current.x.toFixed(4));
      element.style.setProperty('--py', current.y.toFixed(4));
      frame = next.settled ? 0 : window.requestAnimationFrame(tick);
    };
    const aim = (to: Offset): void => {
      target = to;
      if (frame === 0) frame = window.requestAnimationFrame(tick);
    };
    const onMove = (event: PointerEvent): void => aim(pointerToUnit({ x: event.clientX, y: event.clientY }, element.getBoundingClientRect()));
    const onLeave = (): void => aim({ x: 0, y: 0 });
    window.addEventListener('pointermove', onMove, { passive: true });
    document.documentElement.addEventListener('pointerleave', onLeave);
    return () => {
      window.removeEventListener('pointermove', onMove);
      document.documentElement.removeEventListener('pointerleave', onLeave);
      window.cancelAnimationFrame(frame);
      element.style.removeProperty('--px');
      element.style.removeProperty('--py');
    };
  }, [stage]);
}

export { useParallax };
