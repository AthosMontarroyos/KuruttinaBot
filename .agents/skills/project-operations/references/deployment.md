# Deploy e operação

Leia este documento para runtime, VPS, túnel ou release. A decisão está no [ADR](../../../../docs/decisions/vps-kinghost.md). O que já existe no checkout e o que ainda não foi verificado na máquina estão no [estado atual](../../../../docs/project/current-state.md). O [ADR Square Cloud](../../../../docs/decisions/square-cloud-supabase.md) é histórico.

Não há pipeline de deploy no repositório. A automação futura segue o contrato abaixo; esta referência não autoriza publicar sozinha. Não reintroduza `squarecloud.app`, Docker/Compose nem os launchers locais de túnel.

## Topologia

**MUST:** Produção é uma VPS Ubuntu 24.04 na KingHost. Bot e Home são serviços `systemd` separados, definidos em `ops/systemd/`. Só a Home escuta HTTP, em `127.0.0.1:3666`, com `/healthz`. O bot não depende do túnel. `cloudflared` é outro serviço, com configuração gerenciada na Cloudflare, e publica `kuruttina.athosmontarroyos.com` nesse endereço. A porta HTTP não fica acessível de fora da máquina.

**MUST:** Há no máximo uma instância do bot. O restart para a unidade antiga por completo antes de iniciar a nova. A troca aceita uma breve interrupção; não prometa deploy sem downtime.

**MUST:** Node 24 do sistema é `/usr/bin/node` na VPS e a linha do CI. Instalação e build acontecem na preparação do release, nunca no `ExecStart`. Os entrypoints são `dist/apps/bot/src/index.js` e `dist/apps/site/index.js`. Desenvolvimento local continua nativo no Windows, nas versões de `engines`.

**MUST:** Não há Docker/Compose como caminho de execução.

## Configuração

**MUST:** `APP_ENV=development|production` é explícito, sem fallback. O `.env` da raiz continua sendo só o contrato local e não entra no release. Na VPS, cada processo lê o próprio arquivo:

| Arquivo | Modo | Conteúdo |
| --- | --- | --- |
| `/etc/kuruttina/bot.env` | `0640`, `root:kuruttina` | Contrato atual do bot, inclusive as duas credenciais Discord, URL/CA do runtime e `AUTO_SYNC_COMMANDS`. |
| `/etc/kuruttina/site.env` | `0640`, `root:kuruttina` | Somente `APP_ENV`, `PORT` e `ASSETS_BASE_URL`. |
| `/etc/kuruttina/release.env` | `0600`, `root:root` | Credencial administrativa de migration. Fora dos processos Node. |

O diretório `/etc/kuruttina/` fica em `0750` e `root:kuruttina`. Token do túnel e credenciais administrativas não entram nos ambientes Node. `process.env` continua prevalecendo sobre um `.env` eventual; mesmo assim o release não contém `.env`. Nunca versione `.env`, dumps ou credenciais.

**MUST:** O usuário de serviço `kuruttina` não tem shell de login nem privilégio administrativo. O release é legível por ele e não é gravável. Em production, `AUTO_SYNC_COMMANDS=false`; publicar comandos continua sendo `npm run deploy:commands`, fora do startup.

## Releases

**MUST:** Versões imutáveis ficam em `/opt/kuruttina/releases/<commit>`. O link `/opt/kuruttina/current` aponta para a versão ativa. As unidades usam esse link e o Node do sistema. Preparação e ativação usam o lock `/var/lib/kuruttina/deploy.lock`, de raiz, para serializar publicações.

**MUST:** Prepare o release em Linux compatível com a VPS, com Node 24, `npm ci` e o lockfile. Inclua dependências nativas como `sharp`. Não copie `node_modules` do Windows. Rode as verificações do repositório antes de ativar. Falha nessa preparação não altera `current` nem reinicia os serviços.

**MUST:** Migrations necessárias rodam uma vez por release, com a credencial de `release.env`, depois da preparação e antes da troca de `current`. Não rodam de novo no restart. Mudança de banco incompatível com o código anterior não usa o rollback de release como recuperação; exige procedimento próprio.

**MUST:** Para ativar: pare `kuruttina-bot` e `kuruttina-site`, troque `current`, inicie os dois. O túnel permanece no ar. Valide em seguida o serviço ativo, o log `Bot pronto` da nova inicialização, e pelo domínio público `/healthz`, a página e um asset. Se a validação falhar, aponte `current` para o release anterior e reinicie os serviços Node. Isso não desfaz migrations.

## systemd

**MUST:** Instale as unidades do repositório em `/etc/systemd/system/`, sem segredos no texto. Elas sobem no boot, reiniciam após falha com `StartLimitIntervalSec=120` e `StartLimitBurst=5`, registram stdout/stderr no journal e encerram por `SIGTERM` com `TimeoutStopSec=15s`. O timeout interno dos processos é 5s; a folga da unidade cobre o término antes do `SIGKILL`.

**MUST:** Bot e Home não se exigem mutuamente. Nenhum dos dois exige `cloudflared`. Conferir boot, restart após falha e shutdown faz parte da aceitação na VPS; essa conferência ainda não foi feita.

## Túnel

**MUST:** Use o conector remoto da Cloudflare, não um launcher deste repositório. Antes da ativação, confira túnel, DNS e conectores. Reutilize `kuruttina-production` (`b1460ee3-03f7-49e7-a35c-12d6a6f07ba7`) se o hostname `kuruttina.athosmontarroyos.com` apontar para `http://127.0.0.1:3666` e não houver conector antigo levando tráfego a outra origem. Caso contrário, crie o substituto e atualize o [inventário](../../../../docs/project/cloudflare-tunnel.md). O túnel de development inventariado não publica esse hostname.

## Persistência e recursos

**MUST:** Supabase mantém projetos distintos para development e production. Testes usam PostgreSQL descartável. Credencial administrativa não entra no runtime. Não migrar para outro banco como fallback implícito. R2 permanece a origem de assets; o bucket não é baixado para o repositório.

**MUST:** Meça a RAM agregada de bot, Home e `cloudflared` antes de considerar a publicação concluída. Use estável até 70% da memória contratada e picos abaixo de 90%; acima disso, registre perfil e plano de redução. Toda fila, cache, coleção, retry e concorrência longa tem limite. Trabalho CPU pesado não bloqueia requests nem eventos Discord.

**MUST:** Cada processo valida configuração no startup, usa stdout/stderr sem secrets e encerra com timeout após `SIGTERM`/`SIGINT`. `/healthz` é liveness leve. Readiness do bot é o log `Bot pronto`. A exceção de logs humanos está no [ADR](../../../../docs/decisions/human-readable-bot-logs.md); na VPS esses fluxos vão para o journal.

**MUST:** Chamadas externas e aquisição de recursos têm timeout. Retry só para falhas transitórias e operações idempotentes, limitado e com backoff; respeite `Retry-After`. Endpoints definem autenticação, limites de payload, códigos e idempotência. Listagens paginam e exports usam batches/streaming.

**MUST:** Antes de tratar a publicação como concluída, confira que tokens e URLs com senha não aparecem em release, bundle, unidade ou journal.
