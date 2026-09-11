# Estado atual do KuruttinaBot

Última consolidação: 11 de setembro de 2026.

## Escopo implementado

O projeto atualmente entrega somente um bot Discord em TypeScript/ESM strict, executado em Node `22.14.x`, com `discord.js` `14.27.0`. Não há site, banco de dados, configuração Square Cloud, comandos guild-specific reais ou integração Discord real automatizada nos testes.

## Estrutura e responsabilidades

- `apps/bot/src/config.ts`: validação estrita de configuração e seleção do alvo.
- `apps/bot/src/bootstrap.ts` e `index.ts`: identidade, deploy opcional, Gateway, eventos e shutdown.
- `apps/bot/src/commands/`: comandos separados por tipo oficial e composição do único comando `ping`.
- `apps/bot/src/handlers/`: roteamento de commands e execução sequencial dos deployments.
- `apps/bot/src/deployments/`: tipos e deploy central global.
- `apps/bot/src/infrastructure/discord/`: chamadas Discord e validação de identidade.
- `apps/bot/src/infrastructure/logger.ts`: logs JSON em stdout/stderr.
- `config/partners` e `config/emojis`: exemplos/configuração auxiliar; não são comandos ativos.

O conjunto canônico publica somente `ping`. O deploy central substitui o conjunto global completo por `PUT`. A lista explícita de deployments é extensível, mas hoje contém apenas `central`.

## Configuração e ciclo de vida

`BOT_TARGET` aceita exatamente `development` ou `production`. Os dois pares `DISCORD_BOT_TOKEN_*`/`DISCORD_BOT_ID_*` são sempre obrigatórios; `activeCredential` é exatamente o par correspondente ao alvo, sem fallback. A exceção de acesso conjunto e cross-bot está formalizada no [ADR de credenciais duplas](../decisions/dual-bot-credentials.md).

O `.env.example` também reserva `DISCORD_CLIENT_SECRET_DEVELOPMENT` e `DISCORD_CLIENT_SECRET_PRODUCTION` para futuros fluxos OAuth2. Esses Client Secrets são diferentes dos Bot Tokens e ainda não são lidos nem exigidos pelo runtime atual.

`AUTO_SYNC_COMMANDS` aceita `true`/`false` e assume `false` quando ausente. Quando ativo, todos os deploys registrados são executados sequencialmente, antes do Gateway e da readiness; a primeira falha interrompe o startup. A identidade ativa é validada em `/users/@me` com timeout de 5 segundos, exigindo resposta de bot e ID esperado.

O startup falha fechado em configuração, identidade ou deploy. O shutdown destrói o client e termina após timeout. Logs estruturados incluem timestamp, nível, serviço e evento, sem tokens.

## Execução e distribuição

Há scripts npm explícitos por app (`build:bot`, `start:bot:*`, `dev:bot:*`) com aliases genéricos compatíveis, além de `deploy:central`, e Docker Compose com perfis `development`/`production`. O `infra/docker/bot.Dockerfile` é multi-stage, usa Node 22.14.0, instala pelo lockfile, remove dependências de desenvolvimento no runtime e executa como usuário não-root. Não há `squarecloud.app` versionado: o bot será configurado no painel da Square com 512 MB e `npm run build:bot && npm run start:bot:production`, preservando configuração independente para o futuro site.

## Segurança e validação

Gitleaks local/CI usa configuração versionada e v8.30.1 (binário local ou imagem Docker). Os testes atuais são `tests/config.test.ts`, `tests/commands.test.ts` e `tests/deployments.test.ts`, cobrindo configuração, `ping`, execução sequencial e falha fechada. Não há teste de integração Discord real.

## Riscos e decisões em aberto

- Credenciais duplas no mesmo ambiente ampliam o blast radius; manter seleção explícita, sem fallback, e rotação imediata após exposição.
- O deploy global é implementado; deploys guild-specific são apenas extensão futura, não comportamento atual.
- O shutdown é limitado e não há endpoint de health dedicado para o bot.
- A direção futura está decidida como Square Cloud Hobby para `bot`/`site` e dois projetos Supabase Free isolados para development/production, mas esses componentes ainda não estão implementados; consulte o [ADR](../decisions/square-cloud-supabase.md).
