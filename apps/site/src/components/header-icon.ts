/** Botão redondo de ícone do cabeçalho (tema, conta). Cresce com a tela a partir do desktop. */
const headerIconButton =
  'inline-flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-control bg-surface p-0 text-muted hover:border-text min-[701px]:size-10 min-[1101px]:size-[clamp(40px,2.4vw,50px)]';

/** Tamanho do desenho (SVG) dentro de `headerIconButton`; no celular vale o tamanho original do arquivo. */
const headerIconImage = 'min-[701px]:size-[22px] min-[1101px]:size-[clamp(22px,1.4vw,28px)]';

/** Mesmos botões com tamanho único (40px no desktop), para o topo do painel, que não cresce com a tela. */
const headerIconButtonFixed = 'inline-flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-control bg-surface p-0 text-muted hover:border-text min-[701px]:size-10';
const headerIconImageFixed = 'min-[701px]:size-[22px]';

export { headerIconButton, headerIconButtonFixed, headerIconImage, headerIconImageFixed };
