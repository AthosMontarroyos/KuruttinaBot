# Capa da Home — linguagem visual para as outras áreas

Direção aprovada pelo responsável em novembro de 2026, no estilo mangá/zine em preto e branco, a partir da arte `KuruttinaCard.webp`. Os desenhos (desktop 1440×900 e celular 390×844, claro e escuro) estão nos artefatos de design, não neste arquivo: veja [design em artefatos](design-artifacts.md). Implementação em `apps/site/src/app/page.tsx`.

Leia só ao desenhar ou rever uma página pública do site. Layout e assets da Home continuam em [home.md](home.md).

## Objetivo

A primeira impressão é a Kuruttina como personagem, com um traço gráfico e uma paleta só de cinzas. A imagem vem antes da informação; texto e botões ficam em segundo plano. O bot é de interação com a comunidade, mas ainda não tem todas as funções: o texto fala de quem ela é, não lista funções que não existem.

## Elementos da composição

Todos tiram sua forma da própria ilustração (camiseta listrada, rede, cinto com ilhoses, colar de lua, mãos estendidas):

- **Quadro de HQ.** A arte fica num quadro de borda fina (`border-text`, fundo `surface`) com meia-tinta de pontos; as mãos saem do quadro pelo topo e pela direita. Nada de disco nem moldura de painel.
- **Selo 狂.** Quadrado sólido (`bg-text text-background`) sobre o canto superior esquerdo do quadro, em Noto Serif JP 700.
- **Listras.** Faixa de listras horizontais entre o texto e o título, como a camiseta.
- **Título.** "Kuruttina" em Fraunces suave (`font-display`, 500, `SOFT` 100, `opsz` 144), grande, e a lua do colar no lugar do ponto final.
- **Cinto.** Faixa com ilhoses e fivela fechando a página; no celular fica mais curta para não ficar sob o botão do menu.
- **Botões** de cantos quase retos (`rounded-[6px]`): um principal cheio ("Adicionar ao Discord"), um de contorno ("Painel de controle") e o de suporte; as redes são botões redondos discretos.

A composição é **a mesma nos dois temas**: só os tokens mudam. No escuro, a arte (que tem roupa e cabelo pretos) ganha um contorno claro fino.

## Voz do texto

Primeira pessoa no feminino, calma e simpática, conforme [personalidade](../../../../docs/project/bot-personality.md). Texto aprovado: "Oi, eu sou a Kuruttina. Vim para deixar a sua comunidade mais viva, e ficar por perto." Foram descartados: tom de moderação ("cuido da ordem do servidor") e descrição genérica de bot ("entra no seu servidor pelo Discord"). Não cite função específica enquanto ela não existir. "A Kuruttina" é feminino: nunca "O Kuruttina".

## Tratamento da imagem

- Arte do R2: `dashboard/LaddingPage/KuruttinaCard.webp` (retrato recortado, fundo transparente, 1024×1536). Entra pela meta `kuruttina-home-cover` (`homeCoverUrl` em `server/config.ts`), como as outras imagens remotas. Sem o arquivo no R2 a Home mostra só o quadro, o título e as ações.
- Fundo transparente é obrigatório: ela serve nos dois temas sem `multiply`. Outras páginas com arte devem usar recortes do mesmo conjunto.

## Barras superiores

Duas barras: `TopBar` (site público e lista de servidores) e `ServerTopBar` (painel `/dashboard/:serverId`). A `TopBar` traz o avatar do bot (Discord, nunca arquivo do repositório), "Kuruttina", uma linha fina com o kanji 狂 (decorativo), os links Comandos, Módulos, Termos de serviço e Painel de controle, o idioma, o tema e a conta. A `ServerTopBar` traz o avatar, "‹ Servidores", o ícone e o nome do servidor, o idioma, o tema e a conta. O idioma é o componente único `LanguageIndicator`, usado nas duas. No celular nenhuma página pública tem barra superior: a roleta (`WheelMenu`) a substitui.

## Para estender às outras áreas

- Comandos, Módulos e Termos: título em `font-display` e conteúdo funcional em Outfit e nos tokens; sem ilustração de apoio.
- Painel: segue a base funcional atual; só o cabeçalho pode adotar a serifa. Não aplicar a ilustração em telas de edição.
- Ícones de GitHub e TikTok do desenho são aproximações; o site usa os SVGs oficiais de `public/icons/social/`.
