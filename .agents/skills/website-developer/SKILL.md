---
name: website-developer
description: Criar, corrigir ou revisar a Home, componentes React, CSS, ícones, servidor HTTP e build em apps/site do KuruttinaBot. Usar também para login/painel futuro, sem exigir menção explícita à skill.
metadata:
  short-description: Desenvolvimento do website
---

# Website

A implementação atual usa React, TypeScript, Tailwind, Vite e servidor Node em `apps/site/server`. A direção aprovada é React sem Next.js, construindo uma base/framework próprio com liberdade de organização. Estrutura de pastas e roteamento são decisões do projeto, não convenções impostas por um framework. Veja a [decisão](../../../docs/decisions/react-base.md). Autenticação e painel ainda não existem.

## Procedimento

1. Localize o componente ou boundary HTTP afetado. Leia [Home local](../../../docs/project/site.md) para execução/configuração; consulte [referência visual da Home](references/home-figma.md) somente para layout e proveniência visual.
2. Em UI, mantenha componentes em `src/`, estados de indisponibilidade honestos, teclado/foco e variantes desktop/celular. Confira os estados e larguras afetados no browser quando possível; registre se essa validação não foi executada.
3. Em SVG ou mídia, leia as seções correspondentes de [assets](../project-operations/references/assets.md). Ícones locais ficam por função em `public/icons/`; caminho público e allowlist mudam juntos. Mídia R2 permanece remota.
4. Em HTTP, CSP, arquivos públicos ou configuração, leia entrada, XSS, secrets e erros em [segurança](../project-maintenance/references/security.md). Antes de diagnosticar host, porta ou URL, identifique o modo em [desenvolvimento](../../../docs/project/development.md) e o comportamento em [Home local](../../../docs/project/site.md). A publicação fica na [referência de deployment](../project-operations/references/deployment.md). Preserve a configuração automática: `site:dev` seleciona development; sem `SITE_URL`, development deriva a URL de `PORT`; produção recebe a origem explícita pelo Compose. Não derive origem pública de headers ou de `HOST`. Mantenha publicação allowlisted, GET/HEAD, limites, shutdown e o `/healthz` existente. Nunca envie secrets ao bundle.
5. Execute `npm run typecheck`, `npx vitest run tests/site.test.ts` e `npm run site:build`. Build limpa somente o destino do site. Para novos fluxos críticos, selecione os testes adicionais em [validação](../project-maintenance/references/validation.md).

## Login e administração, somente quando pedidos

Leia [autenticação e administração](references/authentication-and-admin.md): mutations, identidade Discord, autorização, sessões, CSRF, erros e administração aplicam-se ao fluxo correspondente. Persistência aciona `database-developer`; publicação e hospedagem acionam `project-operations`.

Atualize esta skill quando mudar o procedimento de trabalho e `docs/project/site.md` quando mudar o comportamento implementado, sem duplicar os dois.
