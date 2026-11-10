# Home — referência e implementação

Modo: Persuade. Primeira versão local solicitada em 13 de outubro de 2026; não estabelece identidade definitiva para outras superfícies.

Implementação: React e Tailwind em `apps/site/src`, com bundle Vite e o servidor Node existente. A base web, incluindo o futuro painel, segue React sem Next.js e organização própria. Execução apenas local; o manifesto de produção do bot permanece inalterado.

## Direção da superfície

- Dois temas, claro e escuro, com os mesmos nomes de token (decisão de 03/11/2026, [tema do site](../../../../docs/decisions/site-theme.md)). Paleta monocromática (cinzas neutros, matiz e saturação zero), nos mesmos tokens de `globals.css`; só `danger`, `success` e `warning` têm cor. Valores e contraste: [tema do site](../../../../docs/decisions/site-theme.md) e Design System.
- Outfit 400/500/600/700 e Fraunces (`opsz` 72–144, peso 300–500, `SOFT` 0–100), via Google Fonts. Título da Home em Fraunces peso 300, `SOFT` 0, até 260px no desktop e 140px no celular.
- Primeira dobra editorial, sóbria, em preto e branco (linguagem em [cover-design.md](cover-design.md); desenhos em [design em artefatos](design-artifacts.md)): a arte `dashboard/LaddingPage/KuruttinaCard.webp` (R2, recorte transparente, meta `kuruttina-home-cover`, `homeCoverUrl` em `server/config.ts`) fica centralizada e grande, com o nome "Kuruttina" em Fraunces leve dividido em "Kuru" e "ttina" nos dois lados dela (desktop ≥1101px; abaixo disso, nome, arte e ações em coluna). Dois blocos baixos com linha fina: à esquerda o selo 狂 (quadrado sólido, discreto) e a frase "Sua comunidade merece mais do que silêncio."; à direita "Eu sou a Kuruttina. Adicione-me ao seu servidor." e os botões. Sem quadro, selo, listras, cinto, efeitos de mangá ou degradês. Botões de cantos quase retos, sem sombra. A composição e a imagem são as mesmas nos dois temas (no escuro a arte ganha contorno, token `halo`).
- Layout fluido nas larguras intermediárias, sempre dentro do limite do viewport. No desktop a Home também escala pela altura (`dvh`): nome e posições usam `clamp` com `vw` e `dvh`, para caber em 1280×720. O painel (`/dashboard`) cresce com a largura a partir de 1101px, como a barra superior, para não parecer pequeno ao lado da Home.
- Tema: `globals.css` guarda os tokens claros no `@theme` e os escuros em dois blocos idênticos (sistema e escolha manual). O botão da barra (`ThemeToggle`) alterna do sistema, claro e escuro; a escolha fica em `localStorage` (`kuruttina-theme`) e `public/theme-init.js` a aplica antes da primeira pintura. Os SVGs de `public/icons/theme/` seguem no repositório e na lista permitida, sem uso: o botão usa ícones inline.
- Navegação, convite, conta e redes preservam os rótulos e exibem avisos quando ainda não integrados. Não inventar URLs, OAuth ou dados administrativos.

## Assets e proveniência

Os dez SVGs locais mantêm as dimensões originais. Eles ficam em `apps/site/public/icons/`, separados por função: `theme/`, `account/`, `language/`, `community/` e `social/`. Desde 01/11/2026 a TopBar mostra o ícone do aplicativo Discord (`/applications/@me`) e a Home a foto de perfil do bot (`/users/@me`), lidos no servidor pelo token do bot (`botImages` em `server/auth.ts`, injetados nas metas `kuruttina-app-icon` e `kuruttina-avatar`). O objeto público `icons/Icons/1.jpg` do bucket `kurrutina-bot-pictures` ficou só como fallback de cada imagem; nenhuma imagem do R2 foi baixada, alterada ou enviada ao bucket, e o runtime armazena somente a chave relativa a partir de `ASSETS_BASE_URL`. Nenhum upload externo nesta entrega.

Consultar [Home local](../../../../docs/project/site.md) para execução e limites.

## Validação da entrega

Build do site, typecheck e 18 testes específicos aprovados. Capturas desktop 1440px, celular 390px e viewport de 1280px verificadas; imagens e Outfit carregadas. Revisão independente: `ship` para Home local. Suíte geral: 593 testes aprovados e uma falha fora do escopo em `tests/ban.test.ts:259`, por divergência de texto na resposta do bot; nenhum arquivo do bot foi alterado. Detector Impeccable indisponível; a etapa automática de documentação atingiu o limite de uso e a atualização factual foi concluída pelo agente principal.
