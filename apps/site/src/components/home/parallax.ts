/**
 * Parallax do mouse na Home, em lógica pura: a posição do ponteiro vira dois números de -1 a 1 (`--px` e `--py` no palco) e
 * cada camada se desloca uma fração diferente deles. O valor persegue o alvo aos poucos, sem salto, e as camadas de trás
 * andam menos que as da frente.
 */

type Offset = { x: number; y: number };

/** Posição do ponteiro dentro do palco, de -1 (borda esquerda ou topo) a 1 (borda direita ou fundo). */
function pointerToUnit(client: Offset, box: { left: number; top: number; width: number; height: number }): Offset {
  const clamp = (value: number): number => Math.max(-1, Math.min(1, value));
  return {
    x: box.width > 0 ? clamp(((client.x - box.left) / box.width) * 2 - 1) : 0,
    y: box.height > 0 ? clamp(((client.y - box.top) / box.height) * 2 - 1) : 0,
  };
}

/** Um passo em direção ao alvo; abaixo de `epsilon` de distância assenta no alvo, para o laço parar. */
function stepParallax(current: Offset, target: Offset, easing = 0.08, epsilon = 0.001): { value: Offset; settled: boolean } {
  const move = (from: number, to: number): number => (Math.abs(to - from) < epsilon ? to : from + (to - from) * easing);
  const value = { x: move(current.x, target.x), y: move(current.y, target.y) };
  return { value, settled: value.x === target.x && value.y === target.y };
}

export { pointerToUnit, stepParallax };
export type { Offset };
