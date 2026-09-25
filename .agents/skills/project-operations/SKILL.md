---
name: project-operations
description: Configure and review KuruttinaBot deployment on Square Cloud and operational R2 or Cloudflare concerns. Do not use for isolated Discord commands, SQL schema or site UI.
---

# Operação do projeto

Leia `AGENTS.md` e apenas os documentos de domínio pertinentes. Verifique o estado implementado antes de alterar deploy: o site ainda não existe e o produto tem um único `squarecloud.app`. Para Square, confira build pelo lockfile, START, memória, configuração allowlisted, sinais e logs.

Scripts operacionais de R2, emojis e túnel foram aposentados; o [registro](../../../docs/project/tooling-retirement.md) preserva o histórico. Nunca coloque credenciais administrativas no runtime bot/site. Valide com build e testes proporcionais, sem deploy externo automático.

Arquivos: `squarecloud.app`, `.env.example` e `docs/agents/deployment.md`. Regras detalhadas de recursos, segurança e assets permanecem nos documentos correspondentes.
