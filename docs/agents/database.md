# PostgreSQL e acesso a dados

> Leia este documento somente quando a tarefa envolver este domínio. As regras mantêm os níveis e a semântica do AGENTS.md original.

## 6. PostgreSQL e `packages/database`

### Regra: projetos Supabase por ambiente

**Nível:** MUST

**Regra:** Use dois projetos Supabase distintos: um exclusivamente para development e outro exclusivamente para production. URLs, senhas, chaves, roles, dados e integrações não são compartilhados nem possuem fallback entre ambientes. Testes, CI e staging efêmero usam PostgreSQL local descartável e nunca apontam para production. O limite de dois projetos Free fica reservado a development e production.

**Motivo:** separa falhas, dados e credenciais sem consumir um terceiro projeto hospedado.

### Regra: Supabase como PostgreSQL server-side

**Nível:** MUST

**Regra:** A aplicação acessa o Supabase como PostgreSQL exclusivamente em código server-side pela API pública de `packages/database`. Schemas da aplicação não são expostos pela Data API a `anon` ou `authenticated`; revogue grants implícitos e remova schemas da lista de schemas expostos quando aplicável. Chaves publishable/`anon`, secret/`service_role` e APIs proprietárias não são introduzidas sem requisito explícito e revisão das fronteiras de autorização.

**Motivo:** evita uma segunda superfície pública e mantém autorização, migrations e portabilidade sob controle do projeto.

### Regra: acesso centralizado

**Nível:** MUST

**Regra:** Browser nunca acessa PostgreSQL. Site e bot chamam a API pública de `packages/database` em código server-side. Repositories/queries retornam modelos explícitos e selecionam somente colunas necessárias.

### Regra: queries seguras

**Nível:** MUST

**Regra:** Use queries parametrizadas ou query builder que parametrize valores. Identificadores dinâmicos vêm de allowlist; nunca concatene entrada em SQL. SQL arbitrário não será oferecido no dashboard.

### Regra: integridade no banco

**Nível:** MUST

**Regra:** Invariantes persistentes usam `NOT NULL`, `CHECK`, `UNIQUE`, foreign keys e tipos adequados. Índices acompanham foreign keys e padrões reais de filtro/ordenação; cada índice tem query justificadora.

**Motivo:** TypeScript e validação de request não protegem writers concorrentes.

### Regra: migrations versionadas

**Nível:** MUST

**Regra:** Toda mudança de schema, role, privilege, policy ou seed obrigatório é migration revisável, determinística e versionada. Migration aplicada não é editada; crie migration corretiva. Mudanças destrutivas usam expand/migrate/contract e plano de backup/restore quando aplicável.

### Regra: RLS deny-by-default

**Nível:** MUST

**Regra:** Considere RLS obrigatória para dados privados, por usuário, guild/servidor, organização, tenant ou nível de acesso. Habilite e force RLS quando compatível, crie policies específicas por operação e valide isolamento com testes negativos. Ausência de policy deve negar, não liberar.

**Motivo:** RLS é defesa adicional contra falha no código da aplicação.

**Exceções:** tabela pública, referência global ou estritamente interna pode dispensar RLS com justificativa no schema/migration e revisão de segurança.

### Regra: contexto de RLS

**Nível:** MUST

**Regra:** Identidade usada por policy deriva da sessão confiável no servidor e é aplicada no escopo de uma transação (`SET LOCAL` ou mecanismo equivalente), nunca de campo enviado pelo cliente. Limpe o contexto ao devolver conexão ao pool.

### Regra: privilégios mínimos

**Nível:** MUST

**Regra:** Separe role de migration/owner da role de runtime. Runtime não possui DDL, ownership, superuser, `BYPASSRLS`, `CREATEROLE`, `CREATEDB`, `TEMP` nem acesso a objetos desnecessários. Site e bot usam roles distintas quando suas capacidades diferirem. A credencial de migration existe apenas no job de release e nunca entra no ambiente dos processos site/bot.

No Supabase, não use a role `postgres`, senha owner, secret key ou `service_role` como credencial normal de `bot`/`site`. Mantenha secrets de cada projeto somente no ambiente correspondente da Square/CI e use credenciais distintas para runtime e migration.

### Regra: hardening de schema e funções

**Nível:** MUST

**Regra:** Migrations removem de `PUBLIC` privilégios implícitos não necessários, inclusive `CREATE` no schema `public`, e configuram `ALTER DEFAULT PRIVILEGES` para cada owner; runtime recebe grants explícitos. Objetos da aplicação ficam em schema não gravável pela role runtime, cujo `search_path` é fixo e contém somente schemas confiáveis, com `pg_catalog` primeiro. Função `SECURITY DEFINER` é excepcional: referências qualificadas, `search_path` seguro definido na própria função, owner sem login quando viável, `EXECUTE` revogado de `PUBLIC` e concedido apenas às roles necessárias.

**Motivo:** impede shadowing de objetos, execução pública acidental e escalada por defaults permissivos.

### Regra: pooling limitado

**Nível:** MUST

**Regra:** Crie um pool por processo, reutilize-o e feche no shutdown. Comece com limites conservadores (referência: site até 5 e bot até 3 conexões por instância), some todas as réplicas e reserve conexões operacionais antes de aumentar. Configure timeout de aquisição, conexão, statement e transação ociosa.

**Exceções:** valores não são constantes universais; ajuste apenas com métricas de fila, latência, memória e limite real do PostgreSQL.

### Regra: conexão Square–Supabase

**Nível:** MUST

**Regra:** Toda conexão remota exige TLS com verificação de certificado, timeout e limite de pool. Use o endpoint/pooler oficial compatível com o runtime e com transações; não desative validação TLS para contornar erro. Some conexões de `bot`, `site`, migrations e réplicas contra o limite do projeto Supabase antes de aumentar pools. Escolha regiões próximas quando disponíveis e meça latência antes de escalar recursos.

### Regra: continuidade no Free

**Nível:** MUST

**Regra:** Não presuma backup automático, PITR ou disponibilidade contínua no Supabase Free. Development pode ser pausado e recriado por migrations/seeds não sensíveis. Production deve ter procedimento de retomada após pausa e, antes de armazenar dado irrecuperável ou executar mudança destrutiva, backup lógico externo criptografado e restauração verificada em banco descartável. Dumps nunca entram no Git nem ficam junto das credenciais.

### Regra: transações e concorrência

**Nível:** MUST

**Regra:** Operações multi-etapa que precisam ser atômicas usam transação curta. Não faça chamadas externas dentro da transação. Use constraint, lock/advisory lock ou concorrência otimista conforme o invariante; retries de serialization/deadlock têm limite e jitter.

### Regra: idempotência e auditoria

**Nível:** SHOULD

**Regra:** Mutations administrativas, webhooks, jobs e comandos reexecutáveis usam chave/idempotency guard quando duplicação causar dano. Registre auditoria de ação, ator confiável, alvo, resultado e timestamp, sem tokens nem payload sensível completo.

### Regra: performance de queries

**Nível:** SHOULD

**Regra:** Paginar com limite máximo, evitar N+1 por join/batching e analisar queries lentas com `EXPLAIN (ANALYZE, BUFFERS)` em dados representativos. Não aplique cache para mascarar query sem índice.
