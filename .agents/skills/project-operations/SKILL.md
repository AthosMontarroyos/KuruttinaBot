---
name: project-operations
description: Configure and review KuruttinaBot deployment on Square Cloud, the separate developer n8n instance, and operational R2 or Cloudflare workflows. Do not use for isolated Discord commands, SQL schema or site UI.
---

# Operação do projeto

Leia `AGENTS.md` e apenas os documentos de domínio pertinentes. Verifique o estado implementado antes de alterar deploy: o site ainda não existe, o produto tem um único `squarecloud.app`, e n8n é independente. Para Square, confira build pelo lockfile, START, memória, configuração allowlisted, sinais e logs. Para n8n, confira versão fixa, armazenamento durável, chave de criptografia, acesso dos devs e exportação segura dos futuros fluxos.

Scripts operacionais de R2, emojis e túnel foram aposentados; o [catálogo](../../../docs/project/n8n-migration.md) preserva comportamento e critérios para novos workflows. Nunca coloque credenciais administrativas no runtime bot/site nem execute fluxos de development contra production. Valide com build e testes proporcionais, sem deploy externo automático.

Arquivos: `squarecloud.app`, `infra/n8n/**`, `.env.example`, `docs/agents/deployment.md` e catálogo n8n. Regras detalhadas de recursos, segurança e assets permanecem nos documentos correspondentes.
