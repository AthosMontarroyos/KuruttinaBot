# Estado atual do KuruttinaBot

Última consolidação: 13 de setembro de 2026.

## Escopo implementado

O projeto atualmente entrega somente um bot Discord em TypeScript/ESM strict, com `discord.js` `14.27.0`. O contrato `engines.node` aceita Node 22 a partir de `22.14.0` e as linhas 24 e 26; o Docker usa `22.14.0`, a Square foi observada em `24.15.0` e o ambiente local foi validado em `26.7.0`. Não há site, banco de dados, configuração Square Cloud versionada, comandos guild-specific reais ou integração Discord real automatizada nos testes.

## Estrutura e responsabilidades

- `apps/bot/src/config.ts`: validação estrita da configuração realmente consumida e seleção do alvo.
- `apps/bot/src/bootstrap.ts` e `index.ts`: identidade, deploy opcional, composição do Client, registro de eventos e shutdown.
- `apps/bot/src/commands/`: contratos, descoberta e commands organizados por categoria; atualmente contém apenas `public/ping.ts` como command executável.
- `apps/bot/src/events/`: callbacks dos eventos do Discord, separados do bootstrap.
- `apps/bot/src/handlers/`: catálogo, payload e despacho de commands, além da execução sequencial dos deployments.
- `apps/bot/src/deployments/`: tipos e deploy central global.
- `apps/bot/src/infrastructure/discord/`: chamadas Discord e validação de identidade.
- `apps/bot/src/infrastructure/logger.ts`: logs JSON em stdout/stderr.
- `config/partners` e `config/emojis`: exemplos/configuração auxiliar; não são comandos ativos.

O loader descobre automaticamente os módulos sob `apps/bot/src/commands`, exige nome, descrição e executor compartilhado e registra cada carregamento. O `CommandsHandler` valida nomes duplicados, mantém o catálogo canônico e gera o payload de publicação. Ambos são construídos explicitamente no startup/deploy, sem I/O durante importação. Slash permanece canônico, e todos os commands também são despachados automaticamente por `k!` ou `K!`, sem flag ou comando de ativação. Os adapters usam `CommandContext`, com `acknowledge()` para trabalho lento e `reply()` para concluir; atualmente não há argumentos. Falhas de interaction recebem resposta sanitizada conforme o estado `deferred`/`replied`. O conjunto atual publica somente `ping`; o deploy central substitui o conjunto global completo por `PUT`.

O Client solicita `Guilds`, `GuildMessages`, `DirectMessages` e `MessageContent`, com partial de canal para receber DMs e cache de mensagens desabilitado. `Message Content Intent` deve estar habilitado no Developer Portal de cada aplicação ativa. Bots, webhooks, mensagens de sistema e nomes desconhecidos são ignorados pelo despacho por prefixo.

## Configuração e ciclo de vida

`APP_ENV` aceita exatamente `development` ou `production`. Os dois pares `DISCORD_BOT_TOKEN_*`/`DISCORD_BOT_ID_*` são sempre obrigatórios; `activeCredential` é exatamente o par correspondente ao alvo, sem fallback. A exceção de acesso conjunto e cross-bot está formalizada no [ADR de credenciais duplas](../decisions/dual-bot-credentials.md).

Client Secrets OAuth2 não são declarados nem injetados até existir um fluxo que os consuma. `ASSETS_BASE_URL` também só passa a integrar o contrato do processo quando uma feature de mídia existir. As imagens não fazem parte do repositório nem do build; o endpoint `r2.dev` atual é provisório até a conexão de um domínio próprio.

`AUTO_SYNC_COMMANDS` aceita `true`/`false` e assume `false` quando ausente. Quando ativo, todos os deploys registrados são executados sequencialmente, antes do Gateway e da readiness; a primeira falha interrompe o startup. A identidade ativa é validada em `/users/@me` com timeout de 5 segundos, exigindo resposta de bot e ID esperado.

O startup falha fechado em configuração, carregamento, identidade ou deploy. O shutdown destrói o client e termina após timeout. Logs estruturados incluem timestamp, nível, serviço, evento e correlação da operação/interação, sem tokens nem mensagens de exceção potencialmente sensíveis.

## Execução e distribuição

Há scripts npm explícitos por app (`build:bot`, `start:bot:*`, `dev:bot:*`) com aliases genéricos compatíveis, além de `deploy:central`, e Docker Compose com perfis `development`/`production`. A leitura local e o Compose selecionam somente as credenciais/IDs Discord previstas pelo ADR e `AUTO_SYNC_COMMANDS`; secrets Cloudflare/OAuth não entram no ambiente carregado pelo bot e falhas permanentes não geram restart local infinito. O startup não monta nem sincroniza o R2; a montagem em `Pictures/` permanece uma ferramenta manual com identidade de processo validada. O alias `#bot/*`, compartilhado por `package.json`, `tsconfig.json`, `jsconfig.json` e `vitest.config.ts`, evita caminhos relativos transversais, resolve para source nos testes e para o código compilado em produção. O `infra/docker/bot.Dockerfile` é multi-stage, usa Node 22.14.0, instala pelo lockfile, remove as dependências classificadas somente para desenvolvimento e executa como usuário não-root. Não há `squarecloud.app` versionado: o bot é configurado no painel da Square com 512 MB e `npm run build:bot && npm run start:bot:production`, preservando configuração independente para o futuro site. Como a Square instala somente dependências de produção antes desse build, `typescript` e `@types/node` permanecem em `dependencies`; isso também os conserva no runtime Docker enquanto ambos os destinos compartilharem o mesmo manifesto.

## Segurança e validação

Gitleaks local/CI usa configuração versionada e v8.30.1 (binário local ou imagem Docker). O workflow de qualidade executa instalação pelo lockfile, typecheck, 58 testes em sete arquivos e build do bot. Os testes cobrem configuração, allowlist de ambiente, catálogo/adapters de commands, estados de interaction, identidade, manifesto de túnel e deployments; não há teste de integração Discord real.

## Riscos e decisões em aberto

- Credenciais duplas no mesmo ambiente ampliam o blast radius; manter seleção explícita, sem fallback, e rotação imediata após exposição.
- O deploy global é implementado; deploys guild-specific são apenas extensão futura, não comportamento atual.
- O shutdown é limitado e não há endpoint de health dedicado para o bot.
- A direção futura está decidida como Square Cloud Hobby para `bot`/`site` e dois projetos Supabase Free isolados para development/production, mas esses componentes ainda não estão implementados; consulte o [ADR](../decisions/square-cloud-supabase.md).
- O bucket R2 é a origem operacional das imagens; o backup externo e a futura troca de `r2.dev` por domínio próprio são responsabilidades operacionais registradas no [ADR de assets](../decisions/cloudflare-r2-assets.md).

## Cloudflare Tunnel e configuração compartilhada

`packages/config` expõe `@kuruttina/config`, consumido pelo bot e pelo launcher de túnel. `APP_ENV` substitui `BOT_TARGET`, que passa a ser rejeitado. A origem web padrão é `http://localhost:3666`; o site continua inexistente e o bot continua sem servidor HTTP.

Em 12/09/2026 foram recriados `kuruttina-development` e `kuruttina-production` na conta correta, com CNAMEs para `kuruttina.dev.athosmontarroyos.com` e `kuruttina.athosmontarroyos.com`, ambos roteados para `http://localhost:3666`. Permanecem inativos até iniciar seus connectors. O bucket R2 `kurrutina-bot-pictures` foi recriado, recebeu os 135 arquivos do backup e expõe provisoriamente `https://pub-271b6233fa924c46b0aa8664e8587f3f.r2.dev`. Inventário: [Cloudflare Tunnel](cloudflare-tunnel.md).

Validação desta consolidação: typecheck, build do bot e 58 testes aprovados; uma instalação limpa com `npm ci --omit=dev` também compilou o bot e confirmou a disponibilidade de `typescript` e `@types/node` no ambiente equivalente ao instalador da Square. Checks locais de seleção e manifesto dos dois túneis foram aprovados e o Compose foi renderizado com a allowlist esperada. O contrato de engine foi validado com Node 26.7.0 local e cobre o Node 24.15.0 observado na Square sem `EBADENGINE`. O build Docker foi tentado, mas o daemon do Docker Desktop estava indisponível.
