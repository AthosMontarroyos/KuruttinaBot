# Arquitetura e contratos

> Leia este documento somente quando a tarefa envolver este domínio. As regras mantêm os níveis e a semântica do AGENTS.md original.

## 2. Arquitetura de referência

O projeto implementado é um monorepo modular com o bot Discord, `packages/config` e `packages/database`. O site e packages opcionais só passam a existir quando uma feature concreta exigir seu ciclo de vida ou contrato. Bot e futuro site serão processos na mesma aplicação Square Cloud. O n8n é independente e apenas para devs. Veja o [ADR](../decisions/square-cloud-supabase.md) e o [estado implementado](../project/current-state.md).

```text
Arquitetura-alvo (itens ausentes não devem ser criados preventivamente):
/
├── apps/
│   ├── bot/                 # processo discord.js
│   └── site/                # aplicação Next.js App Router
├── packages/
│   ├── database/            # schema, migrations, RLS, client e repositories
│   ├── contracts/           # schemas e contratos realmente compartilhados
│   ├── config/              # leitura e validação de configuração
│   ├── auth/                # somente se autenticação/autorização for reutilizada
│   └── shared/              # utilitários puros e pequenos; não é depósito genérico
├── infra/
│   └── n8n/                 # pacote separado de operação dos devs
├── .agents/skills/          # procedimentos especializados para agentes
├── squarecloud.app          # manifesto único do produto
└── AGENTS.md
```

Diretórios opcionais (`auth`, `shared`) só devem existir quando possuírem conteúdo real. Uma nova aplicação ou serviço exige ciclo de vida, necessidade de deploy ou isolamento operacional próprio; importância de domínio, sozinha, não basta.

### Gatilhos de evolução

- Extraia um caso de uso quando um command/listener adquirir regra de negócio testável além de adaptação e resposta simples.
- Crie `packages/database` somente com a primeira persistência real; schema, migrations, role runtime e teste de integração entram juntos.
- Crie `apps/site` somente com o primeiro fluxo web executável e seu ciclo de vida próprio.
- Introduza capability cross-bot somente com o primeiro command autorizado que a consuma; não exponha o objeto global de credenciais ao command.
- Passe `ASSETS_BASE_URL` ao processo somente quando uma feature de mídia tiver consumidor real.
- Mantenha a abstração de deployments enquanto houver plano concreto de segundo escopo; reavalie-a se continuar com consumidor único.

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
