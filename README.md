# KuruttinaBot

Monorepo com bot Discord, configuração e acesso PostgreSQL compartilhados. O site ainda será implementado. O bot atual usa Node 22.14+/24/26, `discord.js` 14.27.0 e Supabase com ambientes development/production isolados. O [estado implementado](docs/project/current-state.md) e o [ADR de hospedagem](docs/decisions/square-cloud-supabase.md) trazem os contratos.

## Executar o bot

No Linux/WSL, instale Node compatível e as dependências com `npm ci`. Copie `.env.example` para `.env`, configure `APP_ENV`, os dois pares `DISCORD_BOT_TOKEN_*`/`DISCORD_BOT_ID_*` e a URL/CA PostgreSQL do ambiente ativo. O arquivo `.env` não é versionado.

| Comando | Uso |
| --- | --- |
| `npm run dev` | Bot local com o `APP_ENV` do `.env`. |
| `npm run build` | Limpa `dist` e compila o bot. |
| `npm start` | Executa o build compilado. |
| `npm run typecheck` | Verifica tipos. |
| `npm test` | Testes herméticos. |
| `npm run test:database` | Integração com PostgreSQL descartável; exige `initdb` e `pg_ctl`. |
| `npm run deploy:commands` | Publica o catálogo do bot ativo nos escopos global e da equipe. |
| `npm run database:migrate -- development` | Migration única do ambiente escolhido; `production` é alternativa explícita. |
| `npm run database:seed -- development` | Cadastro inicial do ambiente escolhido. |
| `npm run security:secrets` | Gitleaks local, se instalado. |

O bot exige **Message Content Intent** no Developer Portal para os comandos de prefixo `k!`/`K!`. `AUTO_SYNC_COMMANDS=false` é o padrão; `true` publica os conjuntos uma vez por startup, antes do Gateway. Migrations usam credenciais de release próprias e não fazem parte do startup.

O único [manifesto Square Cloud](squarecloud.app) executa atualmente o bot com `npm run build && npm start`; configure `APP_ENV=production` e os secrets do runtime no painel da plataforma. O futuro site será outro processo da mesma aplicação após existir código executável e medição de memória. PostgreSQL continua no Supabase.

## Operações de desenvolvimento

O [n8n isolado](infra/n8n/README.md) tem pacote e lockfile próprios e não integra o deploy do produto. Ele ainda não executa fluxos. As ferramentas anteriores de R2, espelhamento de emojis e Cloudflare Tunnel foram retiradas; suas entradas, efeitos e substitutos planejados estão no [catálogo de migração](docs/project/n8n-migration.md). Os IDs e rotas históricas dos túneis estão no [inventário](docs/project/cloudflare-tunnel.md).

As regras para agentes começam em [AGENTS.md](AGENTS.md); leia somente os documentos de domínio necessários à tarefa.
