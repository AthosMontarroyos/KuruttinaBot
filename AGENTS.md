# Regras globais do KuruttinaBot

## 1. Escopo, precedência e linguagem normativa

Este arquivo é a fonte de verdade global para código, infraestrutura e documentação do monorepo. Ele orienta pessoas e agentes de IA. Procedimentos especializados ficam nas skills em `.agents/skills/`; uma skill referencia estas regras em vez de copiá-las.

A precedência é: pedido explícito da tarefa > este arquivo e decisões arquiteturais registradas > skill especializada > convenção local do módulo. Um pedido não autoriza violar segurança, privacidade ou restrições da plataforma silenciosamente: registre o conflito e peça decisão. Dentro deste arquivo, `MUST` é invariante, `SHOULD` é o padrão a seguir e `MAY` é opção contextual.

### Regra: mudança proporcional

**Nível:** SHOULD

**Regra:** Faça a menor mudança coerente que resolva o requisito. Não inclua limpeza, migração tecnológica ou abstração sem relação com a tarefa.

**Motivo:** reduz regressões, custo de revisão e consumo de recursos.

**Exceções:** correções adjacentes indispensáveis para compilar, testar ou fechar uma vulnerabilidade devem ser explicadas no resultado.

### Regra: evidência antes de exceção

**Nível:** MUST

**Regra:** Toda exceção a uma regra `MUST` ou a uma fronteira arquitetural precisa de justificativa escrita, impacto, controles compensatórios e aprovação humana. Exceções temporárias recebem responsável e condição de remoção.

**Motivo:** impede que desvios silenciosos se tornem arquitetura acidental.

## 2. Arquitetura de referência

O projeto é um monorepo modular, não uma coleção de microsserviços. As unidades implantáveis iniciais são `bot` e `site`; PostgreSQL é um serviço de infraestrutura. `packages/database` contém código de acesso a dados e nunca representa o servidor PostgreSQL.

```text
/
├── apps/
│   ├── bot/                 # processo discord.js
│   └── site/                # aplicação Next.js App Router
├── config/                 # configurações locais e exemplos (não confundir com packages/config)
├── packages/
│   ├── database/            # schema, migrations, RLS, client e repositories
│   ├── contracts/           # schemas e contratos realmente compartilhados
│   ├── config/              # leitura e validação de configuração
│   ├── auth/                # somente se autenticação/autorização for reutilizada
│   └── shared/              # utilitários puros e pequenos; não é depósito genérico
├── infra/
│   ├── docker/
│   └── railway/
├── Pictures/                # fontes de imagens e assets do projeto
├── .agents/skills/          # procedimentos especializados para agentes
├── docker-compose.yml
└── AGENTS.md
```

Diretórios opcionais (`auth`, `shared`, `infra/railway`) só devem existir quando possuírem conteúdo real. Uma nova aplicação ou serviço exige ciclo de vida, necessidade de deploy ou isolamento operacional próprio; importância de domínio, sozinha, não basta.

### Regra: direção de dependências

**Nível:** MUST

**Regra:** Respeite este fluxo, sem ciclos:

```text
apps (composition roots)
  ├── application/use cases
  ├── adapters (Discord, HTTP, OAuth)
  └── packages
          ├── auth ──> contracts/config
          ├── database ──> contracts/config
          └── contracts/shared/config ──> nenhum app
```

- Apps podem importar APIs públicas de packages.
- Packages não importam de `apps/*`.
- Um app não importa internals do outro.
- `apps/site` não importa `discord.js`; `apps/bot` não importa React ou Next.js.
- UI não contém autorização nem regra de negócio crítica.
- Banco não conhece componentes, rotas, commands ou eventos.
- Integrações externas ficam atrás de adapters; casos de uso recebem interfaces/dependências.

**Motivo:** preserva testabilidade e evita acoplamento entre runtimes.

**Exceções:** nenhuma dependência reversa; mova o contrato comum para um package coeso.

### Regra: API pública de package

**Nível:** SHOULD

**Regra:** Cada package expõe entrypoints explícitos. Importe pelo nome do workspace, não por caminhos relativos que atravessem packages nem por arquivos internos não exportados.

**Motivo:** permite refatorar internals e torna fronteiras auditáveis.

### Regra: compartilhamento com critério

**Nível:** SHOULD

**Regra:** Extraia código quando houver ao menos dois consumidores reais, ou quando o item for um contrato/invariante que deva ter uma única origem. Tolere duplicação local pequena até a semântica estabilizar.

**Motivo:** aplica DRY sem criar abstrações prematuras.

**Exemplo:** schema de configuração de guild usado por site e bot pertence a `contracts`; componente React e handler Discord permanecem nos respectivos apps.

### Regra: organização enxuta

**Nível:** SHOULD

**Regra:** Mantenha arquivos com responsabilidade coesa e pastas com nomes autoexplicativos. Informações, contratos e constantes importantes e realmente compartilhados devem ter uma origem reutilizável, sem duplicação. “Enxuto” não significa criar arquivos artificiais demais nem ocultar responsabilidades; preserve a regra de compartilhamento com critério e extraia apenas quando houver dois consumidores reais ou um invariante canônico.

**Motivo:** torna a estrutura legível e reduz divergências sem incentivar abstração prematura.

### Regra: composição e domínio

**Nível:** SHOULD

**Regra:** Os entrypoints dos apps criam client, pool, logger e adapters e os injetam nos casos de uso. Regras de domínio não chamam diretamente variáveis de ambiente, singleton global, `fetch`, Discord ou banco.

**Motivo:** separa política de mecanismo e simplifica testes.

## 3. Serviços e execução

### Regra: topologia local

**Nível:** MUST

**Regra:** `docker compose up` deve poder iniciar PostgreSQL, bot e site com rede interna, variáveis documentadas e dependências verificadas por readiness. O banco usa volume persistente nomeado; código-fonte montado como volume é opção apenas do perfil de desenvolvimento.

**Motivo:** torna o ambiente reproduzível e diferencia persistência de build.

### Regra: topologia Railway

**Nível:** SHOULD

**Regra:** Implante inicialmente três serviços separados: um processo `site`, um processo `bot` e PostgreSQL gerenciado pela Railway. Não agrupe bot e site no mesmo container e não divida módulos internos em novos serviços sem métricas ou requisito de isolamento.

**Motivo:** mantém isolamento de falhas e deploy independente sem custo de microsserviços desnecessários.

**Exceções:** um plano Railway comprovadamente mais econômico pode agrupar processos apenas após medir memória, garantir supervisão/sinais e documentar o acoplamento de deploy.

### Regra: migrations em produção

**Nível:** MUST

**Regra:** Execute migrations uma única vez em etapa de pre-deploy/release com lock ou mecanismo equivalente. Não rode migrations concorrentes em cada réplica e não aceite alteração destrutiva sem estratégia de compatibilidade/rollback.

**Motivo:** evita corrida, indisponibilidade e schema parcialmente aplicado.

## 4. Orçamento de recursos

O limite arquitetural é aproximadamente 500 MB de RAM. Enquanto o limite exato por serviço/plano não estiver registrado, trate 500 MB como teto por processo implantável e também acompanhe o consumo agregado que afeta custo. Se PostgreSQL compartilhar o mesmo limite, ele entra no cálculo.

### Regra: margem contra OOM

**Nível:** MUST

**Regra:** Nenhum serviço deve ser projetado para ocupar permanentemente o teto. Mire uso estável de no máximo 70% do limite aplicável e picos observados abaixo de 90%, reservando o restante para runtime, GC e rajadas. Mudanças que cruzem esses limiares exigem medição, perfil e plano de redução antes de produção.

**Motivo:** OOM mata processos sem encerramento confiável.

**Exceções:** limiares podem ser ajustados após registrar medições representativas, configuração Railway e margem equivalente.

### Regra: processamento limitado

**Nível:** MUST

**Regra:** Toda coleção, fila, cache, batch, retry, collector, timer e operação concorrente de longa duração possui limite e política de expiração/backpressure. Não carregue tabela inteira nem arquivo grande em memória quando paginação, cursor, streaming ou batches pequenos resolvem.

**Motivo:** impede crescimento não limitado e picos multiplicativos.

### Regra: avaliação de feature pesada

**Nível:** MUST

**Regra:** Antes de implementar feature que adiciona worker, fila, cache, upload, processamento de imagem, dataset grande ou dependência pesada, estime RAM, CPU, concorrência, conexões, payload máximo e comportamento de falha. Registre medição antes/depois quando o impacto puder ser relevante.

**Motivo:** recursos são parte do contrato de produção.

### Regra: concorrência e event loop

**Nível:** SHOULD

**Regra:** Defina limites explícitos por workload, processe batches pequenos e nunca use `Promise.all` sobre entrada não limitada. Trabalho CPU-bound ou longo não deve bloquear requests nem eventos do bot; mova-o para job controlado somente quando houver necessidade comprovada.

**Exceções:** coleções pequenas com limite estrutural documentado podem usar execução paralela direta.

### Regra: caches

**Nível:** SHOULD

**Regra:** Prefira cache externo ou cache local pequeno com tamanho máximo, TTL e métrica de hit/miss. Não use objeto global como fonte de verdade; invalide por evento/versão quando consistência importar.

**Motivo:** cache local desaparece no restart e diverge entre processos/shards.

### Regra: processos e workers

**Nível:** SHOULD

**Regra:** Comece com um processo por serviço, sem cluster ou worker extra. Adicione concorrência somente após medir gargalo e recalcular memória e conexões PostgreSQL.

## 5. Docker e Compose

### Regra: builds reproduzíveis e mínimos

**Nível:** MUST

**Regra:** Cada app implantável usa Dockerfile multi-stage, versão major/minor de Node fixada, instalação pelo lockfile e estágio final com apenas artefatos e dependências de produção. Execute como usuário não-root. O build deve falhar se o lockfile estiver inconsistente.

**Motivo:** reduz imagem, superfície de ataque e variação entre ambientes.

### Regra: contexto e `.dockerignore`

**Nível:** MUST

**Regra:** O contexto pode ser a raiz para permitir packages do monorepo, mas `.dockerignore` exclui no mínimo `.git`, `node_modules`, outputs, caches, coverage, logs, `.env*` não exemplares, uploads e assets-fonte não usados. Nunca dependa de copiar segredo no build.

**Motivo:** contexto grande aumenta tempo, cache miss e risco de vazamento.

### Regra: cache de camadas

**Nível:** SHOULD

**Regra:** Copie manifests/lockfile antes do código, instale dependências em camada cacheável e use pruning/foco do workspace quando suportado. Meça tamanho comprimido e descompactado da imagem ao alterar dependências ou base.

### Regra: sinais e encerramento

**Nível:** MUST

**Regra:** O processo da aplicação deve ser PID 1 via `exec`, receber `SIGTERM`/`SIGINT`, parar de aceitar trabalho, encerrar collectors/jobs, aguardar operações com timeout e fechar pool/conexões. Não use shell wrapper que absorva sinais.

### Regra: health e readiness

**Nível:** SHOULD

**Regra:** Site expõe endpoint HTTP leve de liveness e, se necessário, readiness que verifica dependências com timeout curto. O bot só expõe endpoint quando a plataforma exigir; caso contrário reporte readiness de forma leve. Health check não executa query cara nem vaza configuração.

### Regra: Compose por ambiente

**Nível:** SHOULD

**Regra:** Compose base contém definições comuns; overrides/profiles de desenvolvimento adicionam bind mounts e comandos dev. Produção não usa hot reload, bind mount de código ou banco publicado para a internet.

### Regra: persistência, redes e restart

**Nível:** MUST

**Regra:** Só PostgreSQL e storages explicitamente duráveis usam volumes. Serviços conversam por rede privada e nomes DNS internos; exponha ao host apenas portas necessárias. Em produção, use política de restart limitada/da plataforma, nunca loop que oculte erro de configuração.

### Regra: configuração no runtime

**Nível:** MUST

**Regra:** Injete configuração e secrets no runtime por variáveis/secret store Railway. Valide schema no startup, falhe cedo com mensagem sem valor secreto e mantenha `.env.example` apenas com nomes e exemplos inofensivos.

## 6. PostgreSQL e `packages/database`

### Regra: acesso centralizado

**Nível:** MUST

**Regra:** Browser nunca acessa PostgreSQL. Site e bot chamam a API pública de `packages/database` em código server-side. Repositories/queries retornam modelos explícitos e selecionam somente colunas necessárias.

### Regra: queries seguras

**Nível:** MUST

**Regra:** Use queries parametrizadas ou query builder que parametrize valores. Identificadores dinâmicos vêm de allowlist; nunca concatene entrada em SQL. SQL arbitrário não será oferecido no dashboard.

### Regra: integridade no banco

**Nível:** MUST

**Regra:** Invariantes persistentes usam `NOT NULL`, `CHECK`, `UNIQUE`, foreign keys e tipos adequados. Índices acompanham foreign keys e padrões reais de filtro/ordenação; cada índice tem query justificadora.

**Motivo:** TypeScript e validação de request não protegem writers concorrentes.

### Regra: migrations versionadas

**Nível:** MUST

**Regra:** Toda mudança de schema, role, privilege, policy ou seed obrigatório é migration revisável, determinística e versionada. Migration aplicada não é editada; crie migration corretiva. Mudanças destrutivas usam expand/migrate/contract e plano de backup/restore quando aplicável.

### Regra: RLS deny-by-default

**Nível:** MUST

**Regra:** Considere RLS obrigatória para dados privados, por usuário, guild/servidor, organização, tenant ou nível de acesso. Habilite e force RLS quando compatível, crie policies específicas por operação e valide isolamento com testes negativos. Ausência de policy deve negar, não liberar.

**Motivo:** RLS é defesa adicional contra falha no código da aplicação.

**Exceções:** tabela pública, referência global ou estritamente interna pode dispensar RLS com justificativa no schema/migration e revisão de segurança.

### Regra: contexto de RLS

**Nível:** MUST

**Regra:** Identidade usada por policy deriva da sessão confiável no servidor e é aplicada no escopo de uma transação (`SET LOCAL` ou mecanismo equivalente), nunca de campo enviado pelo cliente. Limpe o contexto ao devolver conexão ao pool.

### Regra: privilégios mínimos

**Nível:** MUST

**Regra:** Separe role de migration/owner da role de runtime. Runtime não possui DDL, ownership, superuser, `BYPASSRLS`, `CREATEROLE`, `CREATEDB`, `TEMP` nem acesso a objetos desnecessários. Site e bot usam roles distintas quando suas capacidades diferirem. A credencial de migration existe apenas no job de release e nunca entra no ambiente dos processos site/bot.

### Regra: hardening de schema e funções

**Nível:** MUST

**Regra:** Migrations removem de `PUBLIC` privilégios implícitos não necessários, inclusive `CREATE` no schema `public`, e configuram `ALTER DEFAULT PRIVILEGES` para cada owner; runtime recebe grants explícitos. Objetos da aplicação ficam em schema não gravável pela role runtime, cujo `search_path` é fixo e contém somente schemas confiáveis, com `pg_catalog` primeiro. Função `SECURITY DEFINER` é excepcional: referências qualificadas, `search_path` seguro definido na própria função, owner sem login quando viável, `EXECUTE` revogado de `PUBLIC` e concedido apenas às roles necessárias.

**Motivo:** impede shadowing de objetos, execução pública acidental e escalada por defaults permissivos.

### Regra: pooling limitado

**Nível:** MUST

**Regra:** Crie um pool por processo, reutilize-o e feche no shutdown. Comece com limites conservadores (referência: site até 5 e bot até 3 conexões por instância), some todas as réplicas e reserve conexões operacionais antes de aumentar. Configure timeout de aquisição, conexão, statement e transação ociosa.

**Exceções:** valores não são constantes universais; ajuste apenas com métricas de fila, latência, memória e limite real do PostgreSQL.

### Regra: transações e concorrência

**Nível:** MUST

**Regra:** Operações multi-etapa que precisam ser atômicas usam transação curta. Não faça chamadas externas dentro da transação. Use constraint, lock/advisory lock ou concorrência otimista conforme o invariante; retries de serialization/deadlock têm limite e jitter.

### Regra: idempotência e auditoria

**Nível:** SHOULD

**Regra:** Mutations administrativas, webhooks, jobs e comandos reexecutáveis usam chave/idempotency guard quando duplicação causar dano. Registre auditoria de ação, ator confiável, alvo, resultado e timestamp, sem tokens nem payload sensível completo.

### Regra: performance de queries

**Nível:** SHOULD

**Regra:** Paginar com limite máximo, evitar N+1 por join/batching e analisar queries lentas com `EXPLAIN (ANALYZE, BUFFERS)` em dados representativos. Não aplique cache para mascarar query sem índice.

## 7. Dashboard Next.js, autenticação e UI

### Regra: server-first

**Nível:** SHOULD

**Regra:** Use App Router e Server Components por padrão. Adicione `"use client"` somente no menor componente que precise de estado, efeito ou API do browser. Banco, secrets, OAuth tokens e autorização permanecem em módulos `server-only`.

### Regra: fronteira de mutations

**Nível:** MUST

**Regra:** Route Handlers e Server Actions tratam entrada como `unknown`, validam schema/tamanho, autenticam, autorizam por recurso/ação e só então chamam caso de uso/repository. Middleware pode otimizar navegação, mas não substitui essas verificações.

### Regra: identidade Discord

**Nível:** MUST

**Regra:** Discord OAuth autentica identidade; não concede autorização sozinho. Gere `state` com CSPRNG, vincule-o à sessão/transação que iniciou o login, defina expiração e consuma-o atomicamente uma única vez no callback. Aceite somente a redirect URI exata cadastrada/configurada, solicite scopes mínimos e troque o authorization code exclusivamente no servidor. Use PKCE com `S256` quando o fluxo/biblioteca suportar; use `nonce` somente se houver OIDC real com `id_token`, não em OAuth 2.0 puro. Após o token exchange bem-sucedido, obtenha o `discordId` no servidor pela resposta de identidade do Discord autenticada (por exemplo, endpoint de usuário com o access token), valide seu schema e crie a sessão; não confie em ID do cliente nem decodifique token opaco como prova de identidade.

### Regra: autorização do criador

**Nível:** MUST

**Regra:** `CREATOR_DISCORD_ID` é identificador, não segredo, mas fica em configuração server-side. Preserve-o como string decimal canônica de Snowflake (`^[1-9][0-9]{16,19}$`), sem conversão para `number`; configuração ausente ou inválida falha no startup. Cada operação exclusiva compara esse ID com o `discordId` canônico da sessão no servidor. Export, mutation destrutiva ou ação de grande alcance exige autenticação recente ou step-up/reautenticação e registra auditoria. Alterar o ID ou versão da policy revoga/invalida todas as sessões privilegiadas existentes. Página oculta, botão desabilitado, middleware ou claim produzido pelo browser não autoriza. Centralize a policy para permitir evolução futura a RBAC sem implementar RBAC antecipadamente.

### Regra: sessões e tokens

**Nível:** MUST

**Regra:** Use sessão server-side revogável com token opaco aleatório; armazene somente o hash desse token no store. Em produção, envie-o em cookie com prefixo `__Host-`, `HttpOnly`, `Secure`, `Path=/`, sem `Domain` e `SameSite=Lax` ou mais restritivo. Regenere token/ID após callback OAuth e após elevação de privilégio; aplique timeout absoluto e de inatividade, rotação e revogação no logout. Com múltiplas réplicas, o store e a revogação precisam ser compartilhados. Armazene access/refresh token Discord somente se uma feature server-side o exigir, criptografado e com retenção mínima; nunca o envie ao client nem registre.

### Regra: CSRF

**Nível:** MUST

**Regra:** Mutations autenticadas por cookie aceitam apenas métodos não seguros apropriados, exigem `Origin` igual à origem pública canônica configurada e usam proteção CSRF da biblioteca/framework ou token explícito quando a proteção embutida não cobrir o fluxo. Não derive a origem esperada de `Host`/`X-Forwarded-*` fornecidos livremente; aceite forwarded headers somente de proxies Railway explicitamente confiáveis e normalize protocolo/host/porta antes da comparação. `GET` não altera estado.

### Regra: fetching e memória

**Nível:** MUST

**Regra:** Toda listagem server-side usa seleção mínima, filtro e paginação com teto. Não mantenha dataset, sessão, resposta grande ou cache ilimitado em global. Use streaming/loading boundaries quando reduzirem pico e latência; não crie job permanente no processo web.

### Regra: cache Next.js

**Nível:** SHOULD

**Regra:** Declare conscientemente política de cache/revalidation. Dados privados ou autorizados não compartilham cache entre usuários sem chave segura; após mutation invalide as tags/rotas pertinentes. Não presuma que cache em memória sobrevive ou é comum entre instâncias.

### Regra: erros no frontend

**Nível:** MUST

**Regra:** Retorne ao cliente código e mensagem segura; detalhes e correlação ficam no log server-side. Diferencie 401, 403, 404, 409, 422, 429 e 5xx sem revelar existência de recurso quando isso quebrar isolamento.

### Regra: componentes React

**Nível:** SHOULD

**Regra:** Componentes apresentam e compõem; casos de uso e policies ficam fora deles. Prefira estado local derivado a estado duplicado, efeitos somente para sincronizar sistemas externos, formulários com labels/erros/foco e componentes acessíveis por teclado. Divida componente quando misturar responsabilidades, não por contagem arbitrária de linhas.

### Regra: Tailwind

**Nível:** SHOULD

**Regra:** Reutilize tokens de cor, tipografia, espaçamento e estados; extraia componente/variante quando um conjunto de classes representa o mesmo conceito repetido. Preserve contraste, foco visível, responsividade e reduced motion. Não crie classe semântica global para esconder lógica de autorização.

## 8. Segurança transversal

### Regra: entrada não confiável

**Nível:** MUST

**Regra:** Valide em runtime toda entrada de HTTP, OAuth, Discord, banco legado, fila, arquivo e serviço externo. TypeScript não valida runtime. Use `unknown`, schema, narrowing e limites de comprimento/faixa/enum; rejeite campos inesperados em objetos sensíveis.

### Regra: autorização por operação e recurso

**Nível:** MUST

**Regra:** A camada server-side verifica identidade, papel/capacidade, ownership/tenant e ação em toda leitura e mutation protegida. A query também deve restringir pelo tenant/recurso em vez de buscar globalmente e filtrar depois.

### Regra: secrets

**Nível:** MUST

**Regra:** Nunca versione, exponha ao bundle client, retorne, mostre em screenshot ou registre tokens, senhas, cookies, strings de conexão, client secrets ou webhook URLs. Rotacione imediatamente segredo suspeito de exposição e remova-o do histórico conforme procedimento aprovado.

### Regra: XSS e conteúdo ativo

**Nível:** MUST

**Regra:** Renderize texto com escaping padrão. Não use `dangerouslySetInnerHTML` nem aceite HTML/Markdown ativo sem sanitizador bem mantido e policy explícita. Aplique CSP compatível e evite scripts inline quando possível.

### Regra: SSRF e chamadas externas

**Nível:** MUST

**Regra:** URL fornecida pelo usuário não é buscada livremente pelo servidor. Faça parse/normalização estritos, rejeite credenciais embutidas e aplique allowlist de protocolo, host e porta. Em cada conexão e redirect, resolva todos os endereços A/AAAA, normalize IPv4, IPv6 e IPv4-mapped IPv6 e rejeite o destino se qualquer endereço cair em loopback, privado/unique-local, link-local, multicast, não especificado, reservado ou metadata. Revalide cada hop e limite redirects; fixe a conexão a um IP já validado (preservando Host/SNI) ou use cliente/proxy que impeça nova resolução para evitar DNS rebinding/TOCTOU. Defina timeout, limite de bytes e concorrência e, quando disponível, confirme que o peer conectado continua permitido.

### Regra: uploads

**Nível:** MUST

**Regra:** Só implemente upload com necessidade explícita. Limite tamanho, quantidade e tipo por assinatura real; gere nome próprio, armazene fora da árvore executável e sirva como conteúdo não executável. Não confie em extensão ou `Content-Type` informado.

### Regra: rate limit e abuso

**Nível:** SHOULD

**Regra:** Endpoints de autenticação, mutations, busca cara e ações administrativas usam limite por identidade e origem, com teto e janela documentados. Um limiter local deve ter tamanho/TTL e serve apenas a instância única/baixo risco; proteção distribuída é necessária quando múltiplas instâncias ou alto impacto justificarem.

### Regra: dependências de segurança

**Nível:** MUST

**Regra:** Não reimplemente criptografia, OAuth, sessão ou sanitização crítica para economizar dependência. Use biblioteca mantida, fixe versões pelo lockfile, revise advisories e atualize com testes. Scripts de instalação de nova dependência também entram na revisão.

### Regra: least privilege operacional

**Nível:** MUST

**Regra:** Restrinja permissões Discord, scopes OAuth, roles PostgreSQL, acesso Railway, rede, filesystem e tokens ao mínimo necessário. Ambientes usam credenciais distintas.

### Regra: resposta a erro

**Nível:** MUST

**Regra:** Falhe fechado em autenticação/autorização/configuração inválida. Não inclua stack, SQL, caminho interno, token ou dados pessoais em resposta pública. Atribua correlation ID seguro para diagnóstico.

## 9. Discord Bot sob regras globais

Desenvolvimento específico do bot pertence à skill existente `.agents/skills/discordbot-developer`; não replique aqui detalhes de commands, components, Gateway ou limites do Discord.

### Regra: skill especializada

**Nível:** MUST

**Regra:** Toda alteração específica de discord.js consulta e segue `discordbot-developer`, além deste arquivo. Use apenas bot accounts e APIs oficiais; self-bot é proibido.

### Regra: memória do bot

**Nível:** MUST

**Regra:** Justifique intents, partials e caches; limite sweepers/cache managers, collectors, listeners, timers, filas e dados temporários. Collector temporário sempre possui timeout/idle/condição de encerramento. Cache miss não deve ser tratado automaticamente como inexistência.

### Regra: estado distribuído

**Nível:** MUST

**Regra:** Não use memória do processo como estado autoritativo que bot, site, shards ou réplicas precisem compartilhar. Persista estado durável no banco e modele idempotência/lock para concorrência.

### Regra: ciclo de vida

**Nível:** MUST

**Regra:** No startup, valide config e conexão antes de declarar readiness. No shutdown, pare de aceitar trabalho, encerre timers/collectors, destrua client Discord e feche pool com timeout.

## 10. TypeScript, contratos e configuração

### Regra: tipos estritos

**Nível:** SHOULD

**Regra:** Habilite modo strict. Evite `any`; entrada incerta começa como `unknown` e é narrowed. Cast (`as`) exige prova local que o compilador não expressa; non-null assertion não substitui validação.

### Regra: contratos em uma origem

**Nível:** MUST

**Regra:** Cada payload compartilhado possui schema/runtime contract canônico que produz ou acompanha seu tipo TypeScript. Não duplique enum, constante de domínio ou shape entre bot/site/database.

### Regra: nullabilidade explícita

**Nível:** SHOULD

**Regra:** Diferencie ausente, nulo e vazio no contrato. Normalize nas fronteiras e não faça fallback silencioso para valor que altere permissão ou ownership.

### Regra: configuração tipada

**Nível:** MUST

**Regra:** Cada processo valida todas as variáveis necessárias no startup e exporta objeto imutável tipado. Código de feature não lê `process.env` diretamente. Variáveis públicas usam prefixo explícito do framework e nunca contêm segredo.

## 11. APIs, erros, observabilidade e resiliência

### Regra: contratos HTTP

**Nível:** SHOULD

**Regra:** Documente método, autenticação, schema, códigos, paginação, idempotência e limite de payload para cada API. Versione mudança incompatível ou faça rollout compatível entre produtores e consumidores.

### Regra: logs estruturados

**Nível:** MUST

**Regra:** Em produção emita JSON estruturado para stdout/stderr com timestamp, nível, serviço, evento e correlation/request/job ID. Não grave arquivo local. Redija secrets, cookies, tokens, headers de autorização, string de conexão e dados pessoais desnecessários.

### Regra: níveis e volume

**Nível:** SHOULD

**Regra:** `error` exige ação/falha, `warn` indica degradação, `info` cobre eventos de ciclo/negócio relevantes e `debug` fica desativado por padrão em produção. Não logue cada linha/objeto de batch nem heartbeat frequente.

### Regra: timeouts e retries

**Nível:** MUST

**Regra:** Toda chamada externa e aquisição de recurso possui timeout. Retry somente falhas transitórias e operações idempotentes, com máximo de tentativas, exponential backoff e jitter; respeite `Retry-After`. Não retry erros de validação/autorização.

### Regra: degradação controlada

**Nível:** SHOULD

**Regra:** Falha de dependência deve produzir erro claro e limitado, sem fila em memória crescente. Circuit breaker só é introduzido se métricas demonstrarem cascata; prefira inicialmente timeout, limite de concorrência e backoff.

### Regra: métricas leves

**Nível:** SHOULD

**Regra:** Acompanhe RSS/heap, event-loop lag, reinícios/OOM, latência/erros, pool ativo/em espera, queries lentas, fila e cache. Use recursos nativos/Railway ou endpoint leve; não adicione stack de observabilidade pesada sem orçamento.

## 12. Assets em `Pictures/`

### Regra: finalidade e organização

**Nível:** MUST

**Regra:** `Pictures/` armazena apenas fontes/assets do projeto, organizados por uso e com nomes kebab-case descritivos. Não é storage de upload, cache, IPC entre serviços nem banco de dados.

### Regra: otimização e distribuição

**Nível:** SHOULD

**Regra:** Prefira SVG para vetores seguros e WebP/AVIF para raster quando compatível; comprima, remova metadata desnecessária e defina dimensões. Copie para o build/imagem somente assets usados pela aplicação.

### Regra: proveniência e limpeza

**Nível:** MUST

**Regra:** Asset externo precisa de licença/proveniência compatível registrada. Remova duplicados e assets não utilizados após confirmar referências; não versione artefatos temporários ou exportações enormes.

## 13. Dependências e performance

### Regra: nova dependência

**Nível:** SHOULD

**Regra:** Antes de adicionar pacote, verifique capacidade nativa/existente, manutenção, licença, advisories, footprint instalado/runtime, tree-shaking, compatibilidade e impacto no Docker. Registre a razão em PR/commit quando não for óbvia.

**Exceções:** bibliotecas críticas de segurança são escolhidas pela correção e manutenção, não apenas pelo tamanho.

### Regra: performance mensurável

**Nível:** SHOULD

**Regra:** Otimize a partir de orçamento, query plan, profile ou métrica. Primeiro reduza dados, round trips, N+1, serialização, cópias e concorrência; não introduza arquitetura complexa para ganho hipotético.

### Regra: payloads

**Nível:** MUST

**Regra:** Defina limite de entrada e saída. Listagens paginam, exports usam streaming/batches e respostas omitem campos desnecessários. Comprima na borda quando apropriado sem manter buffers duplicados.

## 14. Desenvolvimento, testes e Git

### Regra: comandos padronizados

**Nível:** SHOULD

**Regra:** A raiz fornece comandos consistentes para install, dev, build, typecheck, lint, format, test e migrations, com filtros por workspace. CI usa os mesmos comandos e o lockfile.

### Regra: validação proporcional

**Nível:** MUST

**Regra:** Antes de concluir, rode ao menos checks dos módulos alterados. Regra de negócio recebe teste unitário; repository/migration/RLS recebe integração com PostgreSQL real; boundary HTTP/auth recebe teste de integração; fluxo crítico recebe teste end-to-end quando viável. Relate comandos e falhas não relacionadas.

### Regra: testes de segurança

**Nível:** MUST

**Regra:** Para autorização e RLS, teste também usuário ausente, usuário errado, tenant diferente, payload adulterado e role sem privilégio. Com a role runtime real, confirme falha de `CREATE`/DDL, acesso cross-tenant, chamada de função não concedida, bypass por `search_path` e acesso após revogação; valide defaults/grants após migrations. Para OAuth/sessão, cubra replay/expiração de `state`, redirect URI divergente, rotação, timeout e sessão privilegiada revogada. Teste positivo sozinho é insuficiente.

### Regra: testes herméticos

**Nível:** SHOULD

**Regra:** Testes não dependem de produção, horário/rede reais ou ordem. Isole estado, use fixtures mínimas e não use token Discord real. Integração externa é mockada salvo teste manual autorizado em ambiente dev.

### Regra: lint e formatação

**Nível:** SHOULD

**Regra:** Formatação é automática; lint cobre imports, promises, tipos inseguros e fronteiras quando configurável. Não desative regra global para corrigir um arquivo; exceção local inclui motivo.

### Regra: Git focado

**Nível:** SHOULD

**Regra:** Commits são pequenos, coerentes e em modo imperativo; não misture arquivos gerados, refactor e feature sem necessidade. Nunca reescreva ou descarte mudanças alheias sem autorização. Não versione secrets, `.env`, dumps, logs, coverage ou outputs.

### Regra: documentação e decisões

**Nível:** SHOULD

**Regra:** Atualize README/env example/contrato quando comportamento operacional mudar. Decisão transversal ou trade-off duradouro recebe ADR curto com contexto, decisão, alternativas e consequências.

### Regra: comentários, TODO e dead code

**Nível:** SHOULD

**Regra:** Comentários explicam motivo/invariante, não repetem código. TODO inclui ação concreta e issue/responsável quando possível. Remova código/import/dependência morto em vez de comentar; preserve compatibilidade apenas com prazo e teste.

### Regra: ambientes

**Nível:** MUST

**Regra:** Development, staging e production têm credenciais, bancos e OAuth callbacks separados. Produção não habilita debug, seed de teste, hot reload ou fallback inseguro. Configuração ausente causa falha no startup.

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

## 16. Skills e divisão de responsabilidade

As skills complementam, mas não substituem, este arquivo. Cada `SKILL.md` deve declarar triggers, quando não usar, arquivos relevantes, responsabilidades, workflow, checklists de segurança/recursos/validação e integração com outras skills. Não crie uma skill por tecnologia nem replique texto global.

Domínios recomendados, desde que as respectivas skills existam:

- `discordbot-developer`: discord.js, Gateway, commands, interactions e limites oficiais. É a autoridade específica do bot.
- `project-architect`: fronteiras, dependências, ADRs e mudanças transversais; não implementa detalhes de cada domínio.
- `database-developer`: schema, migrations, query/repository, roles, RLS, pooling e análise SQL.
- `nextjs-dashboard-developer`: App Router, React, Tailwind, rotas/actions e integração da autenticação; policies continuam server-side.
- `docker-railway-developer`: Dockerfiles, Compose, Railway, builds, health, shutdown e orçamento operacional.
- `security-reviewer`: threat model e revisão transversal de auth, API, banco, Discord, containers e deploy; revisa, não toma posse automática de toda implementação.
- `testing-auditor`: estratégia e verificação independente de testes, regressões, integração, segurança e consumo.

### Regra: skill principal e consulta

**Nível:** MUST

**Regra:** A tarefa tem uma skill principal pelo artefato alterado. Consulte outra quando cruzar sua fronteira: migration para feature do bot é liderada por database com consulta ao Discord; OAuth/admin é liderado por dashboard com revisão de segurança; container do bot é liderado por infraestrutura com consulta ao Discord. Em conflito, valem este arquivo e a skill proprietária do domínio afetado; decisão transversal sobe ao arquiteto/humano.

### Regra: evitar duplicação entre skills

**Nível:** MUST

**Regra:** Skill especializada referencia a seção global aplicável e adiciona procedimento, critérios e ferramentas do seu domínio. Não copie regras globais nem crie skill equivalente a `discordbot-developer`.

## 17. Definition of Done global

Antes de encerrar qualquer mudança, confirme o que for aplicável:

- [ ] Escopo resolvido sem alterações alheias ou arquitetura paralela.
- [ ] Direção de dependências e APIs públicas respeitadas; nenhum ciclo novo.
- [ ] Entradas externas validadas em runtime e erros públicos sanitizados.
- [ ] Autenticação, autorização e ownership revalidados no servidor.
- [ ] Secrets ausentes de código, client bundle, logs e artefatos Docker.
- [ ] Queries parametrizadas, seletivas e sem N+1; RLS/privileges revisados quando aplicável.
- [ ] Pools, filas, caches, collectors, batches e concorrência possuem limites.
- [ ] Impacto de RAM/CPU/processos/conexões/imagem avaliado para mudança relevante.
- [ ] Startup, health/readiness, timeout, retry e graceful shutdown continuam corretos.
- [ ] Typecheck, lint, testes proporcionais e build do módulo alterado executados.
- [ ] Casos negativos de autorização/RLS cobertos quando aplicável.
- [ ] Migration é compatível, serializada e possui estratégia operacional.
- [ ] Documentação, `.env.example`, contratos e ADR atualizados quando necessário.
- [ ] Dependências novas foram justificadas e avaliadas por segurança/footprint/licença.
- [ ] Resultado informa arquivos alterados, validações executadas, riscos e suposições.
