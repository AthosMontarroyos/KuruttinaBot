# Deploy e operação

Leia este documento para runtime, VPS, túnel, Compose ou release. A decisão está no [ADR](../../../../docs/decisions/vps-kinghost.md). Os modos e a origem das variáveis estão em [desenvolvimento](../../../../docs/project/development.md). O que já existe no checkout e o que ainda não foi verificado na máquina estão no [estado atual](../../../../docs/project/current-state.md). O [ADR Square Cloud](../../../../docs/decisions/square-cloud-supabase.md) é histórico.

A publicação de produção está em `.github/workflows/deploy.yml` e a publicação manual de comandos em `.github/workflows/publish-commands.yml`. O resumo para mantenedores está em [publicação](../../../../docs/project/deploy.md). Esta referência não autoriza disparar esses workflows sem pedido explícito. Não reintroduza `squarecloud.app`, launchers locais de túnel, Prometheus, exporters, healthchecks novos nem infraestrutura de logs. O `/healthz` existente e o stdout/stderr da aplicação continuam o comportamento atual.

## Modos

**MUST:** Há três modos. Nativo usa `npm run dev` ou `npm run site:dev`, que fixam `APP_ENV=development` pelo preload `@kuruttina/config/development`, a porta `PORT` com padrão `3666` e o `.env` da raiz. Entrypoints genéricos como `npm start`, `site:start` e `deploy:commands` continuam exigindo ambiente explícito no processo. Docker development usa `compose.dev.yaml`, com `APP_ENV=development` e porta `3667`. Docker production usa `compose.yaml`, com `APP_ENV=production`, porta `3666` e interpolação do mesmo `.env` da raiz. O bot não possui porta HTTP. Os valores de `APP_ENV`, `HOST` e porta escritos no bloco `environment` de um serviço Compose prevalecem sobre os mesmos nomes no `.env`.

## Topologia

**MUST:** Produção é uma VPS Ubuntu 24.04 na KingHost. Bot e Home são processos Node separados, empacotados para o painel externo construir as imagens a partir do checkout. As unidades em `ops/systemd/` são o runtime legado até essa troca. Só a Home escuta HTTP. Em produção o contêiner escuta em `0.0.0.0` e o host publica `127.0.0.1:3666`, com `/healthz`. O bot não depende do túnel. `cloudflared` permanece no host, com configuração gerenciada na Cloudflare, e publica `kuruttina.athosmontarroyos.com` em `http://127.0.0.1:3666`. A porta HTTP não fica acessível de fora da máquina.

**MUST:** Há no máximo uma instância de cada aplicação Discord. O contêiner de produção do bot tem nome fixo `kuruttina-bot`; o de desenvolvimento tem nome fixo `kuruttina-bot-dev`. Pare o processo que já usa a mesma aplicação antes de iniciar outro. A troca aceita uma breve interrupção; não prometa deploy sem downtime.

**MUST:** Node 24 é a linha do CI e a base `node:24-bookworm-slim` das imagens. O `Dockerfile` tem alvos finais `bot`, `site` e `release`. Instalação e build acontecem na preparação da imagem, com `npm ci` e o lockfile, inclusive `sharp`. Não transporte `node_modules` do Windows. Os entrypoints são `node dist/apps/bot/src/index.js` e `node dist/apps/site/index.js`. A CLI de banco é `node packages/database/cli.js`, só no alvo `release`. O desenvolvimento nativo continua disponível no Windows, nas versões de `engines`.

**MUST:** `compose.yaml` tem nome de projeto `kuruttina` e serviços `bot`, `site` e `migrate`. As imagens são construídas do checkout, sem registry obrigatório. `bot` e `site` usam `init`, reinício `unless-stopped` e 15s para encerrar; não dependem um do outro. O bot não publica portas. `migrate` usa o profile `release`, não reinicia e não sobe com os serviços permanentes. Não há volume de aplicação, montagem de código, socket Docker, healthcheck, limite de CPU/RAM nem driver de log próprio. stdout/stderr permanecem os do processo.

**MUST:** A Home sem `HOST`, ou com `HOST` em branco, escuta `127.0.0.1`. Os serviços `site` de produção e de desenvolvimento definem `HOST=0.0.0.0`. Produção publica somente `127.0.0.1:3666:3666` e fixa `PORT=3666`. Desenvolvimento publica somente `127.0.0.1:3667:3667` e fixa `PORT=3667`. `SITE_URL` é a origem pública e não é o endereço de escuta. Produção fixa `SITE_URL=https://kuruttina.athosmontarroyos.com` no Compose; no nativo development, a ausência de `SITE_URL` deriva `http://localhost:<PORT>`. Não derivar a origem pública de headers HTTP ou do bind `0.0.0.0`.

## Desenvolvimento em contêiner

`compose.dev.yaml` é o projeto `kuruttina-dev`. É independente de `compose.yaml` e não funciona como override dele. Não monta o código-fonte, não oferece hot reload e não tem serviço de migration. Depois de mudar o código, reconstrua:

```text
docker compose -f compose.dev.yaml up --build -d
docker compose -f compose.dev.yaml down
```

**MUST:** O Compose lê o `.env` da raiz para interpolar somente as chaves listadas em cada serviço. O site recebe `ASSETS_BASE_URL` e fixa `APP_ENV=development`, `HOST=0.0.0.0`, `PORT=3667` e `SITE_URL=http://localhost:3667`. O bot fixa `APP_ENV=development` e `AUTO_SYNC_COMMANDS=false`, e recebe `DISCORD_BOT_TOKEN_DEVELOPMENT`, `DISCORD_BOT_ID_DEVELOPMENT`, `DATABASE_URL_DEVELOPMENT` e `DATABASE_CA_CERT_DEVELOPMENT`. Não recebe o par Discord de production. Credenciais administrativas, token do túnel, banco de production e segredos OAuth ficam de fora. Alterar no `.env` um valor que o serviço define explicitamente não muda o contêiner.

## Configuração

O `.env` local e o `.env.example` não repetem `APP_ENV`, `PORT`, `HOST`, `SITE_URL` ou `AUTO_SYNC_COMMANDS`: os Composes definem esses controles. No nativo, os comandos de desenvolvimento selecionam o ambiente, o site usa porta padrão 3666 e a sincronização fica desativada por padrão. Preserve credenciais ao limpar esses arquivos; overrides nativos continuam possíveis no ambiente do processo.

**MUST:** `APP_ENV=development|production` é explícito, sem fallback. O `.env` da raiz é a única origem de credenciais para o modo nativo e para os dois Composes. Ele fica fora do Git, do contexto de build e das imagens: não é copiado nem montado. O Compose o lê só para interpolar as chaves declaradas em cada serviço. Nenhum contêiner recebe o arquivo inteiro.

**MUST:** Em produção, o serviço `bot` recebe os dois pares `DISCORD_BOT_TOKEN_*`/`DISCORD_BOT_ID_*` exigidos pelo contrato atual, `DATABASE_URL_PRODUCTION` e `DATABASE_CA_CERT_PRODUCTION`. O Compose fixa `APP_ENV=production` e `AUTO_SYNC_COMMANDS=false`. O serviço `site` recebe somente `ASSETS_BASE_URL`, além de `APP_ENV=production`, `AUTO_SYNC_COMMANDS=false`, `HOST=0.0.0.0`, `PORT=3666` e `SITE_URL=https://kuruttina.athosmontarroyos.com`. O serviço `migrate` recebe somente `DATABASE_MIGRATION_URL_PRODUCTION` e `DATABASE_CA_CERT_PRODUCTION`.

**MUST:** `DATABASE_MIGRATION_URL_PRODUCTION` pode permanecer vazio enquanto não houver migration. A validação existente rejeita essa ausência e não usa `DATABASE_URL_PRODUCTION` no lugar. Isso impede apenas o serviço `migrate`. Token do túnel, client secrets, chaves públicas e a credencial administrativa não entram em `bot` nem em `site`. O CA do banco continua sendo o PEM da variável de ambiente; não há arquivo de CA para montar. Credenciais não entram em argumento de build nem na imagem. `process.env` continua prevalecendo sobre um `.env` eventual dentro do processo. Nunca versione `.env`, dumps ou credenciais.

**MUST:** No Linux, restrinja o `.env` da raiz ao proprietário que realiza o deploy, por exemplo com modo `0600`. Conta, grupo ou diretório dedicados não são pré-requisito. Não crie usuário `kuruttina` nem arquivos em `/etc/kuruttina/` para o Compose. Se esses caminhos já existirem na VPS, esta mudança não os apaga.

**MUST:** Os alvos da imagem executam com o usuário não administrativo `node`, já presente em `node:24-bookworm-slim`. Os arquivos da aplicação permanecem legíveis e percorríveis, sem escrita para esse usuário. Em production, `AUTO_SYNC_COMMANDS=false`. Publicar comandos fica fora do startup.

## Migration e comandos

**MUST:** O serviço `migrate` existe somente em `compose.yaml`. A migration de produção roda por acionamento explícito, depois da construção e antes de subir os contêineres permanentes:

```text
docker compose --profile release run --rm migrate
```

Esse comando executa `node packages/database/cli.js migrate production`. Não roda no build, no startup permanente nem em `compose.dev.yaml`. No modo nativo, a migration continua `npm run database:migrate -- development` ou `production`, como em [desenvolvimento](../../../../docs/project/development.md).

**MUST:** Publicar comandos continua manual, com a imagem do bot e sem depender dos outros serviços:

```text
docker compose run --rm --no-deps bot node dist/apps/bot/src/deployments/deploy-central.js
```

## Releases

**MUST:** O checkout usado pelo painel é a origem do build. Construa as imagens antes de interromper bot e site. Falha nessa preparação não para os serviços atuais. As unidades legadas e o release em `/opt/kuruttina/releases/<commit>` permanecem disponíveis para recuperação até a troca ser aceita.

**MUST:** Prepare a imagem em Linux, com Node 24, `npm ci` e o lockfile. Inclua dependências nativas como `sharp`. Não copie `node_modules` do Windows. Rode as verificações do repositório antes de ativar.

**MUST:** Migrations necessárias rodam uma vez, com `DATABASE_MIGRATION_URL_PRODUCTION` do `.env`, entregue somente ao serviço `migrate`, pelo comando da seção anterior. Não rodam de novo no restart. Mudança de banco incompatível com o código anterior exige procedimento próprio: voltar às unidades legadas não desfaz migrations.

**MUST:** Um push em `main` cujo workflow Quality termina com `success` dispara `deploy.yml` por `workflow_run`. O job só publica quando a conclusão é `success` e o evento de origem é `push`. O commit é `github.event.workflow_run.head_sha`: 40 caracteres hexadecimais, em checkout destacado, alcançável a partir de `origin/main` depois do fetch. Esse caminho não repete a qualidade. A execução manual usa `workflow_dispatch` com a entrada `ref` (tag ou SHA completo) e, antes de publicar, reutiliza `quality.yml` por `workflow_call` nessa ref. A publicação automática não troca o checkout por um ancestral que ele já contém; o rollback manual continua podendo informar um SHA anterior. A publicação por GitHub Release fica para o lançamento da primeira versão. O job de deploy usa o ambiente GitHub `production`, com concorrência `deploy-production` e sem cancelar a execução em andamento. O acesso à VPS usa somente `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY` e `VPS_KNOWN_HOSTS`, gravados no GitHub e nunca no repositório. A chave privada vai para um arquivo temporário com modo `0600`. `VPS_KNOWN_HOSTS` é gravado em `~/.ssh/known_hosts` e a conexão exige `StrictHostKeyChecking=yes`. Segredo vazio falha o job, sem imprimir o valor. O checkout remoto é `/home/deploy/Projects/KuruttinaBot` e precisa conseguir buscar `origin/main` e as tags. A VPS precisa de `git`, `curl` e `docker compose`.

**MUST:** Nesse checkout, o workflow grava o commit atual, executa `git fetch --tags --prune origin` e faz `git checkout --detach` do commit resolvido. `docker compose build` constrói `bot` e `site`. O serviço `migrate` fica de fora porque usa o profile `release`. Falha nessa construção restaura o commit anterior e não altera os contêineres em execução. Se `DATABASE_MIGRATION_URL_PRODUCTION` no `.env` da raiz tiver valor, o workflow constrói a imagem com `docker compose --profile release build migrate` e executa `docker compose --profile release run --rm migrate`. Valor vazio ou ausente apenas registra a omissão. Não há seed. Falha na imagem ou na migration restaura o commit, reconstrói as imagens anteriores e não recria os contêineres. Em seguida sobe `bot` e `site`. A ativação espera até 120s pelo log `Bot pronto` em `docker compose logs bot` e por HTTP 200 em `https://kuruttina.athosmontarroyos.com/healthz`. Depois dessa confirmação, `docker image prune -f` remove imagens não utilizadas; falha nessa limpeza não falha o job. Falha ao subir ou nessa espera restaura o commit anterior, reconstrói as imagens e sobe `bot` e `site` de novo. O job termina em falha. Essa restauração não desfaz migrations. Um `Bot pronto` já presente nos logs do contêiner atual satisfaz a espera quando o contêiner não é recriado.

**MUST:** Publicar comandos continua fora do startup e fora do workflow de deploy. `publish-commands.yml` é só manual, no mesmo ambiente e na mesma concorrência, e executa `docker compose run --rm --no-deps bot node dist/apps/bot/src/deployments/deploy-central.js` no checkout da VPS. O resumo do job de deploy registra a ref e o commit publicados. Esta automação não mede RAM nem registra a VPS como ativada.

**MUST:** Application Emojis de production entram só por `emoji-prod.yml`, manual, no ambiente `production`, com concorrência `emoji-prod`. O segredo é `DISCORD_PROD_BOT_TOKEN`, exclusivo desse ambiente. O job não apaga nem substitui emoji. O procedimento para mantenedores está em [Emojis de produção](../../../../docs/project/emojis-prod.md). Esta referência não autoriza disparar esse workflow sem pedido explícito. O `compose.yaml` de production continua entregando `DISCORD_BOT_TOKEN_PRODUCTION` do `.env` da VPS; isso não se confunde com o segredo do workflow.

**MUST:** Para ativar pelo painel, quando isso for pedido fora desses workflows: disponibilize o checkout, o `.env` da raiz e o `compose.yaml`; execute a migration explícita e espere sucesso; pare `kuruttina-bot` e `kuruttina-site`; inicie os contêineres de bot e site. O túnel permanece no ar. Valide o log `Bot pronto`, e pelo domínio público `/healthz`, a página e um asset. Se essa primeira ativação falhar, pare os contêineres antes de reativar as unidades legadas. Isso não desfaz migrations. Só depois da validação manual desabilite o startup dessas unidades. Esta referência não registra essa ativação como concluída.

## Runtime legado: systemd

As unidades em `ops/systemd/` descrevem o runtime anterior. Não as instale como caminho padrão enquanto o Compose for o contrato de execução, nem prepare usuário, diretório ou arquivos para o Docker. `User`/`Group=kuruttina` e `EnvironmentFile=/etc/kuruttina/*.env` permanecem só nessas unidades legadas. Elas sobem no boot, reiniciam após falha com `StartLimitIntervalSec=120` e `StartLimitBurst=5`, registram stdout/stderr no journal e encerram por `SIGTERM` com `TimeoutStopSec=15s`. O timeout interno dos processos é 5s; a folga da unidade cobre o término antes do `SIGKILL`. Bot e Home não se exigem mutuamente. Nenhum dos dois exige `cloudflared`. Conferir boot, restart após falha e shutdown faz parte da aceitação na VPS; essa conferência ainda não foi feita.

## Túnel

**MUST:** Use o conector remoto da Cloudflare, não um launcher deste repositório. A origem de `kuruttina.athosmontarroyos.com` em `kuruttina-production` (`b1460ee3-03f7-49e7-a35c-12d6a6f07ba7`) é `http://127.0.0.1:3666`, seguida da regra `http_status:404`. Antes de iniciar um conector, confira de novo as conexões e o DNS. Não publique esse hostname pelo túnel de development. O estado conferido está no [inventário](../../../../docs/project/cloudflare-tunnel.md).

## Persistência e recursos

**MUST:** Supabase mantém projetos distintos para development e production. Testes usam PostgreSQL descartável. Credencial administrativa não entra no runtime permanente. Não migrar para outro banco como fallback implícito. R2 permanece a origem de assets; o bucket não é baixado para o repositório.

**MUST:** Meça a RAM agregada de bot, Home e `cloudflared` antes de considerar a publicação concluída. Use estável até 70% da memória contratada e picos abaixo de 90%; acima disso, registre perfil e plano de redução. Toda fila, cache, coleção, retry e concorrência longa tem limite. Trabalho CPU pesado não bloqueia requests nem eventos Discord. RAM e logs no painel ADM, assim como a API externa de tokens, continuam intenções futuras e não têm integração neste repositório.

**MUST:** Cada processo valida configuração no startup, usa stdout/stderr sem secrets e encerra com timeout após `SIGTERM`/`SIGINT`. `/healthz` é liveness leve. Readiness do bot é o log `Bot pronto`. A exceção de logs humanos está no [ADR](../../../../docs/decisions/human-readable-bot-logs.md). Nos contêineres esses fluxos continuam em stdout/stderr. O journal é o destino das unidades `systemd` legadas.

**MUST:** Chamadas externas e aquisição de recursos têm timeout. Retry só para falhas transitórias e operações idempotentes, limitado e com backoff; respeite `Retry-After`. Endpoints definem autenticação, limites de payload, códigos e idempotência. Listagens paginam e exports usam batches/streaming.

**MUST:** Antes de tratar a publicação como concluída, confira que tokens e URLs com senha não aparecem em release, bundle, imagem, unidade ou journal.
