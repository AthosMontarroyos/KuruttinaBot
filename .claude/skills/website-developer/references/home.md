# Home — referência e implementação

Modo: Persuade. Primeira versão local solicitada em 13 de outubro de 2026; não estabelece identidade definitiva para outras superfícies.

Implementação: React e Tailwind em `apps/site/src`, com bundle Vite e o servidor Node existente. A base web, incluindo o futuro painel, segue React sem Next.js e organização própria. Execução apenas local; o manifesto de produção do bot permanece inalterado.

## Direção da superfície

- Tema escuro removido do site em 02/11/2026 (decisão do responsável: será decidido depois; a proposta aprovada está em [cover-design.md](cover-design.md)). Hoje existe só a paleta clara. Paleta Noite & Rosa (01/11/2026), extraída da arte do bot (ícone do aplicativo e foto de perfil): escuro com fundo #140b12, superfície #1f1220, borda #3b2336, texto #fdf6fc, muted #c9b0bf e acento rosa #f08db4; claro em blush com fundo #fdf6fc, superfície #f7e6ef, acento #ee7fa9 e rosa escuro #862954 para texto e foco. `danger` é vermelho-alaranjado para não se confundir com o rosa. Os mesmos tokens ficam em `globals.css`; a cor padrão dos embeds do bot é `0xf08db4`. As cores do Discord no preview do editor são exceção.
- Outfit 400/500/600/700, via Google Fonts. Título da Home em Fraunces suave, até 240px no desktop e 80px no celular.
- Controles arredondados. Desde 02/11/2026 a primeira dobra é uma capa de pôster (linguagem em [cover-design.md](cover-design.md)): a ilustração `dashboard/LaddingPage/CardRetrato.jpg` (R2, meta `kuruttina-home-cover`, `homeCoverUrl` em `server/config.ts`) ocupa a altura do lado direito no desktop e o topo no celular, sobre um disco rosa liso (`bg-accent-soft`); o título "Kuruttina." em Fraunces (`font-display`) cruza por cima da arte, e o parágrafo, os botões e as redes ficam à esquerda (desktop) ou embaixo (celular). No tema claro a imagem cobre a página (`mix-blend-mode: multiply` e máscara na borda cortada); no escuro ela fica num arco rosa-claro com anel e brilho (`.home-cover-card`, token `stage-disc`) e o resto segue o tema; a caixa da arte tem proporção fixa para o zoom não variar com a largura da tela. A foto de perfil do bot e a moldura de flores saíram da Home (a foto segue na prévia do chat). O site não usa degradês (fundo, título e faixa dos cartões do painel são cores lisas dos tokens); a Home não tem selo acima do título nem seção de cards abaixo da primeira dobra. Espaçamento externo 5% desktop e 20px celular. Telas grandes (a partir de 1101px): título, parágrafo, botões, avatar, ícones e a barra superior (links, logo, idioma e conta) crescem de forma fluida com `clamp` e `vw`, e a seção ocupa a altura entre a barra e o rodapé com o conteúdo centrado na vertical; em 1906px o título tem uns 99px, os links 20px e o avatar 610px. Abaixo de 1101px e no celular os tamanhos são os de antes. A margem de 5% é a mesma do cabeçalho e do rodapé, e o botão redondo de ícone do cabeçalho vem de `src/components/header-icon.ts`.
- Layout fluido nas larguras intermediárias, sempre dentro do limite do viewport.
- Sem troca de tema: o site tem só a paleta clara (os tokens de `globals.css` são os claros). Os SVGs de `public/icons/theme/` seguem no repositório e na lista permitida, sem uso.
- Navegação, convite, conta e redes preservam os rótulos e exibem avisos quando ainda não integrados. Não inventar URLs, OAuth ou dados administrativos.

## Assets e proveniência

Os dez SVGs locais mantêm as dimensões originais. Eles ficam em `apps/site/public/icons/`, separados por função: `theme/`, `account/`, `language/`, `community/` e `social/`. Desde 01/11/2026 a TopBar mostra o ícone do aplicativo Discord (`/applications/@me`) e a Home a foto de perfil do bot (`/users/@me`), lidos no servidor pelo token do bot (`botImages` em `server/auth.ts`, injetados nas metas `kuruttina-app-icon` e `kuruttina-avatar`). O objeto público `icons/Icons/1.jpg` do bucket `kurrutina-bot-pictures` ficou só como fallback de cada imagem; nenhuma imagem do R2 foi baixada, alterada ou enviada ao bucket, e o runtime armazena somente a chave relativa a partir de `ASSETS_BASE_URL`. Nenhum upload externo nesta entrega.

Consultar [Home local](../../../../docs/project/site.md) para execução e limites.

## Validação da entrega

Build do site, typecheck e 18 testes específicos aprovados. Capturas desktop 1440px, celular 390px e viewport de 1280px verificadas; imagens e Outfit carregadas. Revisão independente: `ship` para Home local. Suíte geral: 593 testes aprovados e uma falha fora do escopo em `tests/ban.test.ts:259`, por divergência de texto na resposta do bot; nenhum arquivo do bot foi alterado. Detector Impeccable indisponível; a etapa automática de documentação atingiu o limite de uso e a atualização factual foi concluída pelo agente principal.
