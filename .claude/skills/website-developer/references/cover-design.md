# Capa da Home — linguagem visual para as outras áreas

Direção aprovada pelo responsável em 02/11/2026 para a primeira dobra da Home. Serve de base quando o redesenho chegar às demais páginas. O mockup (desktop 1440×900 e celular 390×844) está no Artifact de design [Kuruttina — Redesign da Home](https://claude.ai/artifact/EQTpe4ukbPY5KhjtX8ZkmP); novas áreas entram como artboards no mesmo canvas, para a comparação ficar num lugar só. Implementação em `apps/site/src/app/page.tsx` e `globals.css` (bloco `.home-cover`).

Leia só ao desenhar ou rever uma página pública do site. Detalhes de layout e assets da Home continuam em [home.md](home.md).

## Objetivo

A primeira impressão é a Kuruttina como personagem: bonita, acolhedora e apresentável, nunca tecnológica. A imagem vem antes da informação; texto e botões ficam em segundo plano. O bot é de interação com a comunidade, mas ainda não tem todas as funções: o texto fala de quem ela é, não lista funções que não existem.

## Princípios

- **A ilustração é a capa.** Ocupa a altura inteira de um lado (desktop) ou o topo (celular), sem moldura de painel, cartão ou grade. Nada de aparência de aplicativo, painel ou código.
- **Palco claro.** Fundo blush liso e um disco rosa suave (`bg-accent-soft`) atrás da personagem. Sem degradê visível como elemento de design.
- **Título como pôster.** "Kuruttina" em Fraunces suave (`font-display`, 500, `SOFT` 100, `opsz` 144), grande (até 240px), com o ponto final em rosa, cruzando por cima da arte. O resto do site continua em Outfit.
- **Uma ação principal.** Uma pílula rosa cheia ("Adicionar ao Discord"); a secundária é só contorno; apoio e redes são botões redondos discretos.
- **Primeiro a imagem, depois o texto.** Parágrafo curto, no máximo duas frases, na voz dela.

## Voz do texto

Primeira pessoa no feminino, calma e simpática, conforme [personalidade](../../../../docs/project/bot-personality.md). Texto aprovado: "Oi, eu sou a Kuruttina. Vim para deixar a sua comunidade mais viva, e ficar por perto." Foram descartados: tom de moderação ("cuido da ordem do servidor") e descrição genérica de bot ("entra no seu servidor pelo Discord"). Não cite função específica enquanto ela não existir. "A Kuruttina" é feminino: nunca "O Kuruttina".

## Tratamento da imagem

- Arte do R2: `dashboard/LaddingPage/CardRetrato.jpg` (736×1308, retrato com fundo branco). Entra pela meta `kuruttina-home-cover`, como as outras imagens remotas.
- `mix-blend-mode: multiply` faz o branco da arte virar a cor da página; uma máscara linear só suaviza a borda cortada (esquerda no desktop, embaixo no celular).
- Amplia no desktop e pode ficar macia em tela de alta densidade: uma versão maior da arte melhora o resultado.
- Outras páginas devem usar arte do mesmo conjunto, com fundo branco ou transparente, para o mesmo tratamento servir.

## Fidelidade ao mockup

O mockup é uma composição fixa de 1440×900 (Main.dc.html no Artifact). Porcentagens e alturas que variam com a tela esticavam a composição: arte, disco e título perdiam a proporção do design em 1920px (disco na ponta do pescoço, personagem grande demais). A partir de 1100px a Home é, então, a composição do mockup com `zoom` por igual (`useStageScale` em `page.tsx`: escala = min(largura/1440, altura/720)). A largura do palco é sempre 1440 e só a altura varia (720 até o teto de 900 da arte): travar a escala em altura/900, como antes, deixava o palco mais largo que o design em qualquer tela mais larga que 16:10 (1920×1080 com barras do navegador, 1440×780...), abria um vão entre texto e arte e o título deixava de cruzá-la. A arte precisa continuar encostada na borda direita (a personagem sai da imagem), por isso não se centra um palco de 1440 com margens. Só janelas mais largas que 2:1 (ultrawide) ainda alargam o palco. Dentro dele valem as medidas do mockup em px: caixa da arte 662px de largura e a altura do palco (máx. 900) ancorada embaixo à direita; em palco mais baixo que 900 a base da arte (livro) é cortada, disco 760px em `top -140` e `right -90` da caixa, título 216px, parágrafo 24px, botões 56px; a coluna de texto tem `max-w-[480px]`, então o botão redondo de suporte desce para a linha de baixo, como no mockup. Abaixo de 1100px o layout é fluido (tablet e celular). Não use `vw`, `vh` nem `%` de altura nas medidas da capa em ≥1100px: com `zoom` elas escalam duas vezes. Sem scroll: a capa preenche a tela (barra transparente por cima, sem rodapé).

## Tema escuro (removido, decidir depois)

O tema escuro foi removido do site em 02/11/2026; hoje só existe o claro. O texto abaixo guarda o que foi aprovado para quando ele voltar. A página segue o tema; a arte tem fundo branco e só funciona sobre superfície clara. Abaixo de 1100px a caixa da arte tem proporção 3:4, 88% da altura e teto de 860px, ancorada embaixo, e o disco mede 105% da altura dela. A máscara some a borda esquerda e a de cima. No claro a ilustração cobre a página (multiply e máscara na borda). No escuro (proposta A do mockup, aprovada em 02/11/2026) ela fica num arco (`.home-cover-card`): fundo `--color-stage-disc` (rosa-claro, para o multiply manter pele e cabelo; um rosa forte achatava tudo), anel rosa de 8px, anel fino de afastamento e brilho suave, mais um disco ameixa (`--color-surface`) atrás. O título encolhe no escuro (`clamp(96px, 12.5vw, 200px)`) para não cruzar o arco. No celular o arco fica centrado no topo. Descartadas: cartão creme retangular (parecia um bloco claro solto), fundo rosa saturado e brilhos decorativos de quatro pontas ("cara de vibe coding"). Em outra página com arte clara, repita o arco no escuro. Uma arte com fundo transparente ou escuro dispensaria o arco.

## Barras superiores

Duas barras, aprovadas em 02/11/2026: `TopBar` (site público e lista de servidores) e `ServerTopBar` (painel `/dashboard/:serverId`: marca, voltar para Servidores, ícone e nome do servidor, conta). Na Home a `TopBar` é transparente sobre a capa, para a arte ocupar a altura toda e o enquadramento bater com o mockup; no escuro (quando voltar) ela volta ao fluxo normal porque o arco começa abaixo dela. O mockup do painel está no mesmo Artifact ("TopBar 2").

## Para estender às outras áreas

- Comandos, Módulos e Termos: título da página em `font-display`, fundo blush e ilustração de apoio na borda; conteúdo funcional continua em Outfit e nos tokens.
- Painel: segue a base funcional atual; só o cabeçalho pode adotar a serifa. Não aplicar a ilustração em telas de edição.
- Ícones de GitHub e TikTok do mockup são aproximações; o site usa os SVGs oficiais de `public/icons/social/`.
