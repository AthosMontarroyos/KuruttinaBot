/**
 * Grade do painel de um servidor (decisão de novembro de 2026): o topo (`ServerTopBar`) e a lateral (`page.tsx`) dividem a
 * mesma largura de coluna e as mesmas bordas, então nada fica desalinhado por 5 px.
 *
 *     x = 28          logo, "Servidores", rótulos e ícones da lateral (16 de padding da lateral + 12 do item)
 *     x = coluna      borda da lateral, que continua pelo topo
 *     x = coluna + 48 nome do servidor, título e cartões (o respiro do conteúdo)
 *     x = largura − 48  conta no topo e fim do conteúdo
 *
 * Mudar a largura da coluna ou o respiro aqui muda o topo e a lateral juntos; nunca repita esses valores nos componentes.
 */

/** Largura da coluna da lateral (e da zona esquerda do topo): fixa até 1100px, depois cresce com a tela. */
const serverColumnWidth = 'min-[701px]:w-[264px] min-[1101px]:w-[clamp(264px,18vw,340px)]';

/** Respiro lateral do conteúdo e da zona direita do topo (48px), igual nos dois. */
const serverContentInset = 'min-[701px]:px-12';

/** Altura do topo; a lateral fixa começa logo abaixo. */
const serverHeaderHeight = '72px';

export { serverColumnWidth, serverContentInset, serverHeaderHeight };
