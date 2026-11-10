# Capa da Home — linguagem visual para as outras áreas

Direção aprovada pelo responsável em novembro de 2026: editorial, sóbria, em preto e branco, com a personagem como único foco. Substitui a versão mangá/zine (quadro de HQ, selo, listras, cinto) e a tentativa com raios e faixa, descartadas por parecerem exageradas. Os desenhos (desktop 1440×900 e celular 390×844, claro e escuro) estão nos artefatos de design: veja [design em artefatos](design-artifacts.md). Implementação em `apps/site/src/app/page.tsx`.

Leia só ao desenhar ou rever uma página pública do site. Layout e assets da Home continuam em [home.md](home.md).

## Princípios

- A imagem vem antes da informação: a personagem centralizada, grande, sem moldura, disco, quadro ou efeito.
- Tipografia como estrutura: nome em Fraunces peso 300, frase em Fraunces 400, resto em Outfit.
- Poucos elementos, linhas finas de 1px, botões de cantos quase retos (`rounded-[2px]`) sem sombra.
- Nada de função específica no texto enquanto ela não existir. "A Kuruttina" é feminino.

## Composição (desktop ≥1101px)

O nome é dividido em "Kuru" e "ttina", um de cada lado da personagem, como numa capa de revista, porque inteiro atrás dela os dedos e o cabelo escondiam o meio da palavra. Dois blocos no pé da página, cada um com linha fina em cima: à esquerda a frase "Eu deixo a sua comunidade em movimento."; à direita a linha de apoio e os botões "Adicionar ao Discord" (cheio) e "Painel de controle" (contorno). Abaixo de 1101px tudo vai em coluna: nome, arte, frase, botões.

## Voz do texto

Primeira pessoa no feminino, firme e calma, conforme [personalidade](../../../../docs/project/bot-personality.md). Sem tom de moderação, sem agressividade e sem a frase "Bot para Discord", que o responsável rejeitou.

## Tratamento da imagem

- Arte do R2: `dashboard/LaddingPage/KuruttinaCard.webp` (retrato recortado, fundo transparente, 1024×1536), pela meta `kuruttina-home-cover` (`homeCoverUrl` em `server/config.ts`). Sem o arquivo no R2 a Home mostra o nome e as ações.
- Fundo transparente é obrigatório: serve nos dois temas. No escuro, contorno fino com o token `--color-halo`.

## Barras superiores

Duas barras: `TopBar` (site público e lista de servidores) e `ServerTopBar` (painel `/dashboard/:serverId`). A `TopBar` traz o avatar do bot (Discord), "Kuruttina", o kanji 狂 (decorativo), os links Comandos, Módulos, Termos de serviço e Painel de controle, o idioma, o tema e a conta. A `ServerTopBar` traz o avatar, "‹ Servidores", o ícone e o nome do servidor, o idioma, o tema e a conta. O idioma é o componente único `LanguageIndicator`. No celular nenhuma página pública tem barra superior: a roleta (`WheelMenu`) a substitui.

## Para estender às outras áreas

- Comandos, Módulos e Termos: título em `font-display` e conteúdo funcional em Outfit e nos tokens; sem ilustração de apoio.
- Painel: segue a base funcional; só o cabeçalho pode adotar a serifa. Não aplicar a ilustração em telas de edição.
