---
name: website-developer
description: Criar, corrigir ou revisar a Home, componentes React, CSS, ícones, servidor HTTP e build em apps/site do KuruttinaBot. Usar também para login/painel futuro, sem exigir menção explícita à skill.
metadata:
  short-description: Desenvolvimento do website
---

# Website

A implementação atual usa React, TypeScript, Tailwind, Vite e servidor Node em `apps/site/server`. A direção aprovada é React sem Next.js, construindo uma base/framework próprio com liberdade de organização. Estrutura de pastas e roteamento são decisões do projeto, não convenções impostas por um framework. Veja a [decisão](../../../docs/decisions/react-base.md). Autenticação (OAuth Discord) e painel já existem; o login é exclusivamente Discord, conforme a [decisão de autenticação](../../../docs/decisions/discord-only-authentication.md).

Rotas ficam em pastas sob `src/app/`, uma pasta por segmento de URL, com `page.tsx` como arquivo da rota (`app/login/page.tsx` → `/login`); segmento dinâmico usa colchetes (`app/dashboard/[serverId]/page.tsx` → `/dashboard/:serverId`). Uma aba ou seção sem URL própria — por exemplo visão geral, Mensagens e módulos dentro do painel de um servidor — **é visualização, não rota**: o `page.tsx` da rota guarda o estado de qual visualização mostrar, e cada visualização tem sua própria pasta dentro da pasta da rota, com o arquivo principal chamado `view.tsx` (nunca `page.tsx`, para não ser confundida com rota) — ex.: `dashboard/[serverId]/overview/view.tsx`, `.../messages/view.tsx`. Código que só essa visualização usa (dados, subcomponentes) fica dentro da pasta dela, como `.../messages/templates-api.ts`. Só promova uma visualização a rota (com `page.tsx` próprio) quando precisar de URL própria, recarregável e compartilhável. Código usado por mais de uma rota ou visualização vai para `src/components/` ou `src/lib/`.

## Procedimento

1. Localize o componente ou boundary HTTP afetado. Leia [Home local](../../../docs/project/site.md) para execução/configuração; consulte [referência visual da Home](references/home-figma.md) somente para layout e proveniência visual.
2. Em UI, mantenha componentes em `src/`, estados de indisponibilidade honestos, teclado/foco e variantes desktop/celular. Confira os estados e larguras afetados no browser quando possível; registre se essa validação não foi executada.
   **Sem observações de desenvolvimento no design (MUST).** Todo texto visível ou lido por tecnologia assistiva (UI, avisos, placeholders, `title`, `aria-label`, mensagens de erro) é texto de produto. Não mencione protótipo, mock, exemplo, ambiente, variável, ID, token, "ainda não configurado", "em desenvolvimento" nem status de implementação. Indisponibilidade usa texto neutro de produto ("estará disponível em breve"); páginas pedidas como "em construção" dizem só isso. Ferramenta de desenvolvimento (login mock) aparece só quando o servidor a habilita em development e sem legenda explicativa. Observações para quem desenvolve ficam em comentários de código ou em `docs/`. Antes de concluir uma tarefa de UI, procure esses termos nos textos alterados.
3. Em SVG ou mídia, leia as seções correspondentes de [assets](../project-operations/references/assets.md). Ícones locais ficam por função em `public/icons/`; caminho público e allowlist mudam juntos. Mídia R2 permanece remota.
4. Em HTTP, CSP, arquivos públicos ou configuração, leia entrada, XSS, secrets e erros em [segurança](../project-maintenance/references/security.md). Antes de diagnosticar host, porta ou URL, identifique o modo em [desenvolvimento](../../../docs/project/development.md) e o comportamento em [Home local](../../../docs/project/site.md). A publicação fica na [referência de deployment](../project-operations/references/deployment.md). Preserve a configuração automática: `npm run site dev` seleciona development pelo preload `@kuruttina/config/site-development`; sem `SITE_URL`, development deriva a URL de `PORT`; produção recebe a origem explícita pelo Compose. Não derive origem pública de headers ou de `HOST`. Mantenha publicação allowlisted, GET/HEAD, limites, shutdown e o `/healthz` existente. Nunca envie secrets ao bundle.
5. Execute `npm run typecheck`, `npx vitest run tests/site.test.ts` e `npm run site build`. Build limpa somente o destino do site. Para novos fluxos críticos, selecione os testes adicionais em [validação](../project-maintenance/references/validation.md).

## Login e administração, somente quando pedidos

A [decisão de login exclusivo via Discord](../../../docs/decisions/discord-only-authentication.md) é requisito obrigatório de qualquer trabalho de autenticação ou painel.

Leia [autenticação e administração](references/authentication-and-admin.md): mutations, identidade Discord, autorização pela equipe, sessões, CSRF, erros e administração aplicam-se ao fluxo correspondente. O DevMock só existe com `APP_ENV=development` e lê o dev ativo por `getActiveDevUserId()` em `@kuruttina/database`, nunca por `OWNER_ID`. Persistência aciona `database-developer`; publicação e hospedagem acionam `project-operations`. Não crie contas, usuários de teste ou registros privilegiados sem autorização explícita do responsável.

Atualize esta skill quando mudar o procedimento de trabalho e `docs/project/site.md` quando mudar o comportamento implementado, sem duplicar os dois.
