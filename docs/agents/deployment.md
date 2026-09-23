# Deploy e operação

Leia este documento para mudanças de runtime, Square Cloud, n8n ou operação. O estado implementado está em [Estado atual](../project/current-state.md); a decisão de topologia está no [ADR](../decisions/square-cloud-supabase.md).

## Topologia

**MUST:** O monorepo possui uma aplicação Square Cloud e um `squarecloud.app` na raiz. Hoje ela executa somente o bot. Quando houver site executável, bot e site serão processos distintos dentro da mesma aplicação, com inicialização, propagação de sinais e encerramento coordenados. Só o site escuta a porta HTTP; bot e site compartilham infraestrutura, não memória autoritativa. A implementação do site exige medição de recursos e revisão do manifesto antes de deploy. O n8n é uma aplicação separada, exclusiva da equipe de desenvolvimento, sem dependência do produto.

**MUST:** `APP_ENV=development|production` seleciona o ambiente explicitamente, sem fallback. O `.env` local único na raiz fornece configuração para bot, banco e futuro site; cada processo lê apenas suas chaves. A Square e o CI recebem secrets em variáveis protegidas. Credenciais administrativas de banco, R2 e n8n não entram no runtime do produto. Nunca versione `.env`, dumps ou credenciais.

**MUST:** Instalação usa lockfile. A Square instala dependências de produção antes do comando `START`; ferramentas necessárias ao build na plataforma continuam em `dependencies`. Não suprima aviso `EBADENGINE` sem validar a linha do Node. Build limpo deve falhar diante de lockfile inconsistente. Não há Docker/Compose como caminho de execução.

## Persistência e recursos

**MUST:** Supabase Free mantém projetos distintos para development e production. Testes e staging usam PostgreSQL descartável local/CI. Migration ocorre uma vez por release, com lock e credencial administrativa exclusiva; não roda em cada réplica nem no startup. Alterações destrutivas exigem compatibilidade e recuperação planejadas. Não migrar para outro banco como fallback implícito.

**MUST:** Meça RAM agregada dos processos da aplicação. Use estável até 70% da memória contratada e picos abaixo de 90%; acima disso, registre perfil e plano de redução antes de produção. Toda fila, cache, coleção, retry e concorrência longa tem limite. Trabalho CPU pesado não bloqueia requests nem eventos Discord.

**MUST:** Cada processo valida configuração no startup, usa stdout/stderr sem secrets e encerra com timeout após `SIGTERM`/`SIGINT`. Quando houver site, ofereça liveness HTTP leve; readiness não faz query cara. O bot atual informa readiness em log. A exceção aprovada para logs humanos do bot está no [ADR](../decisions/human-readable-bot-logs.md).

**MUST:** Chamadas externas e aquisição de recursos têm timeout. Retry só para falhas transitórias e operações idempotentes, limitado e com backoff; respeite `Retry-After`. Endpoints definem autenticação, limites de payload, códigos e idempotência. Listagens paginam e exports usam batches/streaming.

## n8n de desenvolvimento

A [base isolada](../../infra/n8n/README.md) deriva do projeto oficial da Square Cloud; as operações futuras estão [inventariadas](../project/n8n-migration.md). **MUST:** Credenciais ficam na instância n8n, isoladas do produto. Antes de ativar fluxo, verifique autenticação individual, persistência do banco e da chave de criptografia, backup/restauração e isolamento dos ambientes. Workflows que alteram R2, Discord ou banco exigem alvo explícito, autorização, limite de concorrência, registro de resultado e teste em development.
