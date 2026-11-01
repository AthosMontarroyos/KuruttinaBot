# Home — referência e implementação

Modo: Persuade. Primeira versão local solicitada em 13 de outubro de 2026; não estabelece identidade definitiva para outras superfícies.

Fonte: [Kuruttina Home no Figma](https://www.figma.com/design/GQNMJgri0cuH6IuiFSJ6Qx/Kuruttina-Home?node-id=0-1). Desktop `2:2` (1440 × 813), celular `2:54` (390 × 905). Contexto completo e screenshots extraídos pelo MCP do Figma; não usar screenshots como imagem da página.

Implementação: React e Tailwind em `apps/site/src`, com bundle Vite e o servidor Node existente. A base web, incluindo o futuro painel, segue React sem Next.js e organização própria. Execução apenas local; o manifesto de produção do bot permanece inalterado.

## Direção da superfície

- Paleta Noite & Ouro: fundo #0b0d16, superfície #141726, borda #2a2f47, texto #f4f1ea, muted #a9adc2, acento ouro #e9b949; claro em papel #faf8f3. O acento ouro vem dos olhos da mascote; as cores do Discord no preview do editor são exceção.
- Outfit 400/500/600/700, via Google Fonts. Título 64px desktop e 40px celular.
- Controles arredondados; foto 420 × 520 desktop, 350 × 420 a 390px de viewport. Espaçamento externo 5% desktop e 20px celular.
- Layout fluido nas larguras intermediárias. O Figma tem uma inconsistência de largura no frame de apresentação desktop (804px mais 420px de foto e espaços excedem o frame); a implementação respeita o enquadramento da screenshot e o limite do viewport.
- Troca de tema com preferência local. Tema claro é adaptação funcional; o alvo visual do Figma é o tema escuro.
- Navegação, convite, conta e redes preservam os rótulos e exibem avisos quando ainda não integrados. Não inventar URLs, OAuth ou dados administrativos.

## Assets e proveniência

Os dez SVGs locais vieram dos frames acima pelo MCP do Figma, com dimensões originais preservadas. Eles ficam em `apps/site/public/icons/`, separados por função: `theme/`, `account/`, `language/`, `community/` e `social/`. Avatar e foto foram substituídos conforme autorização do usuário pelo objeto público `icons/Icons/1.jpg` do bucket `kurrutina-bot-pictures`, localizado pelo MCP Cloudflare e inspecionado no browser. Nenhuma imagem do R2 foi baixada, alterada ou enviada ao bucket. O runtime recebe `ASSETS_BASE_URL` e armazena somente a chave relativa. A imagem é provisória, escolhida entre os avatares existentes; não representa uma nova aprovação de identidade ou licença. Nenhum upload externo nesta entrega.

Consultar [Home local](../../../../docs/project/site.md) para execução e limites.

## Validação da entrega

Build do site, typecheck e 18 testes específicos aprovados. Capturas desktop 1440px, celular 390px e viewport de 1280px verificadas; imagens e Outfit carregadas. Revisão independente: `ship` para Home local. Troca de tema conferida no browser. Suíte geral: 593 testes aprovados e uma falha fora do escopo em `tests/ban.test.ts:259`, por divergência de texto na resposta do bot; nenhum arquivo do bot foi alterado. Detector Impeccable indisponível; a etapa automática de documentação atingiu o limite de uso e a atualização factual foi concluída pelo agente principal.
