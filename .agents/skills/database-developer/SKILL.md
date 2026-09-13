---
name: database-developer
description: Design, implement, migrate, or review application persistence, schemas, queries, and repositories; triggers on database, SQL, ORM, migrations, indexes, transactions, or data-access requests. Do not use for UI-only changes or static configuration.
---

# Database Developer

## Quando usar
Schemas, SQL, ORM, migrations, índices, transações e repositories.
## Não usar quando
Nenhum contrato de dados é afetado.
## Responsabilidades
Integridade, compatibilidade, desempenho e acesso isolado.
## Fluxo operacional
Ler AGENTS.md; localizar schema/migrations; usar pooling pequeno; revisar locks, índices e transações; testar em banco descartável.
## Checklist de segurança
- [ ] RLS deny-by-default, escopo usuário/guild e queries parametrizadas.
## Checklist de recursos
- [ ] Pool, timeouts, rows e índices são bounded.
## Checklist de validação
- [ ] Migrations repetíveis e testes de constraints, concorrência e falhas.
## Referências
- [PostgreSQL e database](../../../docs/agents/database.md)
- [Validação proporcional](../../../docs/agents/testing.md)
## Arquivos relevantes
Migrations, schema, modelos, repositories, seeds e testes.
## Integração com outras skills
project-architect, security-reviewer, testing-auditor e discordbot-developer.
