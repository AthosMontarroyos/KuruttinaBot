# Home — referência e implementação

Modo: Persuade. Primeira versão local solicitada em 13 de outubro de 2026; não estabelece identidade definitiva para outras superfícies.

Implementação: React e Tailwind em `apps/site/src`, com bundle Vite e o servidor Node existente. A base web, incluindo o futuro painel, segue React sem Next.js e organização própria. Execução apenas local; o manifesto de produção do bot permanece inalterado.

## Direção da superfície

- Paleta Noite & Rosa (01/11/2026), extraída da arte do bot (ícone do aplicativo e foto de perfil): escuro com fundo #140b12, superfície #1f1220, borda #3b2336, texto #fdf6fc, muted #c9b0bf e acento rosa #f08db4; claro em blush com fundo #fdf6fc, superfície #f7e6ef, acento #ee7fa9 e rosa escuro #862954 para texto e foco. `danger` é vermelho-alaranjado para não se confundir com o rosa. Os mesmos tokens ficam em `globals.css`; a cor padrão dos embeds do bot é `0xf08db4`. As cores do Discord no preview do editor são exceção.
- Outfit 400/500/600/700, via Google Fonts. Título 64px desktop e 40px celular.
- Controles arredondados; foto 420 × 520 desktop, 350 × 420 a 390px de viewport. Espaçamento externo 5% desktop e 20px celular.
- Layout fluido nas larguras intermediárias, sempre dentro do limite do viewport.
- Troca de tema com preferência local. Tema claro é adaptação funcional; o alvo visual é o tema escuro.
- Navegação, convite, conta e redes preservam os rótulos e exibem avisos quando ainda não integrados. Não inventar URLs, OAuth ou dados administrativos.

## Assets e proveniência

Os dez SVGs locais mantêm as dimensões originais. Eles ficam em `apps/site/public/icons/`, separados por função: `theme/`, `account/`, `language/`, `community/` e `social/`. Desde 01/11/2026 a TopBar mostra o ícone do aplicativo Discord (`/applications/@me`) e a Home a foto de perfil do bot (`/users/@me`), lidos no servidor pelo token do bot (`botImages` em `server/auth.ts`, injetados nas metas `kuruttina-app-icon` e `kuruttina-avatar`). O objeto público `icons/Icons/1.jpg` do bucket `kurrutina-bot-pictures` ficou só como fallback de cada imagem; nenhuma imagem do R2 foi baixada, alterada ou enviada ao bucket, e o runtime armazena somente a chave relativa a partir de `ASSETS_BASE_URL`. Nenhum upload externo nesta entrega.

Consultar [Home local](../../../../docs/project/site.md) para execução e limites.

## Validação da entrega

Build do site, typecheck e 18 testes específicos aprovados. Capturas desktop 1440px, celular 390px e viewport de 1280px verificadas; imagens e Outfit carregadas. Revisão independente: `ship` para Home local. Troca de tema conferida no browser. Suíte geral: 593 testes aprovados e uma falha fora do escopo em `tests/ban.test.ts:259`, por divergência de texto na resposta do bot; nenhum arquivo do bot foi alterado. Detector Impeccable indisponível; a etapa automática de documentação atingiu o limite de uso e a atualização factual foi concluída pelo agente principal.
