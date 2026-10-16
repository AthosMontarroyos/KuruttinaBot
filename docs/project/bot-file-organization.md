# Organização dos arquivos do bot

Guia prático de `apps/bot/src/`. A regra obrigatória de descoberta está em [Discord bot](../agents/discord-bot.md#regra-categorias-de-commands). A decisão está no [ADR do catálogo](../decisions/command-catalog-layout.md).

## Árvore

```text
apps/bot/src/
├── commands/
│   ├── dev/
│   ├── mod/
│   └── public/
├── command-system/
│   ├── types.ts
│   ├── access.ts
│   ├── loadCommands.ts
│   ├── CommandsHandler.ts
│   └── responses.ts
├── application/
├── infrastructure/
│   ├── discord/
│   │   ├── commands/
│   │   │   ├── deployCommands.ts
│   │   │   └── commandContext.ts
│   │   ├── moderation/
│   │   │   ├── clearAdapter.ts
│   │   │   └── memberModerationAdapter.ts
│   │   ├── emojis/
│   │   │   ├── emojiAdapter.ts
│   │   │   ├── emojiAdd.ts
│   │   │   ├── emojiInfo.ts
│   │   │   └── emojiLookup.ts
│   │   └── identity.ts
│   ├── images/
│   └── logging/
├── events/
├── deployments/
└── handlers/
    └── DeploymentsHandler.ts
```

`application/`, eventos, deployments e `DeploymentsHandler` permanecem onde estão.

## Responsabilidades

- `commands/`: só módulos registráveis. Cada arquivo executável exporta um comando.
- `command-system/`: contrato, autorização, descoberta, despacho e montagem de resposta (`withEmojis`).
- `infrastructure/`: Discord, imagens e logs. `deployCommands.ts` só publica. `emojiAdd.ts` é o executor da importação de emoji no servidor. `emojiInfo.ts` e `emojiLookup.ts` consultam um emoji sem importá-lo. Application Emojis de production ficam no workflow descrito em [Emojis de produção](emojis-prod.md).
- `application/`: casos de uso, sem conhecer commands nem adapters.
- `events/` e `deployments/`: composição dos transports e dos deploys. `bootstrap.ts` continua sendo o composition root.

## Direção das dependências

```text
commands/  →  command-system/
           →  application/
           →  infrastructure/   (adapter usado pelo comando)

infrastructure/  →  command-system/   (portas)
                 →  application/      (portas)

command-system/  →  infrastructure/logging/   (log command_loaded)
```

`command-system/` não importa módulos de `commands/` nem adapters Discord. `application/` não importa `commands/`, `command-system/` nem `infrastructure/`. A descoberta usa `import()` dinâmico a partir da raiz do catálogo. Não há reexport de compatibilidade nos caminhos antigos.

## Onde adicionar

| O que | Onde |
| --- | --- |
| Comando público | `commands/public/`, política `public`, escopo `global` |
| Comando de moderação | `commands/mod/`, política `guild`, escopo `global` |
| Comando da equipe | `commands/dev/`, política `staff`, escopo `dev-guild` |
| Executor compartilhado por mais de um comando | `infrastructure/`, ao lado do adapter da operação |
| Adapter Discord, imagem ou log | `infrastructure/discord/`, `infrastructure/images/` ou `infrastructure/logging/` |
| Caso de uso | `application/` |
| Teste | `tests/`, nunca dentro de `commands/` |

Subpastas dentro de `dev/`, `mod/` e `public/` são permitidas. A categoria continua sendo o primeiro segmento: `mod/public/comando.ts` ainda é `mod/`.

Todo código executável dentro das categorias participa da descoberta. Nomes como `types.ts` e `access.ts` não recebem tratamento especial. Markdown, `.d.ts` e source maps são ignorados. Um arquivo executável na raiz de `commands/` ou em outra pasta impede o startup antes da importação.
