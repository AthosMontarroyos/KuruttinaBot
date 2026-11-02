# Desenvolvimento e operação

Referência técnica para mantenedores autorizados do KuruttinaBot. A apresentação do produto fica no [README](../../README.md); os contratos implementados estão no [estado atual](current-state.md) e no [ADR de hospedagem](../decisions/vps-kinghost.md). O procedimento de contêineres, migration e publicação está na [referência de deployment](../../.claude/skills/project-operations/references/deployment.md). A publicação depois que a qualidade passa em `main` está em [Publicação](deploy.md).

## Modos de execução

O pacote declara suporte local a Node 22.14+/24/26. A VPS, as imagens e o CI usam Node 24; dependências e lockfile são validados nessa linha, inclusive módulos nativos como `sharp`. A execução nativa no Windows continua disponível.

| Modo | Ambiente | Porta do site | Configuração |
| --- | --- | --- | --- |
| Nativo (`npm run dev`, `npm run bot dev`, `npm run site dev`) | `development` definido pelo comando | `PORT`, padrão `3666` | `doppler run` com o config `dev` |
| Docker development | `development` fixo | `3667` | Segredos sem sufixo do config `dev`, pelo Compose |
| Docker production | `production` fixo | `3666` | Segredos sem sufixo do config `prd`, pelo Compose |

O bot não escuta HTTP. `APP_ENV`, `HOST`, `SITE_URL` e a porta do site são fixos no Compose e não ficam no Doppler. A seleção de variáveis de cada serviço está na referência de deployment.

No modo nativo, instale as dependências com `npm ci`. Os segredos vêm do Doppler, configs `dev` e `prd`, com os mesmos nomes: `ASSETS_BASE_URL`, `DATABASE_CA`, `DATABASE_URL`, `SITE_DATABASE_URL`, `DATABASE_MIGRATION_URL`, `DISCORD_BOT_ID`, `DISCORD_BOT_TOKEN`, `DISCORD_CLIENT_SECRET` e `DISCORD_PUBLIC_KEY`. `DATABASE_URL` é a credencial de runtime do bot, role `kuruttina_bot`. `SITE_DATABASE_URL` é a credencial de runtime do site, role `kuruttina_site`; os configs `dev` e `prd` precisam desse nome. O Compose entrega `SITE_DATABASE_URL` como `DATABASE_URL` só no serviço `site`, junto com `DATABASE_CA`. O bot não recebe `SITE_DATABASE_URL`. `npm run site dev` não chama o Doppler: o preload `@kuruttina/config/site-development` copia `SITE_DATABASE_URL` para `DATABASE_URL` quando o valor está presente, para o processo não ficar com a credencial do bot injetada pelo `doppler run` pai. O DevMock existe só com `APP_ENV=development` e lê o usuário ativo de papel `dev` pela função `bot_private.active_dev_user_id()`. Os dois Composes entregam `DISCORD_BOT_TOKEN` ao serviço `site` (no desenvolvimento, também para o DevMock listar os servidores do bot em que esse usuário é membro; nos dois, para listar os canais de um servidor), conforme a [decisão](../decisions/site-holds-bot-token.md); também entregam `DISCORD_BOT_ID` e `DISCORD_CLIENT_SECRET` ao `site` (OAuth do login) e não entregam `OWNER_ID`. O `compose.yaml` de produção não habilita o DevMock. `OWNER_ID` não é lido e pode sair do config Doppler `dev`. O código não escolhe o nome pelo sufixo de `APP_ENV`. Application Emojis de production seguem [Emojis de produção](emojis-prod.md).

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

`scripts/run.mjs` descobre cada diretório de `apps/` que tem `package.json` e executa o script do modo pedido. O diretório de trabalho é a raiz do repositório. `dev`, `build`, `start` e `test` não listam as apps: uma pasta nova entra nesses quatro comandos quando o `package.json` dela define o modo. `build` e `test` rodam uma app por vez, em ordem alfabética, e param na primeira falha. `dev` e `start` sobem todas ao mesmo tempo, prefixam cada linha com o nome da app e encerram as outras se uma termina com código diferente de zero. Uma saída zero não encerra as demais.

`npm run bot dev` existe porque o pacote raiz declara o script `bot` e o npm encaminha o argumento `dev`. O mesmo vale para `site`. Não há um nome genérico no npm para uma app que ainda não foi declarada; `npm run <nome> <modo>` precisa de uma linha `"<nome>": "node scripts/run.mjs <nome>"`. Essas apps não são workspaces. A instalação e o lockfile continuam na raiz, e o runner coloca `node_modules/.bin` da raiz no `PATH`.

| Comando | Uso |
| --- | --- |
| `doppler run --only-secrets DISCORD_BOT_TOKEN,DISCORD_BOT_ID,DATABASE_URL,DATABASE_CA -- npm run bot dev` | Bot local em development. O config Doppler é `dev`; o comando fixa `APP_ENV`. Não sobe a Home. |
| `doppler run --only-secrets ASSETS_BASE_URL,SITE_DATABASE_URL,DATABASE_CA,DISCORD_BOT_TOKEN -- npm run site dev` | Home local. O preload troca `DATABASE_URL` pela credencial do site e não chama o Doppler. |
| `npm run dev` | Sobe todas as apps ao mesmo tempo. O processo precisa das variáveis de cada uma; se uma termina com erro, as outras são encerradas. |
| `npm run build` | Compila todas as apps, em sequência, e para na primeira falha. |
| `npm run bot build` | Limpa `dist/apps/bot` e compila o bot. |
| `npm run site build` | Regenera o catálogo de commands do site (`packages/command-catalog/catalog.js`), limpa somente o destino do site, gera o bundle e compila o servidor. |
| `npm run bot start` | Fora do Docker, executa `node dist/apps/bot/src/index.js`; exige `APP_ENV` explícito. O contêiner chama esse Node diretamente. |
| `npm run site start` | Fora do Docker, executa `node dist/apps/site/index.js`; exige `APP_ENV` explícito. Em production, exige também `SITE_URL`. O contêiner chama esse Node diretamente. |
| `npm run start` | Sobe o build de todas as apps ao mesmo tempo; exige `APP_ENV` explícito. Os contêineres não usam este comando. |
| `npm run typecheck` | Regenera o catálogo de commands e verifica tipos do bot e do site. |
| `npm test` | Testes herméticos de todas as apps, na mesma cobertura de `vitest` sem `tests/database.integration.test.ts`. |
| `npm run test:database` | Integração com PostgreSQL descartável; exige `initdb` e `pg_ctl` de uma instalação nativa do PostgreSQL. |
| `npm run deploy:commands` | Publica sempre o catálogo no escopo global e em cada guilda de desenvolvimento cadastrada; exige `APP_ENV` explícito no processo, ou execução pelo Compose. O startup do bot já sincroniza por diferença, então este comando só é necessário para forçar. Sem guildas cadastradas, não há publicação de guilda. `50001` e `10004` numa guilda de equipe são aviso e não interrompem as demais. |
| `doppler run --only-secrets DATABASE_MIGRATION_URL,DATABASE_CA -- npm run database:migrate -- development` | Migration única. O config Doppler precisa ser o do argumento; `production` é a alternativa explícita. Valor vazio não substitui a URL de runtime. |
| `doppler run --only-secrets DATABASE_MIGRATION_URL,DATABASE_CA -- npm run database:seed -- development` | Cadastro inicial do ambiente escolhido, no mesmo config Doppler. |
| `npm run security:secrets` | Gitleaks local, se instalado. |

Os testes de banco criam um cluster isolado no diretório temporário do sistema, acessível somente por TCP em `127.0.0.1`, e o removem ao terminar. Instale PostgreSQL localmente e disponibilize sua pasta de binários no `PATH`; quando `pg_config` estiver disponível, ele localiza os demais binários. Não é necessário um serviço PostgreSQL já iniciado, WSL ou um shell Unix. `npm test` executa o `test` de cada app, em sequência, e para na primeira falha. A união desses filtros é a suíte hermética anterior: tudo o que o Vitest encontra, exceto `tests/database.integration.test.ts`. O script do bot fica com o restante, inclusive packages e workflows, para um arquivo novo não sumir da suíte. O script do site lista os testes da Home. A integração não lê `.env` nem usa os projetos Supabase.

O bot exige **Message Content Intent** no Developer Portal para os comandos de prefixo `k!`/`K!`, e **Server Members Intent** para as mensagens de entrada e saída de membros (eventos `GuildMemberAdd` e `GuildMemberRemove`). Todo startup do bot compara os conjuntos de commands com o Discord, antes do Gateway, e publica só se algum foi adicionado, editado ou removido; não há variável para desligar. Migrations usam credenciais de release próprias e não fazem parte do startup. O comando manual `deploy:commands` está na referência de deployment.

Produção no repositório é o `compose.yaml`. Os segredos do config Doppler `prd` entram pelo `doppler run` do usuário `deploy`, e cada serviço declara só as suas variáveis. As unidades em `ops/systemd/` são o runtime anterior e ainda citam a conta `kuruttina` e `/etc/kuruttina/`; essa citação não é pré-requisito do Docker. PostgreSQL continua no Supabase. A publicação depois que a qualidade passa em `main` está em [Publicação](deploy.md). A máquina não foi verificada nesta atualização. O [replanejamento](replanning.md) registra o histórico dessa escolha.

## Operações de desenvolvimento

A Home local em `apps/site` é uma interface React com Tailwind, servida pelo processo Node do site. `npm run site dev` gera o bundle e inicia esse processo; build e execução separados usam `npm run site build` e `npm run site start`. No modo nativo, `ASSETS_BASE_URL`, `SITE_DATABASE_URL` e `DATABASE_CA` vêm do Doppler. `npm run site dev` não chama o Doppler; o preload `@kuruttina/config/site-development` copia `SITE_DATABASE_URL` para `DATABASE_URL` (role `kuruttina_site`) antes de ler a configuração. `PORT` continua opcional no processo, com padrão `3666`. O DevMock liga só em development e usa o dev ativo do banco, não `OWNER_ID`. `npm run bot dev` carrega `@kuruttina/config/development` e `npm run site dev` carrega `@kuruttina/config/site-development` antes do app, fixando `APP_ENV=development`, inclusive se houver um valor herdado diferente. `npm run dev` sobe todas as apps juntas. Sem `SITE_URL`, o site de development calcula `http://localhost:<PORT>`; um override explícito continua validado. Produção recebe a URL pública pelo Compose. Em desenvolvimento nativo, `SITE_URL` é `http://localhost:3666` e a página abre em `http://127.0.0.1:3666`. No Compose de desenvolvimento, a página publicada no host abre em `http://127.0.0.1:3667`. Em produção, `SITE_URL` é `https://kuruttina.athosmontarroyos.com`. Veja [Home local](site.md) para escuta, `HOST` e fluxo de edição.

A publicação do checkout está em [Publicação](deploy.md). A Home de produção continua publicada por `cloudflared` com configuração remota; os launchers locais continuam aposentados no [registro](tooling-retirement.md). O estado conferido do túnel está no [inventário](cloudflare-tunnel.md).

As regras para agentes começam em [CLAUDE.md](../../.claude/CLAUDE.md); selecione a skill pelo contexto e leia apenas as referências necessárias à tarefa. Arquivos novos do bot seguem a [organização dos arquivos](bot-file-organization.md).
