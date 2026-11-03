# Capa da Home — linguagem visual para as outras áreas

Direção aprovada pelo responsável em 02/11/2026 para a primeira dobra da Home. Serve de base quando o redesenho chegar às demais páginas. O mockup (desktop 1440×900 e celular 390×844) está no Artifact de design [Kuruttina — Redesign da Home](https://claude.ai/artifact/EQTpe4ukbPY5KhjtX8ZkmP); novas áreas entram como artboards no mesmo canvas, para a comparação ficar num lugar só. Implementação em `apps/site/src/app/page.tsx` e `globals.css` (bloco `.home-cover`).

Leia só ao desenhar ou rever uma página pública do site. Detalhes de layout e assets da Home continuam em [home.md](home.md).

## Objetivo

A primeira impressão é a Kuruttina como personagem: bonita, acolhedora e apresentável, nunca tecnológica. A imagem vem antes da informação; texto e botões ficam em segundo plano. O bot é de interação com a comunidade, mas ainda não tem todas as funções: o texto fala de quem ela é, não lista funções que não existem.

## Princípios

- **A ilustração é a capa.** Ocupa a altura inteira de um lado (desktop) ou o topo (celular), sem moldura de painel, cartão ou grade. Nada de aparência de aplicativo, painel ou código.
- **Palco liso.** Fundo liso e um disco atrás da personagem (`bg-stage-disc`: rosa suave no claro, ameixa no escuro). Sem degradê visível como elemento de design.
- **Título como pôster.** "Kuruttina" em Fraunces suave (`font-display`, 500, `SOFT` 100, `opsz` 144), grande (até 240px), com o ponto final em rosa, cruzando por cima da arte. O resto do site continua em Outfit.
- **Uma ação principal.** Uma pílula rosa cheia ("Adicionar ao Discord"); a secundária é só contorno; apoio e redes são botões redondos discretos.
- **Primeiro a imagem, depois o texto.** Parágrafo curto, no máximo duas frases, na voz dela.

## Voz do texto

Primeira pessoa no feminino, calma e simpática, conforme [personalidade](../../../../docs/project/bot-personality.md). Texto aprovado: "Oi, eu sou a Kuruttina. Vim para deixar a sua comunidade mais viva, e ficar por perto." Foram descartados: tom de moderação ("cuido da ordem do servidor") e descrição genérica de bot ("entra no seu servidor pelo Discord"). Não cite função específica enquanto ela não existir. "A Kuruttina" é feminino: nunca "O Kuruttina".

## Tratamento da imagem

- Arte do R2: `dashboard/LaddingPage/CardRetrato-recorte.webp` (1472×2616, retrato transparente). Entra pela meta `kuruttina-home-cover`, como as outras imagens remotas.
- Uma máscara linear só suaviza a borda cortada (esquerda no desktop, embaixo no celular).
- O arquivo tem 2x a resolução de exibição, para ficar nítido em tela de alta densidade.
- Outras páginas devem usar arte do mesmo conjunto, com fundo transparente.

## Fidelidade ao mockup

O mockup é uma composição fixa de 1440×900 (Main.dc.html no Artifact). Porcentagens e alturas que variam com a tela esticavam a composição: arte, disco e título perdiam a proporção do design em 1920px (disco na ponta do pescoço, personagem grande demais). A partir de 1100px a Home é, então, a composição do mockup com `zoom` por igual (`useStageScale` em `page.tsx`: escala = min(largura/1440, altura/720)). A largura do palco é sempre 1440 e só a altura varia (720 até o teto de 900 da arte): travar a escala em altura/900, como antes, deixava o palco mais largo que o design em qualquer tela mais larga que 16:10 (1920×1080 com barras do navegador, 1440×780...), abria um vão entre texto e arte e o título deixava de cruzá-la. A arte precisa continuar encostada na borda direita (a personagem sai da imagem), por isso não se centra um palco de 1440 com margens. Só janelas mais largas que 2:1 (ultrawide) ainda alargam o palco. Dentro dele valem as medidas do mockup em px: caixa da arte 662px de largura e a altura do palco (máx. 900) ancorada embaixo à direita; em palco mais baixo que 900 a base da arte (livro) é cortada, disco 760px em `top -140` e `right -90` da caixa, título 216px, parágrafo 24px, botões 56px; a coluna de texto tem `max-w-[480px]`, então o botão redondo de suporte desce para a linha de baixo, como no mockup. Abaixo de 1100px o layout é fluido (tablet e celular). Não use `vw`, `vh` nem `%` de altura nas medidas da capa em ≥1100px: com `zoom` elas escalam duas vezes. Sem scroll: a capa preenche a tela (barra transparente por cima, sem rodapé).

## Tema escuro

Aprovado em 03/11/2026 (decisão em [tema do site](../../../../docs/decisions/site-theme.md)). **A Home tem a mesma composição nos dois temas**: mesmo disco, mesma posição e tamanho da arte, mesmo título de 216px, mesma máscara; só as cores (tokens) mudam. Um arco, moldura ou título menor no escuro foram propostos e descartados: a página não pode virar outra ao trocar de tema. Os valores dos dois temas, o contraste medido e as regras estão no Design System [Kuruttina](https://claude.ai/artifact/Y2HRdEM97Ag26dG7pPZFGy) (`dark-theme.md`); os mesmos valores estão em `globals.css`.

- Disco: `--color-stage-disc` é rosa-claro no claro e ameixa (`#331d29`) no escuro. O rosa-claro no escuro deixava os links da barra ilegíveis onde cruzam o disco.
- Arte: uma só, sem fundo, nos dois temas (`dashboard/LaddingPage/CardRetrato-recorte.webp` no R2). A original (`CardRetrato.jpg`, fundo branco) só funcionava com `multiply` sobre claro; por isso foi substituída, e o `multiply` saiu do CSS. O recorte foi feito com um gerador de imagens e é um redesenho da arte (cabeça e máscara iguais; mão, livro, almofada e mechas diferem um pouco), aprovado pelo responsável em 03/11/2026. Foi alinhado à original num canvas de 1472×2616 (a proporção 736×1308 em 2x): é drop-in, sem ajuste de CSS. Sem esse arquivo no R2 a Home mostra só o disco, o título e as ações.
- Outra página com arte de fundo branco usa uma versão recortada, nunca `multiply`: ele não funciona sobre o escuro.

## Barras superiores

Duas barras, aprovadas em 02/11/2026: `TopBar` (site público e lista de servidores) e `ServerTopBar` (painel `/dashboard/:serverId`: marca, voltar para Servidores, ícone e nome do servidor, conta). Na Home a `TopBar` é transparente sobre a capa, para a arte ocupar a altura toda e o enquadramento bater com o mockup; nos dois temas. O mockup do painel e as pranchas da Home escura estão no mesmo Artifact ("TopBar 2").

## Para estender às outras áreas

- Comandos, Módulos e Termos: título da página em `font-display`, fundo blush e ilustração de apoio na borda; conteúdo funcional continua em Outfit e nos tokens.
- Painel: segue a base funcional atual; só o cabeçalho pode adotar a serifa. Não aplicar a ilustração em telas de edição.
- Ícones de GitHub e TikTok do mockup são aproximações; o site usa os SVGs oficiais de `public/icons/social/`.
