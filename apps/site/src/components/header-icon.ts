/** Botão redondo de ícone do cabeçalho (tema, conta). Cresce com a tela a partir do desktop. */
const headerIconButton =
  'inline-flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-control bg-surface p-0 text-muted hover:border-text min-[701px]:size-10 min-[1101px]:size-[clamp(40px,2.4vw,50px)]';

/** Tamanho do desenho (SVG) dentro de `headerIconButton`; no celular vale o tamanho original do arquivo. */
const headerIconImage = 'min-[701px]:size-[22px] min-[1101px]:size-[clamp(22px,1.4vw,28px)]';

export { headerIconButton, headerIconImage };
