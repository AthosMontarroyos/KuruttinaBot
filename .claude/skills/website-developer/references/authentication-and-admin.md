# Autenticação e administração web

> Referência da skill. Leia as seções aplicáveis à operação, incluindo seus requisitos e exceções; não carregue os demais assuntos preventivamente.

A Home usa React/Vite e servidor Node próprio. Autenticação e painel ainda não estão implementados; consulte esta referência somente ao trabalhar nesses fluxos. A [decisão de login exclusivo via Discord](../../../../docs/decisions/discord-only-authentication.md) é requisito obrigatório: Discord é a única fonte de identidade, sem cadastro local, senha, recuperação de senha, Supabase Auth ou outro serviço de login. Banco, secrets, tokens OAuth e autorização ficam exclusivamente no servidor, fora dos módulos incluídos no bundle React. O login não cria usuários nem concede privilégios.

## Autenticação e UI

### Regra: fronteira de mutations

**Nível:** MUST

**Regra:** Handlers HTTP do servidor Node tratam entrada como `unknown`, validam schema/tamanho, autenticam, autorizam por recurso/ação e só então chamam caso de uso/repository. Middleware pode otimizar navegação, mas não substitui essas verificações.

### Regra: identidade Discord

**Nível:** MUST

**Regra:** Discord OAuth é o único método de login e autentica identidade; não concede autorização sozinho. Não implemente cadastro local, senha, recuperação de senha, Supabase Auth nem outro provedor. Gere `state` com CSPRNG, vincule-o à sessão/transação que iniciou o login, defina expiração e consuma-o atomicamente uma única vez no callback. Aceite somente a redirect URI exata cadastrada/configurada, solicite scopes mínimos e troque o authorization code exclusivamente no servidor. Use PKCE com `S256` quando o fluxo/biblioteca suportar; use `nonce` somente se houver OIDC real com `id_token`, não em OAuth 2.0 puro. Após o token exchange bem-sucedido, obtenha o `discordId` no servidor pela resposta de identidade do Discord autenticada (por exemplo, endpoint de usuário com o access token), valide seu schema como string decimal canônica de Snowflake (`^[1-9][0-9]{16,19}$`), sem conversão para `number`, e crie a sessão; não confie em ID do cliente nem decodifique token opaco como prova de identidade.

### Regra: autorização da equipe

**Nível:** MUST

**Regra:** Usuários privilegiados são os registros de `bot_private.bot_staff` do ambiente correspondente. Não use `CREATOR_DISCORD_ID`, `OWNER_ID`, outro identificador fixo nem um segundo cadastro de administradores. O DevMock do site existe somente quando `APP_ENV` é `development` e obtém a identidade no servidor por `bot_private.active_dev_user_id()` (o `user_id` do registro ativo com papel `dev`). Production não habilita o mock. Registro ausente, inativo ou id inválido, e falha da consulta, impedem esse login. Os papéis existentes são somente `creator` e `dev`. Relacione o `discordId` canônico da sessão a `user_id`, verifique `active = true` e exija o papel adequado à operação: `creator` atende operações de `creator` e de `dev`; `dev` atende somente operações cujo papel mínimo é `dev`. Consulte no servidor a cada operação protegida. Negue quando o registro estiver ausente, inativo ou com papel insuficiente, e também quando a consulta falhar. Página oculta, botão desabilitado, middleware, claim do browser ou sessão previamente elevada não autorizam. Export, mutation destrutiva ou ação de grande alcance exige autenticação recente ou step-up/reautenticação e registra auditoria. O acesso futuro passa por `packages/database` e pela RLS existente; não presuma que o acesso atual do bot já atende ao site. A tabela não cadastra visitantes. Não crie contas, usuários de teste ou registros privilegiados sem autorização explícita do responsável.

| Situação na consulta do ambiente | Resultado da operação privilegiada |
| --- | --- |
| Registro ativo com papel suficiente | Autoriza, depois dos demais controles da operação |
| Registro ausente | Nega |
| Registro inativo | Nega |
| Papel insuficiente | Nega |
| Falha de consulta | Nega |

### Regra: sessões e tokens

**Nível:** MUST

**Regra:** Use sessão server-side revogável com token opaco aleatório; armazene somente o hash desse token no store. Em produção, envie-o em cookie com prefixo `__Host-`, `HttpOnly`, `Secure`, `Path=/`, sem `Domain` e `SameSite=Lax` ou mais restritivo. Regenere token/ID após callback OAuth e após elevação de privilégio; aplique timeout absoluto e de inatividade, rotação e revogação no logout. Com múltiplas réplicas, o store e a revogação precisam ser compartilhados. Armazene access/refresh token Discord somente se uma feature server-side o exigir, criptografado e com retenção mínima; nunca o envie ao client nem registre.

### Regra: CSRF

**Nível:** MUST

**Regra:** Mutations autenticadas por cookie aceitam apenas métodos não seguros apropriados, exigem `Origin` igual à origem pública canônica configurada e usam proteção CSRF da biblioteca/framework ou token explícito quando a proteção embutida não cobrir o fluxo. Não derive a origem esperada de `Host`/`X-Forwarded-*` fornecidos livremente. O endereço de escuta depende do modo documentado em [Home local](../../../../docs/project/site.md). Quando a autenticação existir, o único proxy confiável é o `cloudflared` local do túnel, na publicação em loopback do host. Normalize protocolo, host e porta antes da comparação. `GET` não altera estado.

### Regra: fetching e memória

**Nível:** MUST

**Regra:** Toda listagem server-side usa seleção mínima, filtro e paginação com teto. Não mantenha dataset, sessão, resposta grande ou cache ilimitado em global. Use streaming de respostas e estados de carregamento no React quando reduzirem pico e latência; não crie job permanente no processo web.

### Regra: cache de dados

**Nível:** SHOULD

**Regra:** Defina explicitamente duração e invalidação do cache quando ele existir. Dados privados ou autorizados não compartilham cache entre usuários sem chave segura; após uma alteração invalide as entradas afetadas no servidor e atualize os dados apresentados pelo cliente. Não presuma que cache em memória sobrevive ou é comum entre instâncias.

### Regra: erros no frontend

**Nível:** MUST

**Regra:** Retorne ao cliente código e mensagem segura; detalhes e correlação ficam no log server-side. Diferencie 401, 403, 404, 409, 422, 429 e 5xx sem revelar existência de recurso quando isso quebrar isolamento.

### Regra: componentes React

**Nível:** SHOULD

**Regra:** Componentes apresentam e compõem; casos de uso e policies ficam fora deles. Prefira estado local derivado a estado duplicado, efeitos somente para sincronizar sistemas externos, formulários com labels/erros/foco e componentes acessíveis por teclado. Divida componente quando misturar responsabilidades, não por contagem arbitrária de linhas.

### Regra: Tailwind

**Nível:** SHOULD

**Regra:** Reutilize tokens de cor, tipografia, espaçamento e estados; extraia componente/variante quando um conjunto de classes representa o mesmo conceito repetido. Preserve contraste, foco visível, responsividade e reduced motion. Não crie classe semântica global para esconder lógica de autorização.

## 15. Administração de dados

### Regra: ações modeladas

**Nível:** MUST

**Regra:** O dashboard oferece operações administrativas explícitas (por exemplo, alterar configuração ou suspender entidade), cada uma com schema, policy, transação/idempotência quando necessárias e auditoria. Não ofereça editor SQL arbitrário ou proxy genérico ao banco.

### Regra: confirmação e impacto

**Nível:** SHOULD

**Regra:** Ação destrutiva ou de grande alcance mostra alvo/impacto e exige confirmação proporcional. No servidor, recalcule escopo e autorização imediatamente antes da mutation; não confie no resumo do client.

### Regra: exposição mínima

**Nível:** MUST

**Regra:** Retorne ao administrador apenas campos necessários. Dados sensíveis continuam protegidos mesmo do criador salvo necessidade funcional documentada; exports têm limite, auditoria e retenção.
