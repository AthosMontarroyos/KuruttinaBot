---
name: project-architect
description: Define or review project architecture, boundaries, module organization, and implementation plans when a repository needs a deliberate structural decision; triggers on architecture, folder structure, layering, ADR, or system-design requests. Do not use for isolated bug fixes or mechanical renames.
---

# Project Architect

## Quando usar
Arquitetura, módulos, camadas, dependências, ADRs e migrações estruturais.
## Não usar quando
Correções isoladas ou renomes mecânicos.
## Responsabilidades
Mapear direção de dependências, contratos, ownership e orçamentos.
## Fluxo operacional
Ler AGENTS.md; inventariar entradas; registrar ADR com alternativas; implementar menor escopo e validar fronteiras.
## Checklist de segurança
- [ ] Trust boundaries, segredos e autorização têm donos.
## Checklist de recursos
- [ ] CPU, memória, latência, conexões e armazenamento têm orçamento.
## Checklist de validação
- [ ] ADR e testes de contrato refletem o código real.
## Referências
- [Arquitetura e direção de dependências](../../../AGENTS.md#2-arquitetura-de-referência)
- [Validação proporcional](../../../AGENTS.md#14-desenvolvimento-testes-e-git)
## Arquivos relevantes
AGENTS.md, package.json, configs, entradas, testes e manifests.
## Integração com outras skills
database-developer, security-reviewer, testing-auditor e discordbot-developer.
