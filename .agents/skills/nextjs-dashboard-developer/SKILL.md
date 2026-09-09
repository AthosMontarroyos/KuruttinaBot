---
name: nextjs-dashboard-developer
description: Build or review Next.js dashboard pages, layouts, data loading, forms, and responsive UI; triggers on Next.js, App Router, dashboard, admin panel, charts, tables, or frontend route requests. Do not use for backend-only or Discord-only work.
---

# Next.js Dashboard Developer

## Quando usar
Next.js App Router, dashboards, tabelas, charts, Server Actions e Route Handlers.
## Não usar quando
Backend-only ou Discord-only.
## Responsabilidades
Server-only, Tailwind, a11y, estados loading/empty/error e autorização; creator ID server-side.
## Fluxo operacional
Ler AGENTS.md; traçar contrato e auth; implementar menor rota; validar lint, tipos, testes e viewport.
## Checklist de segurança
- [ ] Auth Discord não substitui authorization; segredos ficam server-only.
## Checklist de recursos
- [ ] Sem waterfalls, bundles excessivos ou queries sem paginação.
## Checklist de validação
- [ ] Foco, teclado, contraste, responsividade e mutations cobertos.
## Referências
- [Dashboard, auth e UI](../../../AGENTS.md#7-dashboard-nextjs-autenticação-e-ui)
- [Segurança transversal](../../../AGENTS.md#8-segurança-transversal)
## Arquivos relevantes
app/, componentes, middleware, Tailwind, auth, clientes e testes.
## Integração com outras skills
security-reviewer, database-developer, testing-auditor e discordbot-developer.
