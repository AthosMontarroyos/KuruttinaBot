# KuruttinaBot

Consulte o [estado atual do projeto](docs/project/current-state.md) e as [decisões registradas](docs/decisions/dual-bot-credentials.md) antes de alterar configuração, deploy ou credenciais.

## Início rápido (Linux/WSL)

1. Use Node.js 22 a partir de 22.14.0, Node.js 24 ou Node.js 26, conforme `engines.node`.
2. Instale dependências:
   ```bash
   npm ci
   ```
3. Copie e preencha o `.env`:
   ```bash
   cp .env.example .env
   ```
   Preencha os dois pares `DISCORD_BOT_TOKEN_*`/`DISCORD_BOT_ID_*` e defina `APP_ENV`.
   O contrato atual exige ambos os pares, independentemente do ambiente ativo.
4. Execute em desenvolvimento:
   ```bash
   npm run dev:development
   ```
   Ou, para produção: `npm run build && npm run start:production`.

O bot não monta nem sincroniza o bucket no startup e nenhum comando lê imagens do R2.
Cloudflare Tunnel, R2 e OAuth são opcionais — não são necessários para iniciar o bot.

## Bot local/Docker

Slash é o padrão. Todos os comandos do registry também respondem automaticamente aos prefixos fixos `k!` e `K!`: `/ping`, `k!ping` e `K!ping` usam o mesmo executor, inclusive em DM. Não existe comando ou variável para ativar/configurar prefixo. Os nomes dos comandos são exatos; mensagens de bots/webhooks/sistema e comandos desconhecidos são ignorados.

`/clear quantidade:20 usuario:@alguem` e `k!clear 20 @alguem` apagam mensagens elegíveis em canais de servidor. A quantidade vai de 1 a 200, o filtro de usuário é opcional e entradas inválidas são rejeitadas antes de buscar/apagar mensagens. As permissões efetivas do usuário e do bot são declaradas na política de acesso do comando e verificadas no canal antes de executar. Emojis personalizados indisponíveis são omitidos ou usam fallback Unicode, sem impedir a execução dos comandos.

`/emoji add` (ou `k!emoji-add` / `K!emoji-add`) adiciona um emoji ao servidor onde o comando foi executado; `/dev emoji add` (ou `k!dev-emoji-add`) adiciona um emoji aos Application Emojis do próprio bot. Os dois aceitam as mesmas entradas: uma imagem anexada (o nome do arquivo vira nome do emoji, e `nome` opcional sobrescreve) ou a referência de um emoji personalizado `<:nome:id>`/`<a:nome:id>` copiado de outro servidor. Ao menos uma origem é obrigatória; quando há arquivo e emoji, o arquivo tem prioridade, e múltiplos anexos ou argumentos excedentes são recusados antes de qualquer download.

O comando do servidor exige do membro a permissão de gerenciar emojis e do bot a de criar emojis, ambas conferidas no canal antes de importar. O comando `dev` é restrito à guilda cadastrada e a contas ativas como Dev ou Creator no banco — administrador do servidor não substitui esse cadastro — e é publicado somente naquela guilda, fora do conjunto global.

Habilite **Message Content Intent** em **Developer Portal → aplicação → Bot → Privileged Gateway Intents** para cada bot usado (development e production). O código solicita esse intent; sem autorização no portal, o Discord pode rejeitar o Gateway com código 4014. Aplicações verificadas podem precisar de aprovação do Discord. O bot precisa poder ver o canal e enviar respostas. O cache de mensagens fica desabilitado: o despacho usa somente a mensagem recebida.

O alvo é escolhido estritamente por `APP_ENV`; `npm start`/`npm run dev` usam o valor do ambiente. Para executar explicitamente: `npm run build && npm run start:development` ou `npm run start:production` (os equivalentes de desenvolvimento são `npm run dev:development` e `npm run dev:production`).

O bot não monta nem sincroniza o bucket no startup e nenhum comando consome imagens dele. A importação de emoji baixa apenas do CDN do Discord. Quando uma feature de mídia existir, ela receberá `ASSETS_BASE_URL` validada em sua composição e publicará somente URLs públicas, sem credenciais administrativas do R2. Os comandos `npm run r2:mount` e `npm run r2:unmount` são ferramentas de manutenção local do conteúdo em `R2/`. A desmontagem verifica se o PID do rclone está ativo, confere o executável e verifica o caminho da montagem na linha de comando antes de solicitar seu encerramento.

## Scripts de manutenção

Os scripts são agrupados por finalidade em `scripts/build/` (compilação e limpeza), `scripts/cloudflare/` (túneis), `scripts/r2/` (cliente compartilhado, CLI e montagem do bucket) e `scripts/discord/` (sincronização de emojis). Execute-os pelos comandos npm da raiz. `emoji:r2:sync` e `emoji:sync` transferem assets pelas APIs remotas, sem exigir montagem local; veja o [guia R2](scripts/r2/README.md).

## Aliases de importação

O alias `#bot/*` aponta para `apps/bot/src/*` durante desenvolvimento, typecheck e testes, e para `dist/apps/bot/src/*` no Node após o build. Ele está declarado em `tsconfig.json`, `jsconfig.json`, `vitest.config.ts` e no campo `imports` de `package.json`; os testes não dependem de `dist` preexistente. Use, por exemplo, `#bot/infrastructure/logger.js` em vez de atravessar vários diretórios com `../../`. Imports entre futuros workspaces devem continuar usando o nome público do package, sem criar aliases para internals.

No Docker Compose, use um perfil por vez: `docker compose --profile development up --build` ou `docker compose --profile production up --build`. Nenhum serviço de bot é iniciado sem um perfil explícito.

`AUTO_SYNC_COMMANDS=false` é o padrão seguro. String vazia ou qualquer valor diferente de `true`/`false` é rejeitado. Quando `true`, todos os deploys registrados são executados sequencialmente uma vez antes do login e da readiness. Uma falha interrompe o startup. Nunca versione `.env` ou tokens. Tanto a leitura local quanto o Compose selecionam somente a allowlist de variáveis consumidas pelo bot; tokens Cloudflare e futuros secrets OAuth não entram no ambiente carregado pelo bot.

Os deploys ficam em `apps/bot/src/deployments/`. O deploy central publica somente os comandos padrão globais do bot; deploys exclusivos de servidores terão entrypoints separados nessa mesma pasta.

Depois de preencher o `.env`, compile e execute o deploy central:

```bash
npm run build
npm run deploy:central
```

`npm run deploy:commands` permanece como alias do deploy central. O processo valida a identidade, substitui o conjunto global completo via `PUT` e não abre o Gateway.

Para adicionar um deploy exclusivo de servidor, implemente um novo `Deployment` e componha-o explicitamente ao construir `DeploymentsHandler`. O próximo startup com auto-sync ligado o executará junto com os demais.

## Verificação de segredos

O Gitleaks verifica o histórico completo em pushes e pull requests usando `.gitleaks.toml`. Para executar localmente com o binário Gitleaks instalado:

```bash
npm run security:secrets
```

Em Linux/WSL com Docker, sem instalar o binário:

```bash
npm run security:secrets:docker
```

Achados são redigidos na saída. Não adicione tokens reais a allowlists; se uma credencial for detectada, revogue-a e rotacione-a antes de limpar o histórico.

## Cloudflare Tunnel

O modo global agora é `APP_ENV`; remova `BOT_TARGET` também das variáveis protegidas de deploy. O `.env` local foi migrado preservando os demais valores. `PORT=3666` é o padrão da futura origem web. Confira o ambiente e o túnel com `npm run tunnel:check`.

Os dois túneis, seus CNAMEs e as rotas para `localhost:3666` foram criados na conta correta. Os connectors ficam inativos até serem iniciados e o site ainda não existe; consulte [configuração e estado dos túneis](docs/project/cloudflare-tunnel.md).

## Guilda de desenvolvimento e contas Creator/Dev

O bot agora exige conexão PostgreSQL do ambiente ativo pela role de leitura
kuruttina_bot. Consulte [cadastro, credenciais, migrations e publicação de comandos](docs/project/bot-access.md)
antes de iniciar ou atualizar o deploy. Os IDs ficam no banco; tokens e conexão ficam no ambiente.

Validação do banco: npm run test:database (PostgreSQL local descartável).
