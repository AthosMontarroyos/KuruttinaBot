# KuruttinaBot

Consulte o [estado atual do projeto](docs/project/current-state.md) e as [decisões registradas](docs/decisions/dual-bot-credentials.md) antes de alterar configuração, deploy ou credenciais.

## Bot local/Docker

Slash é o padrão. Todos os comandos do registry também respondem automaticamente aos prefixos fixos `k!` e `K!`: `/ping`, `k!ping` e `K!ping` usam o mesmo executor, inclusive em DM. Não existe comando ou variável para ativar/configurar prefixo. Os nomes dos comandos são exatos; mensagens de bots/webhooks/sistema e comandos desconhecidos são ignorados. O conjunto atual não possui argumentos.

Habilite **Message Content Intent** em **Developer Portal → aplicação → Bot → Privileged Gateway Intents** para cada bot usado (development e production). O código solicita esse intent; sem autorização no portal, o Discord pode rejeitar o Gateway com código 4014. Aplicações verificadas podem precisar de aprovação do Discord. O bot precisa poder ver o canal e enviar respostas. O cache de mensagens fica desabilitado: o despacho usa somente a mensagem recebida.

Copie `.env.example` para `.env`, preencha os dois tokens e IDs correspondentes. O alvo é escolhido estritamente por `APP_ENV`; `npm start`/`npm run dev` usam o valor do ambiente. Para executar explicitamente: `npm run build && npm run start:development` ou `npm run start:production` (os equivalentes de desenvolvimento são `npm run dev:development` e `npm run dev:production`).

O bot não monta nem sincroniza o bucket no startup. Em qualquer ambiente, ele publica as imagens pelas URLs montadas a partir de `ASSETS_BASE_URL`, sem credenciais administrativas do R2. Os comandos `npm run assets:mount` e `npm run assets:unmount` são ferramentas manuais exclusivas para manutenção local do conteúdo em `Pictures/`.

## Aliases de importação

O alias `#bot/*` aponta para `apps/bot/src/*` durante desenvolvimento e typecheck, e para `dist/apps/bot/src/*` no Node após o build. Ele está declarado em `tsconfig.json`, `jsconfig.json` e no campo `imports` de `package.json`; por isso funciona no editor, no `tsx` e no runtime ESM sem reescrita adicional. Use, por exemplo, `#bot/infrastructure/logger.js` em vez de atravessar vários diretórios com `../../`. Imports entre futuros workspaces devem continuar usando o nome público do package, sem criar aliases para internals.

No Docker Compose, use um perfil por vez: `docker compose --profile development up --build` ou `docker compose --profile production up --build`. Nenhum serviço de bot é iniciado sem um perfil explícito.

`AUTO_SYNC_COMMANDS=false` é o padrão seguro. Quando `true`, todos os deploys registrados são executados sequencialmente uma vez antes do login e da readiness. Uma falha interrompe o startup. Nunca versione `.env` ou tokens.

Os deploys ficam em `apps/bot/src/deployments/`. O deploy central publica somente os comandos padrão globais do bot; deploys exclusivos de servidores terão entrypoints separados nessa mesma pasta.

Depois de preencher o `.env`, compile e execute o deploy central:

```powershell
npm run build
npm run deploy:central
```

`npm run deploy:commands` permanece como alias do deploy central. O processo valida a identidade, substitui o conjunto global completo via `PUT` e não abre o Gateway.

Para adicionar um deploy exclusivo de servidor, implemente um novo `Deployment` e inclua-o no array `deployments` de `apps/bot/src/handlers/DeploymentsHandler.ts`. O próximo startup com auto-sync ligado o executará junto com os demais.

## Verificação de segredos

O Gitleaks verifica o histórico completo em pushes e pull requests usando `.gitleaks.toml`. Para executar localmente com o binário Gitleaks instalado:

```powershell
npm run security:secrets
```

No Windows com Docker Desktop, sem instalar o binário:

```powershell
npm run security:secrets:docker
```

Achados são redigidos na saída. Não adicione tokens reais a allowlists; se uma credencial for detectada, revogue-a e rotacione-a antes de limpar o histórico.

## Cloudflare Tunnel

O modo global agora é `APP_ENV`; remova `BOT_TARGET` também das variáveis protegidas de deploy. O `.env` local foi migrado preservando os demais valores. `PORT=3666` é o padrão da futura origem web. Confira o ambiente e o túnel com `npm run tunnel:check`.

Os dois túneis, seus CNAMEs e as rotas para `localhost:3666` foram criados na conta correta. Os connectors ficam inativos até serem iniciados e o site ainda não existe; consulte [configuração e estado dos túneis](docs/project/cloudflare-tunnel.md).
