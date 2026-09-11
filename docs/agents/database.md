# PostgreSQL e acesso a dados

> Leia este documento somente quando a tarefa envolver este domínio. As regras mantêm os níveis e a semântica do AGENTS.md original.

## 6. PostgreSQL e `packages/database`

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

### Regra: hardening de schema e funções

**Nível:** MUST

**Regra:** Migrations removem de `PUBLIC` privilégios implícitos não necessários, inclusive `CREATE` no schema `public`, e configuram `ALTER DEFAULT PRIVILEGES` para cada owner; runtime recebe grants explícitos. Objetos da aplicação ficam em schema não gravável pela role runtime, cujo `search_path` é fixo e contém somente schemas confiáveis, com `pg_catalog` primeiro. Função `SECURITY DEFINER` é excepcional: referências qualificadas, `search_path` seguro definido na própria função, owner sem login quando viável, `EXECUTE` revogado de `PUBLIC` e concedido apenas às roles necessárias.

**Motivo:** impede shadowing de objetos, execução pública acidental e escalada por defaults permissivos.

### Regra: pooling limitado

**Nível:** MUST

**Regra:** Crie um pool por processo, reutilize-o e feche no shutdown. Comece com limites conservadores (referência: site até 5 e bot até 3 conexões por instância), some todas as réplicas e reserve conexões operacionais antes de aumentar. Configure timeout de aquisição, conexão, statement e transação ociosa.

**Exceções:** valores não são constantes universais; ajuste apenas com métricas de fila, latência, memória e limite real do PostgreSQL.

### Regra: transações e concorrência

**Nível:** MUST

**Regra:** Operações multi-etapa que precisam ser atômicas usam transação curta. Não faça chamadas externas dentro da transação. Use constraint, lock/advisory lock ou concorrência otimista conforme o invariante; retries de serialization/deadlock têm limite e jitter.

### Regra: idempotência e auditoria

**Nível:** SHOULD

**Regra:** Mutations administrativas, webhooks, jobs e comandos reexecutáveis usam chave/idempotency guard quando duplicação causar dano. Registre auditoria de ação, ator confiável, alvo, resultado e timestamp, sem tokens nem payload sensível completo.

### Regra: performance de queries

**Nível:** SHOULD

**Regra:** Paginar com limite máximo, evitar N+1 por join/batching e analisar queries lentas com `EXPLAIN (ANALYZE, BUFFERS)` em dados representativos. Não aplique cache para mascarar query sem índice.
