/**
 * Grão de filme bem leve sobre a Home. É um SVG em linha com `feTurbulence` (o CSP não aceita imagem `data:`), tingido com
 * `--color-text` (então é preto no claro e branco no escuro, sem testar o tema). A camada é maior que a tela e só desliza aos
 * saltos (`.home-grain` em `globals.css`), parada para quem prefere menos movimento. Decoração: não recebe cliques nem é lida.
 *
 *     <Grain />
 */
function Grain() {
  return (
    <svg className="home-grain pointer-events-none absolute -inset-[60px] z-[9] size-[calc(100%+120px)]" aria-hidden="true" focusable="false">
      <filter id="home-grain-filter" x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" result="noise" />
        <feColorMatrix in="noise" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.9 0" result="alpha" />
        <feFlood style={{ floodColor: 'var(--color-text)' }} result="ink" />
        <feComposite in="ink" in2="alpha" operator="in" />
      </filter>
      <rect width="100%" height="100%" filter="url(#home-grain-filter)" />
    </svg>
  );
}

export { Grain };
