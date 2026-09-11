# Deployment, operação e performance

> Leia este documento somente quando a tarefa envolver este domínio. As regras mantêm os níveis e a semântica do AGENTS.md original.

## 3. Serviços e execução

### Regra: topologia local

**Nível:** MUST

**Regra:** `docker compose up` deve poder iniciar PostgreSQL, bot e site com rede interna, variáveis documentadas e dependências verificadas por readiness. O banco usa volume persistente nomeado; código-fonte montado como volume é opção apenas do perfil de desenvolvimento.

**Motivo:** torna o ambiente reproduzível e diferencia persistência de build.

### Regra: topologia Railway

**Nível:** SHOULD

**Regra:** Implante inicialmente três serviços separados: um processo `site`, um processo `bot` e PostgreSQL gerenciado pela Railway. Não agrupe bot e site no mesmo container e não divida módulos internos em novos serviços sem métricas ou requisito de isolamento.

**Motivo:** mantém isolamento de falhas e deploy independente sem custo de microsserviços desnecessários.

**Exceções:** um plano Railway comprovadamente mais econômico pode agrupar processos apenas após medir memória, garantir supervisão/sinais e documentar o acoplamento de deploy.

### Regra: migrations em produção

**Nível:** MUST

**Regra:** Execute migrations uma única vez em etapa de pre-deploy/release com lock ou mecanismo equivalente. Não rode migrations concorrentes em cada réplica e não aceite alteração destrutiva sem estratégia de compatibilidade/rollback.

**Motivo:** evita corrida, indisponibilidade e schema parcialmente aplicado.

## 4. Orçamento de recursos

O limite arquitetural é aproximadamente 500 MB de RAM. Enquanto o limite exato por serviço/plano não estiver registrado, trate 500 MB como teto por processo implantável e também acompanhe o consumo agregado que afeta custo. Se PostgreSQL compartilhar o mesmo limite, ele entra no cálculo.

### Regra: margem contra OOM

**Nível:** MUST

**Regra:** Nenhum serviço deve ser projetado para ocupar permanentemente o teto. Mire uso estável de no máximo 70% do limite aplicável e picos observados abaixo de 90%, reservando o restante para runtime, GC e rajadas. Mudanças que cruzem esses limiares exigem medição, perfil e plano de redução antes de produção.

**Motivo:** OOM mata processos sem encerramento confiável.

**Exceções:** limiares podem ser ajustados após registrar medições representativas, configuração Railway e margem equivalente.

### Regra: processamento limitado

**Nível:** MUST

**Regra:** Toda coleção, fila, cache, batch, retry, collector, timer e operação concorrente de longa duração possui limite e política de expiração/backpressure. Não carregue tabela inteira nem arquivo grande em memória quando paginação, cursor, streaming ou batches pequenos resolvem.

**Motivo:** impede crescimento não limitado e picos multiplicativos.

### Regra: avaliação de feature pesada

**Nível:** MUST

**Regra:** Antes de implementar feature que adiciona worker, fila, cache, upload, processamento de imagem, dataset grande ou dependência pesada, estime RAM, CPU, concorrência, conexões, payload máximo e comportamento de falha. Registre medição antes/depois quando o impacto puder ser relevante.

**Motivo:** recursos são parte do contrato de produção.

### Regra: concorrência e event loop

**Nível:** SHOULD

**Regra:** Defina limites explícitos por workload, processe batches pequenos e nunca use `Promise.all` sobre entrada não limitada. Trabalho CPU-bound ou longo não deve bloquear requests nem eventos do bot; mova-o para job controlado somente quando houver necessidade comprovada.

**Exceções:** coleções pequenas com limite estrutural documentado podem usar execução paralela direta.

### Regra: caches

**Nível:** SHOULD

**Regra:** Prefira cache externo ou cache local pequeno com tamanho máximo, TTL e métrica de hit/miss. Não use objeto global como fonte de verdade; invalide por evento/versão quando consistência importar.

**Motivo:** cache local desaparece no restart e diverge entre processos/shards.

### Regra: processos e workers

**Nível:** SHOULD

**Regra:** Comece com um processo por serviço, sem cluster ou worker extra. Adicione concorrência somente após medir gargalo e recalcular memória e conexões PostgreSQL.

## 5. Docker e Compose

### Regra: builds reproduzíveis e mínimos

**Nível:** MUST

**Regra:** Cada app implantável usa Dockerfile multi-stage, versão major/minor de Node fixada, instalação pelo lockfile e estágio final com apenas artefatos e dependências de produção. Execute como usuário não-root. O build deve falhar se o lockfile estiver inconsistente.

**Motivo:** reduz imagem, superfície de ataque e variação entre ambientes.

### Regra: contexto e `.dockerignore`

**Nível:** MUST

**Regra:** O contexto pode ser a raiz para permitir packages do monorepo, mas `.dockerignore` exclui no mínimo `.git`, `node_modules`, outputs, caches, coverage, logs, `.env*` não exemplares, uploads e assets-fonte não usados. Nunca dependa de copiar segredo no build.

**Motivo:** contexto grande aumenta tempo, cache miss e risco de vazamento.

### Regra: cache de camadas

**Nível:** SHOULD

**Regra:** Copie manifests/lockfile antes do código, instale dependências em camada cacheável e use pruning/foco do workspace quando suportado. Meça tamanho comprimido e descompactado da imagem ao alterar dependências ou base.

### Regra: sinais e encerramento

**Nível:** MUST

**Regra:** O processo da aplicação deve ser PID 1 via `exec`, receber `SIGTERM`/`SIGINT`, parar de aceitar trabalho, encerrar collectors/jobs, aguardar operações com timeout e fechar pool/conexões. Não use shell wrapper que absorva sinais.

### Regra: health e readiness

**Nível:** SHOULD

**Regra:** Site expõe endpoint HTTP leve de liveness e, se necessário, readiness que verifica dependências com timeout curto. O bot só expõe endpoint quando a plataforma exigir; caso contrário reporte readiness de forma leve. Health check não executa query cara nem vaza configuração.

### Regra: Compose por ambiente

**Nível:** SHOULD

**Regra:** Compose base contém definições comuns; overrides/profiles de desenvolvimento adicionam bind mounts e comandos dev. Produção não usa hot reload, bind mount de código ou banco publicado para a internet.

### Regra: persistência, redes e restart

**Nível:** MUST

**Regra:** Só PostgreSQL e storages explicitamente duráveis usam volumes. Serviços conversam por rede privada e nomes DNS internos; exponha ao host apenas portas necessárias. Em produção, use política de restart limitada/da plataforma, nunca loop que oculte erro de configuração.

### Regra: configuração no runtime

**Nível:** MUST

**Regra:** Injete configuração e secrets no runtime por variáveis/secret store Railway. Valide schema no startup, falhe cedo com mensagem sem valor secreto e mantenha `.env.example` apenas com nomes e exemplos inofensivos.

### Regra: configuração local compartilhada

**Nível:** MUST

**Regra:** No desenvolvimento local, mantenha um único `.env` global na raiz do monorepo como fonte de configuração para `packages/database`, `apps/bot` e `apps/site`; os apps não devem manter arquivos `.env` locais divergentes. O `.env` nunca é versionado, cada processo valida apenas as variáveis que consome no startup, e produção/Railway usa variáveis ou secret store em runtime.

## 11. APIs, erros, observabilidade e resiliência

### Regra: contratos HTTP

**Nível:** SHOULD

**Regra:** Documente método, autenticação, schema, códigos, paginação, idempotência e limite de payload para cada API. Versione mudança incompatível ou faça rollout compatível entre produtores e consumidores.

### Regra: logs estruturados

**Nível:** MUST

**Regra:** Em produção emita JSON estruturado para stdout/stderr com timestamp, nível, serviço, evento e correlation/request/job ID. Não grave arquivo local. Redija secrets, cookies, tokens, headers de autorização, string de conexão e dados pessoais desnecessários.

### Regra: níveis e volume

**Nível:** SHOULD

**Regra:** `error` exige ação/falha, `warn` indica degradação, `info` cobre eventos de ciclo/negócio relevantes e `debug` fica desativado por padrão em produção. Não logue cada linha/objeto de batch nem heartbeat frequente.

### Regra: timeouts e retries

**Nível:** MUST

**Regra:** Toda chamada externa e aquisição de recurso possui timeout. Retry somente falhas transitórias e operações idempotentes, com máximo de tentativas, exponential backoff e jitter; respeite `Retry-After`. Não retry erros de validação/autorização.

### Regra: degradação controlada

**Nível:** SHOULD

**Regra:** Falha de dependência deve produzir erro claro e limitado, sem fila em memória crescente. Circuit breaker só é introduzido se métricas demonstrarem cascata; prefira inicialmente timeout, limite de concorrência e backoff.

### Regra: métricas leves

**Nível:** SHOULD

**Regra:** Acompanhe RSS/heap, event-loop lag, reinícios/OOM, latência/erros, pool ativo/em espera, queries lentas, fila e cache. Use recursos nativos/Railway ou endpoint leve; não adicione stack de observabilidade pesada sem orçamento.

## 13. Dependências e performance

### Regra: nova dependência

**Nível:** SHOULD

**Regra:** Antes de adicionar pacote, verifique capacidade nativa/existente, manutenção, licença, advisories, footprint instalado/runtime, tree-shaking, compatibilidade e impacto no Docker. Registre a razão em PR/commit quando não for óbvia.

**Exceções:** bibliotecas críticas de segurança são escolhidas pela correção e manutenção, não apenas pelo tamanho.

### Regra: performance mensurável

**Nível:** SHOULD

**Regra:** Otimize a partir de orçamento, query plan, profile ou métrica. Primeiro reduza dados, round trips, N+1, serialização, cópias e concorrência; não introduza arquitetura complexa para ganho hipotético.

### Regra: payloads

**Nível:** MUST

**Regra:** Defina limite de entrada e saída. Listagens paginam, exports usam streaming/batches e respostas omitem campos desnecessários. Comprima na borda quando apropriado sem manter buffers duplicados.
