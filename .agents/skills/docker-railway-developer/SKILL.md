---
name: docker-railway-developer
description: Containerize, configure, troubleshoot, or deploy this application on Docker or Railway; triggers on Dockerfile, Compose, Railway, build/runtime health, services, volumes, or deployment requests. Do not use for source-only changes unrelated to runtime packaging.
---

# Docker Railway Developer

## Quando usar
Docker, Compose, Railway, health checks, volumes e runtime.
## Não usar quando
Mudança não toca empacotamento ou deploy.
## Responsabilidades
Imagens multi-stage, build context mínimo, prod deps, sinais, readiness e serviços Railway separados.
## Fluxo operacional
Ler AGENTS.md; inspecionar scripts/config; validar não-root, sinais e env; build/run smoke; revisar deploy sem mutação irreversível.
## Checklist de segurança
- [ ] Sem secrets na imagem; runtime least-privilege.
## Checklist de recursos
- [ ] Orçamento Railway ~500 MB; limites, volumes e persistência explícitos.
## Checklist de validação
- [ ] Health/readiness, logs, shutdown, volumes e smoke local verificados.
## Arquivos relevantes
Dockerfile*, compose, railway.json, lockfiles, .dockerignore e scripts.
## Referências
- [Docker e Compose](../../../AGENTS.md#5-docker-e-compose)
- [Serviços Railway e recursos](../../../AGENTS.md#3-serviços-e-execução)
## Integração com outras skills
security-reviewer, testing-auditor, database-developer e discordbot-developer.
