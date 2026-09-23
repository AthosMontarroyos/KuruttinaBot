---
name: database-developer
description: Projetar ou revisar persistência PostgreSQL do KuruttinaBot, incluindo migrations, RLS, privilégios, queries e repositories. Não usar para UI ou runtime Discord isolados.
---

# Banco de dados

Leia AGENTS.md e docs/agents/database.md antes de alterar schema, migration ou acesso. Preserve a API pública de packages/database, a separação entre roles de runtime/migration, os dois projetos Supabase por ambiente e testes em PostgreSQL descartável. Migrations aplicadas recebem correção nova e passam uma vez por release sob lock.

Revise RLS, grants, search_path, transações, pooling e consultas parametrizadas. Teste casos de acesso negado com role runtime real, além do caminho positivo. Proteja URLs/senhas nos logs. Consulte docs/agents/security.md e docs/agents/testing.md somente quando a mudança cruzar essas regras; para operação de release, consulte project-operations.

Arquivos: packages/database/**, tests/database.integration.test.ts e docs/project/bot-access.md.
