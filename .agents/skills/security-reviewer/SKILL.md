---
name: security-reviewer
description: Review or harden authentication, authorization, secrets, input handling, dependency exposure, and operational security; triggers on security review, audit, vulnerability, permissions, tokens, secrets, or data exposure. Do not use for ordinary refactors without a security concern.
---

# Security Reviewer

## Quando usar
Threat modeling e auditoria de APIs, auth, banco, Docker e deploy.
## Não usar quando
Mudança sem impacto em segurança.
## Responsabilidades
Revisar OAuth, cookies, CSRF, SSRF, XSS, uploads, rate limit, segredos e abuso.
## Fluxo operacional
Ler AGENTS.md; mapear ativos/atores; rastrear input; revisar controles; corrigir apenas autorizado; validar e reportar risco residual.
## Checklist de segurança
- [ ] Cookies OAuth seguros, CSRF e autorização server-side.
- [ ] Uploads, SSRF, XSS, rate limits e secrets cobertos.
## Checklist de recursos
- [ ] Auditoria não expõe dados sensíveis nem excede escopo.
- [ ] Payloads têm limites; concorrência, rate limit, uploads e DoS são avaliados.
## Checklist de validação
## Referências
- [Regras de segurança transversal](../../../AGENTS.md#8-segurança-transversal)
- [Payloads, rate limit e uploads](../../../AGENTS.md#13-dependências-e-performance)
- [ ] Testes, SAST/dependency audit e logs redigidos executados.
## Arquivos relevantes
Auth, API, webhooks, .env*, dependências, Docker e deploy.
## Integração com outras skills
project-architect, database-developer, nextjs-dashboard-developer, docker-railway-developer e discordbot-developer.
