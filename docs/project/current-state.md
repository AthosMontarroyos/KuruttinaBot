# Estado atual do KuruttinaBot

Última consolidação: 23 de setembro de 2026.

## Escopo implementado

O projeto atualmente entrega somente um bot Discord em TypeScript/ESM strict, com `discord.js` `14.27.0`. O contrato `engines.node` aceita Node 22 a partir de `22.14.0` e as linhas 24 e 26; o Docker usa `22.14.0`, a Square foi observada em `24.15.0` e o ambiente local foi validado em `26.7.0`. Não há site, configuração Square Cloud versionada ou integração Discord real automatizada nos testes. PostgreSQL/Supabase, cadastro de equipe, deploy por guilda e os comandos de importação de emoji (`dev` na guilda da equipe, `emoji` no global) estão implementados; consulte [Acesso do bot](bot-access.md) e [Importação de emojis](emoji-import.md).

## Estrutura e responsabilidades

- `apps/bot/src/config.ts`: validação estrita da configuração realmente consumida e seleção do alvo.
- `apps/bot/src/bootstrap.ts` e `index.ts`: identidade, deploy opcional, composição do Client, registro de eventos e shutdown.
- `apps/bot/src/commands/`: contratos, política de acesso (`types.ts`/`access.ts`), descoberta e commands organizados por categoria: `public/ping.ts`, `mod/clear.ts`, `mod/emoji.ts` e `dev/emoji.ts` (escopo `dev-guild`, deploy somente na guilda da equipe); `emojiAdd.ts` concentra o executor compartilhado das duas operações de importação e fica fora da descoberta. A convenção de categorias está em [Discord bot](../agents/discord-bot.md#regra-categorias-de-commands).
- `apps/bot/src/events/`: callbacks dos eventos do Discord, separados do bootstrap.
- `apps/bot/src/handlers/`: catálogo, payload e despacho de commands, além da execução sequencial dos deployments.
- `apps/bot/src/deployments/`: tipos e deploy central global.
- `apps/bot/src/infrastructure/discord/`: chamadas Discord e validação de identidade.
- `apps/bot/src/infrastructure/discord/commandContext.ts`: resolução compartilhada de emojis com fallback Unicode e contexto de canal/permissões para slash e prefixo; `clearAdapter.ts` concentra fetch e exclusão individual/em lotes.
- `apps/bot/src/application/emojis/`: núcleo de importação de emojis (contratos, validação/compressão e serviço com fila), sem exposição a comandos; ver [Importação de emojis](emoji-import.md).
- `apps/bot/src/infrastructure/images/`: processador `sharp`/`gifenc` com escada de compressão até 256 KiB e downloader restrito ao CDN do Discord.
- `apps/bot/src/infrastructure/discord/emojiAdapter.ts`: criação de Application/Guild Emojis via `discord.js` com data URI e mapeamento de erros de capacidade.
- `apps/bot/src/infrastructure/logger.ts`: logger central com apresentação humana no desenvolvimento e na produção; runtime e build reutilizam `terminalFormatter.ts`, e os ANSI ficam isolados em `terminalColors.ts`.

O loader descobre automaticamente os módulos sob `apps/bot/src/commands`, exige nome, descrição não vazia, executor compartilhado, a política de acesso `access` (com `default_member_permissions` consistente) e o `scope` de publicação coerente — `dev/` ⇔ `dev-guild` ⇔ `staff` — e registra cada carregamento; módulo ausente ou inválido falha fechado. O `CommandsHandler` valida nomes duplicados e a coerência entre `scope` e política, mantém o catálogo canônico, aplica a política de acesso antes do executor — negando fechado em slash e prefixo quando as permissões de contexto não estão disponíveis — e gera o payload de publicação por escopo. Ambos são construídos explicitamente no startup/deploy, sem I/O durante importação. Slash permanece canônico, e todos os commands também são despachados automaticamente por `k!` ou `K!`, sem flag ou comando de ativação. Os adapters usam `CommandContext`, com `acknowledge()` para trabalho lento e `reply()` para concluir; `clear` recebe quantidade de 1 a 200 e filtro opcional de usuário por options slash ou argumentos do prefixo. Falhas de interaction recebem resposta sanitizada conforme o estado `deferred`/`replied`. O conjunto global publica `clear`, `emoji` e `ping`. O deploy central sincroniza separadamente o conjunto global e o conjunto `dev-guild` da guilda cadastrada, atualmente com `dev`, por `PUT`.

O Client solicita `Guilds`, `GuildMessages`, `DirectMessages` e `MessageContent`, com partial de canal para receber DMs e cache de mensagens desabilitado. `Message Content Intent` deve estar habilitado no Developer Portal de cada aplicação ativa. Bots, webhooks, mensagens de sistema e nomes desconhecidos são ignorados pelo despacho por prefixo.

O `clear` rejeita filtros de usuário inválidos antes de buscar/apagar mensagens e impede operações simultâneas no mesmo canal por processo. Sua política `access` (permissões de membro e de app no canal, incluindo a permissão de envio própria de threads) é validada centralmente pelo `CommandsHandler` antes do executor, nos dois transports, e rechecada no início do executor; as negações usam a copy amigável do comando com emojis do bot, degradando para texto puro quando o emoji não resolve. Os fallbacks Unicode do resolver ficam restritos a `dancing`, `stats` e `gateway`. A classe genérica de permissões sem consumidor no runtime foi removida.

## Configuração e ciclo de vida

`APP_ENV` aceita exatamente `development` ou `production`. Os dois pares `DISCORD_BOT_TOKEN_*`/`DISCORD_BOT_ID_*` são sempre obrigatórios; `activeCredential` é exatamente o par correspondente ao alvo, sem fallback. A exceção de acesso conjunto e cross-bot está formalizada no [ADR de credenciais duplas](../decisions/dual-bot-credentials.md).

Client Secrets OAuth2 não são declarados nem injetados até existir um fluxo que os consuma. `ASSETS_BASE_URL` também só passa a integrar o contrato do processo quando uma feature de mídia existir. As imagens não fazem parte do repositório nem do build; o endpoint `r2.dev` atual é provisório até a conexão de um domínio próprio.

`AUTO_SYNC_COMMANDS` aceita `true`/`false` e assume `false` quando ausente. Quando ativo, todos os deploys registrados são executados sequencialmente, antes do Gateway e da readiness; a primeira falha interrompe o startup. A identidade ativa é validada em `/users/@me` com timeout de 5 segundos, exigindo resposta de bot e ID esperado.

O startup falha fechado em configuração, carregamento, identidade ou deploy e informa o registro dos listeners `clientReady`, `interactionCreate` e `messageCreate`. O shutdown destrói o client e termina após timeout. Development e production usam a mesma apresentação humana com categorias e metadata; production permanece sem ANSI, enquanto development aplica cores somente em TTY compatível e respeita `NO_COLOR`. A exceção ao JSON de produção está registrada em [Logs humanos do bot em produção](../decisions/human-readable-bot-logs.md). Os logs preservam stdout/stderr e omitem tokens e mensagens de exceção potencialmente sensíveis. A sincronização operacional de emojis mantém `R2/emojis/` plano como espelho completo dos Application Emojis de production; o comando completo também espelha esse conjunto na aplicação development, com validação de identidade, tamanho e rate limit.

## Execução e distribuição

O `build:bot` apresenta somente o início e o resultado reais da compilação pelo mesmo formatter humano do runtime, preservando stdout/stderr do TypeScript.

Há scripts npm explícitos por app (`build:bot`, `start:bot:*`, `dev:bot:*`) com aliases genéricos compatíveis, além de `deploy:central`, e Docker Compose com perfis `development`/`production`. A leitura local e o Compose selecionam somente as credenciais/IDs Discord previstas pelo ADR e `AUTO_SYNC_COMMANDS`; secrets Cloudflare/OAuth não entram no ambiente carregado pelo bot e falhas permanentes não geram restart local infinito. O startup do bot não monta nem sincroniza o R2. O alias `#bot/*`, compartilhado por `package.json`, `tsconfig.json`, `jsconfig.json` e `vitest.config.ts`, evita caminhos relativos transversais, resolve para source nos testes e para o código compilado em produção. O `infra/docker/bot.Dockerfile` é multi-stage, usa Node 22.14.0, instala pelo lockfile, remove as dependências classificadas somente para desenvolvimento e executa como usuário não-root. Não há `squarecloud.app` versionado: o bot é configurado no painel da Square com 512 MB e `npm run build:bot && npm run start:bot:production`, preservando configuração independente para o futuro site. Como a Square instala somente dependências de produção antes desse build, `typescript` e `@types/node` permanecem em `dependencies`; isso também os conserva no runtime Docker enquanto ambos os destinos compartilharem o mesmo manifesto.

## Segurança e validação

Gitleaks local/CI usa configuração versionada e v8.30.1 (binário local ou imagem Docker). O workflow de qualidade executa instalação pelo lockfile, typecheck, 216 testes em 17 arquivos e build do bot. Os testes cobrem configuração, allowlist de ambiente, catálogo/adapters de commands, política de acesso e consistência do gate slash, estados de interaction, identidade, logger, manifesto de túnel, deployments, limpeza de mensagens, permissões efetivas, cliente R2, sincronização de emojis e o núcleo de importação de emojis (validação, processamento, downloader, serviço com fila e adapter do Discord); não há teste de integração Discord real.

A refatoração de limpeza (setembro 2026) removeu aliases R2 mortos, adicionou `r2:info`, renomeou a skill de infraestrutura para `docker-squarecloud-developer`, reorganizou o `.env.example` em seções obrigatória/opcional/reservada, consolidou a documentação R2 com descrições fiéis ao código, corrigiu a interpolação do scanner Docker para WSL e adicionou comandos `bash` no README. As decisões de evolução econômica e credenciais duplas foram preservadas como registradas.

A limpeza DRY consolidou as operações Cloudflare em `scripts/r2/client.mjs`, usado pelo CLI, ponte WebDAV e sincronizador de emojis. A configuração R2 usa `dotenv` com precedência de `process.env` em objeto isolado; o sincronizador não inicia montagem local. A listagem do CLI processa páginas sem acumular o bucket inteiro, e a remoção de emojis excedentes começa somente depois dos uploads e da paginação completa.

**Validação da limpeza DRY (21 de setembro de 2026):** typecheck, 145 testes em 12 arquivos, build limpo do bot, sintaxe dos scripts R2 e `git diff --check` aprovados. APIs Discord/Cloudflare foram simuladas nos testes, sem executar sincronização ou exclusão remota.

**Validação da política de acesso (22 de setembro de 2026):** typecheck, 155 testes em 12 arquivos e build do bot aprovados. Como correção adjacente, as apresentações `clear_*` ausentes no `terminalFormatter.ts` foram incluídas para fechar quatro falhas pré-existentes de `logger.test.ts`; nenhum teste usa token Discord real.

**Validação do núcleo de importação de emojis (22 de setembro de 2026):** typecheck, 216 testes em 17 arquivos e build do bot aprovados. Foram adicionadas as dependências `sharp` (processamento de imagem) e `gifenc` (redução de quadros de GIF, tipada em `apps/bot/src/types/gifenc.d.ts`); nenhum teste usa rede nem token Discord real — downloads e chamadas do Discord são simulados. Comandos, permissões e configurações permanecem fora do escopo, conforme [Importação de emojis](emoji-import.md).

**Validações desta refatoração (20 de setembro de 2026):** typecheck, 68 testes em nove arquivos e build do bot aprovados; sintaxe dos scripts shell aprovada; Compose validado com credenciais fictícias para ambos os perfis, sem iniciar containers; links relativos e referências ao identificador antigo da skill examinados. A execução do scanner Docker (`npm run security:secrets:docker`) foi bloqueada por falta de permissão de acesso ao socket `/var/run/docker.sock`; o scanner não chegou a executar e a montagem do repositório no container não foi validada. Instalação equivalente à Square e tentativa anterior de build Docker são registros históricos desta validação; não foram repetidas nesta refatoração.

## Riscos e decisões em aberto

- Credenciais duplas no mesmo ambiente ampliam o blast radius; manter seleção explícita, sem fallback, e rotação imediata após exposição.
- Deploy global e deploy por guilda da equipe são implementados; o conjunto de equipe (escopo `dev-guild`, pasta `commands/dev/`) contém `dev`, e o global contém `ping`, `clear` e `emoji`.
- O shutdown é limitado e não há endpoint de health dedicado para o bot.
- A direção futura está decidida como Square Cloud Hobby para `bot`/`site` e dois projetos Supabase Free isolados para development/production, o site ainda não está implementado, e a primeira persistência Supabase está descrita em [Acesso do bot](bot-access.md); consulte o [ADR](../decisions/square-cloud-supabase.md).
- O bucket R2 é a origem operacional das imagens; o backup externo e a futura troca de `r2.dev` por domínio próprio são responsabilidades operacionais registradas no [ADR de assets](../decisions/cloudflare-r2-assets.md).

## Cloudflare Tunnel e configuração compartilhada

`packages/config` expõe `@kuruttina/config`, consumido pelo bot e pelo launcher de túnel. `APP_ENV` substitui `BOT_TARGET`, que passa a ser rejeitado. A origem web padrão é `http://localhost:3666`; o site continua inexistente e o bot continua sem servidor HTTP.

Em 12/09/2026 foram recriados `kuruttina-development` e `kuruttina-production` na conta correta, com CNAMEs para `kuruttina.dev.athosmontarroyos.com` e `kuruttina.athosmontarroyos.com`, ambos roteados para `http://localhost:3666`. Permanecem inativos até iniciar seus connectors. O bucket R2 `kurrutina-bot-pictures` foi recriado, recebeu os 135 arquivos do backup e expõe provisoriamente `https://pub-271b6233fa924c46b0aa8664e8587f3f.r2.dev`. Inventário: [Cloudflare Tunnel](cloudflare-tunnel.md).

**Histórico de validações anteriores (consolidação de 13 de setembro de 2026):** typecheck, build do bot e 58 testes em oito arquivos aprovados; instalação limpa com `npm ci --omit=dev` compilou o bot e confirmou disponibilidade de `typescript` e `@types/node` no ambiente equivalente ao instalador da Square; seleção de variáveis e manifesto dos dois túneis aprovados; Compose renderizado com allowlist esperada; contrato de engine validado com Node 26.7.0 local e Node 24.15.0 observado na Square; tentativa de build Docker bloqueada por daemon indisponível. A instalação equivalente à Square e a tentativa de build da imagem Docker não foram repetidas nesta refatoração. Os resultados das verificações atuais estão registrados na seção "Segurança e validação".


## Persistência e equipe (23/09/2026)

packages/database centraliza pg, configuração TLS, pool de três conexões, migrations,
cadastro inicial e consultas sob RLS. O runtime usa somente DATABASE_URL do ambiente
ativo; credenciais administrativas são exclusivas dos scripts de release.
Creator inclui Dev, com checagem de guilda e permissões Discord em slash/prefixo.
As definições concretas são ping e clear (globais), emoji (global, gerência de
emojis do servidor) e dev (guilda da equipe, Application Emojis do bot).
Startup exige banco configurado;
shutdown drena comandos e fecha conexões com timeout. Configuração operacional,
projetos Supabase, IDs e verificações estão em [Acesso do bot](bot-access.md).

**Importação de emojis (23/09/2026):** um único `createEmojiImportService` (fila,
limites, downloader do CDN e adapter Discord) é composto no `bootstrap.ts` e
injetado no dispatcher, que resolve a rota `dev → emoji → add` (`dev-emoji-add`)
ou `emoji → add` (`emoji-add`) antes de autorizar. O núcleo recusa origem
ausente, tamanho declarado acima do limite e nome de arquivo inapropriado antes
de qualquer download; `docs/project/emoji-import.md` registra contratos e códigos.

Validação da importação de emojis: typecheck, 330 testes unitários e build do bot aprovados.

**Validação da reorganização dos comandos de equipe (23 de setembro de 2026):** `dev` movido de `mod/devEmoji.ts` para `commands/dev/`; o loader exige `dev/` ⇔ `dev-guild` ⇔ `staff` e o payload global nunca recebe a pasta `dev/`. Typecheck, 335 testes unitários e build do bot aprovados.

Validação da persistência: 258 testes unitários e sete testes de integração PostgreSQL, typecheck e build aprovados. Instalação de produção equivalente à Square e Compose validados. IDs cadastrados e consultas reais de runtime verificadas nos dois projetos Supabase, com TLS/CA e privilégios mínimos; Security Advisors sem alertas. .env local configurado e ignorado pelo Git. Container Docker não executado por permissão do socket.
