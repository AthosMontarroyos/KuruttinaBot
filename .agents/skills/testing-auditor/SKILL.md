---
name: testing-auditor
description: Audit test strategy and coverage, add focused tests, or verify regressions across unit, integration, contract, and end-to-end flows; triggers on testing, coverage, regression, flaky tests, CI validation, or quality-audit requests. Do not use for a single trivial assertion unless broader audit is requested.
---

# Testing Auditor

## Quando usar
Auditar ou ampliar testes unit, integration, contract, e2e, migrations, Docker smoke e regressões de recursos.
## Não usar quando
Uma asserção trivial isolada resolve o pedido.
## Responsabilidades
Mapear comportamento crítico, falhas, flakiness, isolamento e cobertura significativa.
## Fluxo operacional
Ler AGENTS.md; estabelecer baseline; adicionar casos observáveis; rodar alvo e suite proporcional; investigar flakes.
## Checklist de segurança
- [ ] Testes cobrem autorização, input inválido e vazamento de dados.
## Checklist de recursos
- [ ] Docker smoke verifica memória/CPU; fixtures e serviços têm limites.
## Checklist de validação
- [ ] Unit/integration/contract/e2e e migrations cobertos conforme risco.
## Arquivos relevantes
package.json, configs, CI, testes, fixtures, migrations e handlers.
## Referências
- [Desenvolvimento e testes](../../../docs/agents/testing.md)
- [Testes de segurança](../../../docs/agents/security.md)
## Integração com outras skills
security-reviewer, database-developer, nextjs-dashboard-developer, docker-railway-developer e discordbot-developer.
