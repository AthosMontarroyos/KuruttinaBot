# Desenvolvimento e operação

Referência técnica para mantenedores autorizados do KuruttinaBot. A apresentação do produto fica no [README](../../README.md); os contratos implementados estão no [estado atual](current-state.md) e no [ADR de hospedagem](../decisions/vps-kinghost.md). O procedimento de contêineres, migration e publicação está na [referência de deployment](../../.claude/skills/project-operations/references/deployment.md). A publicação depois que a qualidade passa em `main` está em [Publicação](deploy.md).

## Modos de execução

O pacote declara suporte local a Node 22.14+/24/26. A VPS, as imagens e o CI usam Node 24; dependências e lockfile são validados nessa linha, inclusive módulos nativos como `sharp`. A execução nativa no Windows continua disponível.

| Modo | Ambiente | Porta do site | Configuração |
| --- | --- | --- | --- |
| Nativo (`dev`/`site:dev`) | `development` definido pelo comando | `PORT`, padrão `3666` | `doppler run` com o config `dev` |
| Docker development | `development` fixo | `3667` | Segredos sem sufixo do config `dev`, pelo Compose |
| Docker production | `production` fixo | `3666` | Segredos sem sufixo do config `prd`, pelo Compose |

O bot não escuta HTTP. `APP_ENV`, `HOST`, `SITE_URL` e a porta do site são fixos no Compose e não ficam no Doppler. A seleção de variáveis de cada serviço está na referência de deployment.

No modo nativo, instale as dependências com `npm ci`. Os segredos vêm do Doppler, configs `dev` e `prd`, com os mesmos nomes: `ASSETS_BASE_URL`, `DATABASE_CA`, `DATABASE_URL`, `DATABASE_MIGRATION_URL`, `DISCORD_BOT_ID`, `DISCORD_BOT_TOKEN`, `DISCORD_CLIENT_SECRET` e `DISCORD_PUBLIC_KEY`. O código não escolhe o nome pelo sufixo de `APP_ENV`. Application Emojis de production seguem [Emojis de produção](emojis-prod.md).

```text
doppler login
doppler setup
```

No `doppler setup`, escolha o config `dev`. Em seguida:

```text
doppler run -- docker compose -f compose.dev.yaml up
```

Esses comandos são a origem dos segredos. Eles vêm do Doppler e não entram nas imagens.

O Compose de desenvolvimento é `compose.dev.yaml`, independente de `compose.yaml`. Ele não funciona como override de produção, não oferece hot reload e não inclui serviço de migration. Suba e encerre com:

```text
doppler run -- docker compose -f compose.dev.yaml up --build -d
doppler run -- docker compose -f compose.dev.yaml down
```

Depois de alterar o código, rode de novo o `up --build`. O ambiente foi construído e iniciado no Docker Desktop, com bot pronto e Home respondendo na porta 3667. A publicação na VPS não foi confirmada.

## Comandos

| Comando | Uso |
| --- | --- |
| `doppler run --only-secrets DISCORD_BOT_TOKEN,DISCORD_BOT_ID,DATABASE_URL,DATABASE_CA -- npm run dev` | Bot local em development. O config Doppler é `dev`; o comando fixa `APP_ENV`. |
| `npm run build` | Limpa `dist/apps/bot` e compila o bot. |
| `npm run build:all` | Compila o bot e a Home. |
| `npm start` | Executa o build compilado do bot; exige `APP_ENV` explícito no ambiente do processo. |
| `npm run typecheck` | Verifica tipos. |
| `npm test` | Testes herméticos. |
| `npm run test:database` | Integração com PostgreSQL descartável; exige `initdb` e `pg_ctl` de uma instalação nativa do PostgreSQL. |
| `npm run deploy:commands` | Publica o catálogo nos escopos global e da equipe; exige `APP_ENV` explícito no processo, ou execução pelo Compose. |
| `doppler run --only-secrets DATABASE_MIGRATION_URL,DATABASE_CA -- npm run database:migrate -- development` | Migration única. O config Doppler precisa ser o do argumento; `production` é a alternativa explícita. Valor vazio não substitui a URL de runtime. |
| `doppler run --only-secrets DATABASE_MIGRATION_URL,DATABASE_CA -- npm run database:seed -- development` | Cadastro inicial do ambiente escolhido, no mesmo config Doppler. |
| `npm run security:secrets` | Gitleaks local, se instalado. |

Os testes de banco criam um cluster isolado no diretório temporário do sistema, acessível somente por TCP em `127.0.0.1`, e o removem ao terminar. Instale PostgreSQL localmente e disponibilize sua pasta de binários no `PATH`; quando `pg_config` estiver disponível, ele localiza os demais binários. Não é necessário um serviço PostgreSQL já iniciado, WSL ou um shell Unix. `npm test` executa apenas os testes herméticos. A integração não lê `.env` nem usa os projetos Supabase.

O bot exige **Message Content Intent** no Developer Portal para os comandos de prefixo `k!`/`K!`. `AUTO_SYNC_COMMANDS=false` é o padrão; `true` publica os conjuntos uma vez por startup, antes do Gateway. Migrations usam credenciais de release próprias e não fazem parte do startup. Pelo Compose, essa operação existe somente em `compose.yaml`; o comando está na referência de deployment.

Produção no repositório é o `compose.yaml`. Os segredos do config Doppler `prd` entram pelo `doppler run` do usuário `deploy`, e cada serviço declara só as suas variáveis. As unidades em `ops/systemd/` são o runtime anterior e ainda citam a conta `kuruttina` e `/etc/kuruttina/`; essa citação não é pré-requisito do Docker. PostgreSQL continua no Supabase. A publicação depois que a qualidade passa em `main` está em [Publicação](deploy.md). A máquina não foi verificada nesta atualização. O [replanejamento](replanning.md) registra o histórico dessa escolha.

## Operações de desenvolvimento

A Home local em `apps/site` é uma interface React com Tailwind, servida pelo processo Node do site. `npm run site:dev` gera o bundle e inicia esse processo; build e execução separados usam `npm run site:build` e `npm run site:start`. No modo nativo, `ASSETS_BASE_URL` vem do Doppler; `PORT` continua opcional no processo, com padrão `3666`. `npm run dev` e `npm run site:dev` carregam `@kuruttina/config/development` antes do app, fixando `APP_ENV=development`, inclusive se houver um valor herdado diferente. Sem `SITE_URL`, o site de development calcula `http://localhost:<PORT>`; um override explícito continua validado. Produção recebe a URL pública pelo Compose. Em desenvolvimento nativo, `SITE_URL` é `http://localhost:3666` e a página abre em `http://127.0.0.1:3666`. No Compose de desenvolvimento, a página publicada no host abre em `http://127.0.0.1:3667`. Em produção, `SITE_URL` é `https://kuruttina.athosmontarroyos.com`. Veja [Home local](site.md) para escuta, `HOST` e fluxo de edição.

A publicação do checkout está em [Publicação](deploy.md). A Home de produção continua publicada por `cloudflared` com configuração remota; os launchers locais continuam aposentados no [registro](tooling-retirement.md). O estado conferido do túnel está no [inventário](cloudflare-tunnel.md).

As regras para agentes começam em [CLAUDE.md](../../.claude/CLAUDE.md); selecione a skill pelo contexto e leia apenas as referências necessárias à tarefa. Arquivos novos do bot seguem a [organização dos arquivos](bot-file-organization.md).
