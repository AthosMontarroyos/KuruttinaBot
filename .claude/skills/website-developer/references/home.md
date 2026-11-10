# Home — referência e implementação

Modo: Persuade. Primeira versão local solicitada em 13 de outubro de 2026; não estabelece identidade definitiva para outras superfícies.

Implementação: React e Tailwind em `apps/site/src`, com bundle Vite e o servidor Node existente. A base web, incluindo o futuro painel, segue React sem Next.js e organização própria. Execução apenas local; o manifesto de produção do bot permanece inalterado.

## Direção da superfície

- Dois temas, claro e escuro, com os mesmos nomes de token (decisão de 03/11/2026, [tema do site](../../../../docs/decisions/site-theme.md)). Paleta monocromática (cinzas neutros, matiz e saturação zero), nos mesmos tokens de `globals.css`; só `danger`, `success` e `warning` têm cor. Valores e contraste: [tema do site](../../../../docs/decisions/site-theme.md) e Design System.
- Outfit 400/500/600/700, via Google Fonts. Título da Home em Fraunces suave, até 240px no desktop e 80px no celular.
- Primeira dobra no estilo mangá/zine em preto e branco (linguagem em [cover-design.md](cover-design.md); desenhos em [design em artefatos](design-artifacts.md)): a arte `dashboard/LaddingPage/KuruttinaCard.webp` (R2, recorte transparente, meta `kuruttina-home-cover`, `homeCoverUrl` em `server/config.ts`) fica num quadro de HQ com meia-tinta, com as mãos saindo do quadro; selo 狂, faixa de listras, título "Kuruttina" em Fraunces com a lua no lugar do ponto, redes e a faixa de cinto com ilhoses e fivela. Botões de cantos quase retos. A composição e a imagem são as mesmas nos dois temas (no escuro a arte ganha contorno claro). O site não usa degradês: listras e meia-tinta são o único padrão gráfico. Espaçamento externo 5% desktop e 20px celular; no celular o cinto fica mais curto para não ficar sob o botão da roleta.
- Layout fluido nas larguras intermediárias, sempre dentro do limite do viewport. No desktop a Home também escala pela altura (`dvh`): quadro, título e texto usam `clamp` com `vw` e `dvh`, para caber em 1280×720 sem o cinto cruzar a arte. O painel (`/dashboard`) cresce com a largura a partir de 1101px, como a barra superior, para não parecer pequeno ao lado da Home.
- Tema: `globals.css` guarda os tokens claros no `@theme` e os escuros em dois blocos idênticos (sistema e escolha manual). O botão da barra (`ThemeToggle`) alterna do sistema, claro e escuro; a escolha fica em `localStorage` (`kuruttina-theme`) e `public/theme-init.js` a aplica antes da primeira pintura. Os SVGs de `public/icons/theme/` seguem no repositório e na lista permitida, sem uso: o botão usa ícones inline.
- Navegação, convite, conta e redes preservam os rótulos e exibem avisos quando ainda não integrados. Não inventar URLs, OAuth ou dados administrativos.

## Assets e proveniência

Os dez SVGs locais mantêm as dimensões originais. Eles ficam em `apps/site/public/icons/`, separados por função: `theme/`, `account/`, `language/`, `community/` e `social/`. Desde 01/11/2026 a TopBar mostra o ícone do aplicativo Discord (`/applications/@me`) e a Home a foto de perfil do bot (`/users/@me`), lidos no servidor pelo token do bot (`botImages` em `server/auth.ts`, injetados nas metas `kuruttina-app-icon` e `kuruttina-avatar`). O objeto público `icons/Icons/1.jpg` do bucket `kurrutina-bot-pictures` ficou só como fallback de cada imagem; nenhuma imagem do R2 foi baixada, alterada ou enviada ao bucket, e o runtime armazena somente a chave relativa a partir de `ASSETS_BASE_URL`. Nenhum upload externo nesta entrega.

Consultar [Home local](../../../../docs/project/site.md) para execução e limites.

## Validação da entrega

Build do site, typecheck e 18 testes específicos aprovados. Capturas desktop 1440px, celular 390px e viewport de 1280px verificadas; imagens e Outfit carregadas. Revisão independente: `ship` para Home local. Suíte geral: 593 testes aprovados e uma falha fora do escopo em `tests/ban.test.ts:259`, por divergência de texto na resposta do bot; nenhum arquivo do bot foi alterado. Detector Impeccable indisponível; a etapa automática de documentação atingiu o limite de uso e a atualização factual foi concluída pelo agente principal.
