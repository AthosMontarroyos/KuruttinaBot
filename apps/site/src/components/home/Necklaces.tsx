import { chainLinks, swagLow, type SwagShape } from './necklace';

type SwagProps = { shape: SwagShape; width: number; opacity: number; moon?: number; duration: number };

/** Um cordão: elos desenhados ao longo da curva e, no ponto mais baixo, a argola e a lua crescente. */
function Swag({ shape, width, opacity, moon, duration }: SwagProps) {
  const links = chainLinks(shape);
  const low = swagLow(shape);
  return (
    <g className="necklace-sway" style={{ transformOrigin: `${low.x}px ${shape.top}px`, animationDuration: `${duration}s` }}>
      <g fill="none" stroke="currentColor" strokeWidth={width} opacity={opacity}>
        {links.map((link, index) => (
          <ellipse key={index} cx={link.x.toFixed(1)} cy={link.y.toFixed(1)} rx={shape.rx} ry={link.ry.toFixed(2)} transform={`rotate(${link.angle.toFixed(1)} ${link.x.toFixed(1)} ${link.y.toFixed(1)})`} />
        ))}
        {moon ? <ellipse cx={low.x} cy={low.y + 3 * moon} rx={3.2 * moon} ry={4.6 * moon} /> : null}
      </g>
      {moon ? (
        <g transform={`translate(${low.x} ${low.y + 21 * moon}) scale(${moon}) rotate(-18)`}>
          <path fill="currentColor" d="M0,-13 A13,13 0 1 0 12.2,4.6 A10,10 0 1 1 0,-13 Z" />
        </g>
      ) : null}
    </g>
  );
}

const wide: SwagShape = { x0: -10, x1: 330, sag: 180, top: -8, spacing: 6.6, rx: 4.4, ry: 2.7 };
const wideInner: SwagShape = { x0: -10, x1: 330, sag: 110, top: -8, spacing: 5.6, rx: 3.8, ry: 2.3 };
const compact: SwagShape = { x0: -30, x1: 92, sag: 72, top: -8, spacing: 5.2, rx: 3.6, ry: 2.2 };

/**
 * Cordões de colar pendurados nos cantos de cima da Home, com a lua da personagem. No desktop são dois fios por canto; abaixo de
 * 1101px, um fio curto, para não encostar no título. Desenho estático em SVG (`currentColor`, então segue o tema) que só balança
 * de leve, parado para quem prefere menos movimento (`.necklace-sway` em `globals.css`). Decoração: fica fora da leitura de tela.
 *
 *     <Necklaces />
 */
function Necklaces() {
  const box = 'pointer-events-none absolute top-0 z-[1] text-text';
  return (
    <>
      <svg className={`${box} left-0 hidden h-[226px] w-[340px] min-[1101px]:block`} viewBox="-10 -12 340 226" aria-hidden="true">
        <Swag shape={wide} width={1.6} opacity={0.85} moon={1} duration={9} />
        <Swag shape={wideInner} width={1.3} opacity={0.6} duration={7.8} />
      </svg>
      <svg className={`${box} right-0 hidden h-[226px] w-[340px] -scale-x-100 min-[1101px]:block`} viewBox="-10 -12 340 226" aria-hidden="true">
        <Swag shape={wide} width={1.6} opacity={0.85} moon={1} duration={10} />
        <Swag shape={wideInner} width={1.3} opacity={0.6} duration={8.4} />
      </svg>
      <svg className={`${box} left-0 h-[100px] w-[122px] min-[1101px]:hidden`} viewBox="-30 -12 122 100" aria-hidden="true">
        <Swag shape={compact} width={1.2} opacity={0.85} moon={0.65} duration={9} />
      </svg>
      <svg className={`${box} right-0 h-[100px] w-[122px] -scale-x-100 min-[1101px]:hidden`} viewBox="-30 -12 122 100" aria-hidden="true">
        <Swag shape={compact} width={1.2} opacity={0.85} moon={0.65} duration={10} />
      </svg>
    </>
  );
}

export { Necklaces };
