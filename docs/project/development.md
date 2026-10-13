# Desenvolvimento e operação

Referência técnica para mantenedores autorizados do KuruttinaBot. A apresentação do produto fica no [README](../../README.md); os contratos implementados estão no [estado atual](current-state.md) e no [ADR de hospedagem](../decisions/square-cloud-supabase.md).

## Execução do bot

O pacote declara suporte a Node 22.14+/24/26. Instale as dependências com `npm ci`. Copie `.env.example` para `.env`, configure `APP_ENV`, os dois pares `DISCORD_BOT_TOKEN_*`/`DISCORD_BOT_ID_*` e a URL/CA PostgreSQL do ambiente ativo. O arquivo `.env` não é versionado.

| Comando | Uso |
| --- | --- |
| `npm run dev` | Bot local com o `APP_ENV` do `.env`. |
| `npm run build` | Limpa `dist` e compila o bot. |
| `npm start` | Executa o build compilado. |
| `npm run typecheck` | Verifica tipos. |
| `npm test` | Testes herméticos. |
| `npm run test:database` | Integração com PostgreSQL descartável; exige `initdb` e `pg_ctl` de uma instalação nativa do PostgreSQL. |
| `npm run deploy:commands` | Publica o catálogo do bot ativo nos escopos global e da equipe. |
| `npm run database:migrate -- development` | Migration única do ambiente escolhido; `production` é alternativa explícita. |
| `npm run database:seed -- development` | Cadastro inicial do ambiente escolhido. |
| `npm run security:secrets` | Gitleaks local, se instalado. |

Os testes de banco criam um cluster isolado no diretório temporário do sistema, acessível somente por TCP em `127.0.0.1`, e o removem ao terminar. Instale PostgreSQL localmente e disponibilize sua pasta de binários no `PATH`; quando `pg_config` estiver disponível, ele localiza os demais binários. Não é necessário um serviço PostgreSQL já iniciado, WSL ou um shell Unix. `npm test` executa apenas os testes herméticos. A integração não lê `.env` nem usa os projetos Supabase.

O bot exige **Message Content Intent** no Developer Portal para os comandos de prefixo `k!`/`K!`. `AUTO_SYNC_COMMANDS=false` é o padrão; `true` publica os conjuntos uma vez por startup, antes do Gateway. Migrations usam credenciais de release próprias e não fazem parte do startup.

O único [manifesto Square Cloud](../../squarecloud.app) executa atualmente o bot com `npm run build && npm start`; configure `APP_ENV=production` e os secrets do runtime no painel da plataforma. PostgreSQL continua no Supabase conforme o contrato operacional documentado. O plano anterior de executar o futuro site como outro processo da mesma aplicação está em revisão, junto com a stack, no [replanejamento](replanning.md). Os comandos desta referência permanecem válidos; nenhuma migração foi realizada por essa revisão documental.

## Operações de desenvolvimento

Não há serviço de automação local ou remoto incluído no projeto. Ferramentas aposentadas de R2, espelhamento de emojis e Cloudflare Tunnel constam no [registro](tooling-retirement.md); os IDs e rotas históricas dos túneis estão no [inventário](cloudflare-tunnel.md).

As regras para agentes começam em [AGENTS.md](../../AGENTS.md); leia somente os documentos de domínio necessários à tarefa. Arquivos novos do bot seguem a [organização dos arquivos](bot-file-organization.md).
