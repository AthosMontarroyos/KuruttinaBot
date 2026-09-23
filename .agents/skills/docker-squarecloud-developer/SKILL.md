---
name: docker-squarecloud-developer
description: Containerize, configure, troubleshoot, or deploy this application with Docker, Square Cloud, or Cloudflare Tunnel; also maintain Cloudflare R2 CLI/mount scripts under scripts/r2. Triggers on Dockerfile, Compose, runtime health, services, tunnels, volumes, deployment, R2, rclone, or assets mount. Do not use for source-only changes unrelated to runtime packaging or asset operations.
---

# Docker e Square Cloud Developer

## Quando usar
Docker, Compose, Square Cloud, Cloudflare Tunnel, health checks, volumes, runtime, `.dockerignore` e manutenção do bucket R2 (`scripts/r2/**`, mount rclone/FUSE, CLI).
## Não usar quando
Mudança não toca empacotamento, deploy, túnel nem operação de assets.
## Responsabilidades
Imagens multi-stage, build context mínimo, prod deps, sinais, readiness, serviços separados, conectores Cloudflare por ambiente e procedimentos R2 sem versionar o mount.
## Fluxo operacional
Ler AGENTS.md; inspecionar scripts/config; validar não-root, sinais e env; build/run smoke; revisar deploy sem mutação irreversível. Para Tunnel, conferir `APP_ENV`, ID e hostname em `infra/cloudflare/tunnels.json`, manter tokens fora do Git e nunca apontar development e production simultaneamente para a mesma origem local. Execução local canônica é Linux/WSL. Para R2, seguir `docs/agents/assets.md`: CLI/API remota em vez de baixar o bucket; mount só como ferramenta manual no WSL com rclone, jq e FUSE.
## Checklist de segurança
- [ ] Sem secrets na imagem; runtime least-privilege.
- [ ] Credenciais R2/rclone fora do Git; sem copiar objetos do bucket para o repositório.
## Checklist de recursos
- [ ] Orçamento Square Cloud ~500 MB; limites, volumes e persistência explícitos.
- [ ] `.dockerignore` exclui docs/agentes, mounts `R2/`/`emojis/` e prefixo legado `Pictures`.
## Checklist de validação
- [ ] Health/readiness, logs, shutdown, volumes e smoke local verificados.
- [ ] Scripts R2 não exigem mount para sync remoto; unmount só encerra rclone conferido.
## Arquivos relevantes
Dockerfile*, Compose, manifests de deploy, lockfiles, `.dockerignore`, `scripts/r2/**` e `scripts/cloudflare/**`.
## Referências
- [Docker e Compose](../../../docs/agents/deployment.md#5-docker-e-compose)
- [Serviços e recursos](../../../docs/agents/deployment.md#3-serviços-e-execução)
- [Assets no Cloudflare R2](../../../docs/agents/assets.md)
## Integração com outras skills
security-reviewer, testing-auditor, database-developer e discordbot-developer.
