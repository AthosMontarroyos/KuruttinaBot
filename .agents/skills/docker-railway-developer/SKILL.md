---
name: docker-railway-developer
description: Containerize, configure, troubleshoot, or deploy this application with Docker, Square Cloud, or Cloudflare Tunnel; triggers on Dockerfile, Compose, runtime health, services, tunnels, volumes, or deployment requests. Do not use for source-only changes unrelated to runtime packaging.
---

# Docker e Square Cloud Developer

## Quando usar
Docker, Compose, Square Cloud, Cloudflare Tunnel, health checks, volumes e runtime.
## Não usar quando
Mudança não toca empacotamento ou deploy.
## Responsabilidades
Imagens multi-stage, build context mínimo, prod deps, sinais, readiness, serviços separados e conectores Cloudflare por ambiente.
## Fluxo operacional
Ler AGENTS.md; inspecionar scripts/config; validar não-root, sinais e env; build/run smoke; revisar deploy sem mutação irreversível. Para Tunnel, conferir `APP_ENV`, ID e hostname em `infra/cloudflare/tunnels.json`, manter tokens fora do Git e nunca apontar development e production simultaneamente para a mesma origem local.
## Checklist de segurança
- [ ] Sem secrets na imagem; runtime least-privilege.
## Checklist de recursos
- [ ] Orçamento Square Cloud ~500 MB; limites, volumes e persistência explícitos.
## Checklist de validação
- [ ] Health/readiness, logs, shutdown, volumes e smoke local verificados.
## Arquivos relevantes
Dockerfile*, Compose, manifests de deploy, lockfiles, .dockerignore e scripts.
## Referências
- [Docker e Compose](../../../docs/agents/deployment.md#5-docker-e-compose)
- [Serviços e recursos](../../../docs/agents/deployment.md#3-serviços-e-execução)
## Integração com outras skills
security-reviewer, testing-auditor, database-developer e discordbot-developer.
