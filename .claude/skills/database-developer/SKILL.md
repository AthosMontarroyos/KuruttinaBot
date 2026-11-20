---
name: database-developer
description: Criar, corrigir ou revisar schema, migrations, RLS, privilégios, queries e repositories PostgreSQL do KuruttinaBot. Usar ao alterar packages/database ou persistência, sem exigir invocação explícita.
---

# Persistência PostgreSQL

## Procedimento

1. Localize o consumidor e a API pública de `packages/database`. Leia em [persistência](references/persistence.md) as seções projetos por ambiente, acesso server-side e centralizado; confirme development/production sem mostrar credenciais. Ref do projeto Supabase, host do pooler e snowflakes do seed não entram no repositório: ficam no Doppler como `SUPABASE_PROJECT_REF`, `DATABASE_POOLER_HOST`, `SEED_GUILD_ID`, `SEED_CREATOR_ID` e `SEED_DEV_ID`. O CLI de seed lê só os três últimos. Nenhum dos cinco entra nos contêineres.
2. Para query/repository, leia queries seguras, transações, idempotência e performance. Parametrize valores, limite resultados e mantenha chamadas externas fora da transação. Para conexão, leia pooling e TLS.
3. Para schema, role ou migration, leia integridade, migrations, RLS/contexto, privilégios e hardening. Escreva migration nova; preserve as já aplicadas. Modele isolamento e grants junto com a mudança, não depois.
4. Cubra sucesso e negação com role runtime real em PostgreSQL descartável: `npm run test:database`. Se afetar autorização, use os casos de [validação](../project-maintenance/references/validation.md). Testes não leem `.env` operacional nem usam production. Tabela nova em `bot_private` entra pelo nome na asserção fechada de `tests/database.integration.test.ts` (`does not grant new objects from the migration owner to runtime`), com RLS forçada e os grants explícitos; contagem solta esconde qual tabela apareceu. Migration que copia dado já gravado aplica as migrations anteriores, insere o estado antigo e só então a nova, para o seed não mascarar a cópia. Quando vários testes compartilham um cluster, restaure `bot_dev_guilds`, `bot_staff` e `bot_settings` em volta de cada teste: o timeout do Vitest não espera o `finally` do corpo, e o estado sujo quebra o teste seguinte.
5. Execute typecheck, testes dos consumidores e build dos módulos afetados. Uma migration revisável não equivale a autorização de aplicá-la remotamente; operação de release aciona `project-operations`. Para dado irrecuperável ou alteração destrutiva, leia continuidade/backup na referência antes de executar.

Para entrada, autorização ou secrets, leia as seções correspondentes de [segurança](../project-maintenance/references/security.md). A aplicação usa PostgreSQL server-side; não introduza Data API, SDK ou chave administrativa no runtime sem requisito e revisão explícitos. Registre procedimentos recorrentes aqui e detalhes condicionais na referência.
