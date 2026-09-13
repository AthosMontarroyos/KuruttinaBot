# Desenvolvimento, testes e conclusão

> Leia este documento somente quando a tarefa envolver este domínio. As regras mantêm os níveis e a semântica do AGENTS.md original.

O conjunto atual do bot é coberto por testes Vitest de configuração, composição/adapters de commands, estados de interaction, identidade e execução de deployments. Eles são herméticos e não usam token Discord real; o inventário e as limitações estão no [snapshot do estado atual](../project/current-state.md).

## 14. Desenvolvimento, testes e Git

### Regra: comandos padronizados

**Nível:** SHOULD

**Regra:** A raiz fornece comandos consistentes para install, dev, build, typecheck, lint, format, test e migrations, com filtros por workspace. CI usa os mesmos comandos e o lockfile.

### Regra: validação proporcional

**Nível:** MUST

**Regra:** Antes de concluir, rode ao menos checks dos módulos alterados. Regra de negócio recebe teste unitário; repository/migration/RLS recebe integração com PostgreSQL real; boundary HTTP/auth recebe teste de integração; fluxo crítico recebe teste end-to-end quando viável. Relate comandos e falhas não relacionadas.

### Regra: testes de segurança

**Nível:** MUST

**Regra:** Para autorização e RLS, teste também usuário ausente, usuário errado, tenant diferente, payload adulterado e role sem privilégio. Com a role runtime real, confirme falha de `CREATE`/DDL, acesso cross-tenant, chamada de função não concedida, bypass por `search_path` e acesso após revogação; valide defaults/grants após migrations. Para OAuth/sessão, cubra replay/expiração de `state`, redirect URI divergente, rotação, timeout e sessão privilegiada revogada. Teste positivo sozinho é insuficiente.

### Regra: testes herméticos

**Nível:** SHOULD

**Regra:** Testes não dependem de produção, horário/rede reais ou ordem. Isole estado, use fixtures mínimas e não use token Discord real. Integração externa é mockada salvo teste manual autorizado em ambiente dev.

### Regra: lint e formatação

**Nível:** SHOULD

**Regra:** Formatação é automática; lint cobre imports, promises, tipos inseguros e fronteiras quando configurável. Não desative regra global para corrigir um arquivo; exceção local inclui motivo.

### Regra: Git focado

**Nível:** SHOULD

**Regra:** Commits são pequenos, coerentes e em modo imperativo; não misture arquivos gerados, refactor e feature sem necessidade. Nunca reescreva ou descarte mudanças alheias sem autorização. Não versione secrets, `.env`, dumps, logs, coverage ou outputs.

### Regra: documentação e decisões

**Nível:** SHOULD

**Regra:** Atualize README/env example/contrato quando comportamento operacional mudar. Decisão transversal ou trade-off duradouro recebe ADR curto com contexto, decisão, alternativas e consequências.

### Regra: comentários, TODO e dead code

**Nível:** SHOULD

**Regra:** Comentários explicam motivo/invariante, não repetem código. TODO inclui ação concreta e issue/responsável quando possível. Remova código/import/dependência morto em vez de comentar; preserve compatibilidade apenas com prazo e teste.

### Regra: ambientes

**Nível:** MUST

**Regra:** Development e production têm projetos Supabase, credenciais e OAuth callbacks separados. Staging e testes usam PostgreSQL local/CI descartável com credenciais próprias, nunca o projeto de production. Produção não habilita debug, seed de teste, hot reload ou fallback inseguro. Configuração ausente causa falha no startup; nenhum ambiente faz fallback para outro.

## 16. Skills e divisão de responsabilidade

As skills complementam, mas não substituem, este arquivo. Cada `SKILL.md` deve declarar triggers, quando não usar, arquivos relevantes, responsabilidades, workflow, checklists de segurança/recursos/validação e integração com outras skills. Não crie uma skill por tecnologia nem replique texto global.

Domínios recomendados, desde que as respectivas skills existam:

- `discordbot-developer`: discord.js, Gateway, commands, interactions e limites oficiais. É a autoridade específica do bot.
- `project-architect`: fronteiras, dependências, ADRs e mudanças transversais; não implementa detalhes de cada domínio.
- `database-developer`: schema, migrations, query/repository, roles, RLS, pooling e análise SQL.
- `nextjs-dashboard-developer`: App Router, React, Tailwind, rotas/actions e integração da autenticação; policies continuam server-side.
- `docker-railway-developer`: Dockerfiles, Compose, Square Cloud, builds, health, shutdown e orçamento operacional.
- `security-reviewer`: threat model e revisão transversal de auth, API, banco, Discord, containers e deploy; revisa, não toma posse automática de toda implementação.
- `testing-auditor`: estratégia e verificação independente de testes, regressões, integração, segurança e consumo.

### Regra: skill principal e consulta

**Nível:** MUST

**Regra:** A tarefa tem uma skill principal pelo artefato alterado. Consulte outra quando cruzar sua fronteira: migration para feature do bot é liderada por database com consulta ao Discord; OAuth/admin é liderado por dashboard com revisão de segurança; container do bot é liderado por infraestrutura com consulta ao Discord. Em conflito, valem este arquivo e a skill proprietária do domínio afetado; decisão transversal sobe ao arquiteto/humano.

### Regra: evitar duplicação entre skills

**Nível:** MUST

**Regra:** Skill especializada referencia a seção global aplicável e adiciona procedimento, critérios e ferramentas do seu domínio. Não copie regras globais nem crie skill equivalente a `discordbot-developer`.

## 17. Definition of Done global

Antes de encerrar qualquer mudança, confirme o que for aplicável:

- [ ] Escopo resolvido sem alterações alheias ou arquitetura paralela.
- [ ] Direção de dependências e APIs públicas respeitadas; nenhum ciclo novo.
- [ ] Entradas externas validadas em runtime e erros públicos sanitizados.
- [ ] Autenticação, autorização e ownership revalidados no servidor.
- [ ] Secrets ausentes de código, client bundle, logs e artefatos Docker.
- [ ] Queries parametrizadas, seletivas e sem N+1; RLS/privileges revisados quando aplicável.
- [ ] Pools, filas, caches, collectors, batches e concorrência possuem limites.
- [ ] Impacto de RAM/CPU/processos/conexões/imagem avaliado para mudança relevante.
- [ ] Startup, health/readiness, timeout, retry e graceful shutdown continuam corretos.
- [ ] Typecheck, lint, testes proporcionais e build do módulo alterado executados.
- [ ] Casos negativos de autorização/RLS cobertos quando aplicável.
- [ ] Migration é compatível, serializada e possui estratégia operacional.
- [ ] Documentação, `.env.example`, contratos e ADR atualizados quando necessário.
- [ ] Dependências novas foram justificadas e avaliadas por segurança/footprint/licença.
- [ ] Resultado informa arquivos alterados, validações executadas, riscos e suposições.
