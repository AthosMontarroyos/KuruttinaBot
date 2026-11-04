/** Distância do centro do disco ao centro de cada item, em % do lado do disco. */
const wheelRadius = 31.4;

/**
 * Posição do item `index` entre `count`, em % do disco: o primeiro fica no topo e os demais seguem no sentido horário,
 * com o mesmo ângulo entre si.
 */
function wheelPosition(index: number, count: number): { left: string; top: string } {
  const angle = (index / count) * 2 * Math.PI;
  const round = (value: number): string => `${(Math.round(value * 100) / 100).toString()}%`;
  return { left: round(50 + wheelRadius * Math.sin(angle)), top: round(50 - wheelRadius * Math.cos(angle)) };
}

export { wheelPosition, wheelRadius };
