# KuruttinaBot

Consulte o [estado atual do projeto](docs/project/current-state.md) e as [decisões registradas](docs/decisions/dual-bot-credentials.md) antes de alterar configuração, deploy ou credenciais.

## Bot local/Docker

Copie `.env.example` para `.env`, preencha os dois tokens e IDs correspondentes. O alvo é escolhido estritamente por `BOT_TARGET`; `npm start`/`npm run dev` usam o valor do ambiente. Para executar explicitamente: `npm run build && npm run start:development` ou `npm run start:production` (os equivalentes de desenvolvimento são `npm run dev:development` e `npm run dev:production`).

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
