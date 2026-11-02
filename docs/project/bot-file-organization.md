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
│   ├── commandCatalog.ts
│   ├── helpReply.ts
│   └── responses.ts
├── application/
├── infrastructure/
│   ├── discord/
│   │   ├── commands/
│   │   │   ├── deployCommands.ts
│   │   │   ├── syncCommands.ts
│   │   │   └── commandContext.ts
│   │   ├── moderation/
│   │   │   ├── clearAdapter.ts
│   │   │   ├── memberModerationAdapter.ts
│   │   │   └── modUtils.ts
│   │   ├── emojis/
│   │   │   ├── emojiAdapter.ts
│   │   │   ├── emojiAdd.ts
│   │   │   ├── productionEmojiAdd.ts
│   │   │   ├── emojiInfo.ts
│   │   │   └── emojiLookup.ts
│   │   ├── github/
│   │   │   └── dispatchProductionEmoji.ts
│   │   ├── messages/
│   │   │   ├── actionValues.ts
│   │   │   ├── componentRouter.ts
│   │   │   ├── deliveryPoller.ts
│   │   │   └── toCommandReply.ts
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
- `command-system/`: contrato, autorização, descoberta, despacho e montagem de resposta (`withEmojis`). `commandCatalog.ts` transforma os módulos carregados no catálogo público (`/help` e site) e `helpReply.ts` monta a resposta do `/help`.
- `infrastructure/`: Discord, imagens e logs. `deployCommands.ts` publica e `syncCommands.ts` compara os commands locais com os registrados no Discord, para publicar só a diferença. `emojiAdd.ts` é o executor da importação de emoji no servidor. `productionEmojiAdd.ts` valida a entrada de `/dev emoji add`, deriva o nome quando ele falta e pede o workflow de produção. `emojiInfo.ts` e `emojiLookup.ts` consultam um emoji sem importá-lo. O cliente do GitHub fica em `infrastructure/github/`. `messages/` converte o template renderizado (`toCommandReply.ts`), resolve o clique de botão (`componentRouter.ts`), preenche variáveis de ação (`actionValues.ts`) e entrega a fila pedida pelo painel (`deliveryPoller.ts`). Application Emojis de production ficam no workflow descrito em [Emojis de produção](emojis-prod.md); `dispatchProductionEmoji.ts` só pede a execução.
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

## Criar um command

1. Crie o módulo na pasta da categoria (`public/`, `mod/` ou `dev/`) exportando `command`, com `data` (nome e descrição, e a de cada subcomando), `access`, `scope` e o executor (ou `routes`).
2. Declare `help`: `topic` coerente com a pasta e `examples` de uso com slash e prefixo (1 a 3 pares). Em command com `routes`, `help` leva só o `topic` e cada rota declara seus `examples`. O prefixo `k!` é automático para todo command; os exemplos precisam mostrá-lo.
3. Não há mais nada a registrar: o loader valida a documentação, o `/help` e o startup do bot (que publica no Discord só o que mudou) leem o command carregado, e o site regenera `packages/command-catalog/catalog.js` no próximo `npm run site build` ou `npm run typecheck`. Commite o arquivo gerado com a mudança.

## Onde adicionar

| O que | Onde |
| --- | --- |
| Comando público | `commands/public/`, política `public`, escopo `global`; `help.topic` `public`, `utility` ou `fun` |
| Comando de moderação | `commands/mod/`, política `guild`, escopo `global`, `help.topic` `mod` |
| Comando da equipe | `commands/dev/`, política `staff`, escopo `dev-guild`, `help.topic` `dev` |
| Executor compartilhado por mais de um comando | `infrastructure/`, ao lado do adapter da operação |
| Adapter Discord, imagem ou log | `infrastructure/discord/`, `infrastructure/images/` ou `infrastructure/logging/` |
| Caso de uso | `application/` |
| Teste | `tests/`, nunca dentro de `commands/` |

Subpastas dentro de `dev/`, `mod/` e `public/` são permitidas. A categoria continua sendo o primeiro segmento: `mod/public/comando.ts` ainda é `mod/`.

Todo código executável dentro das categorias participa da descoberta. Nomes como `types.ts` e `access.ts` não recebem tratamento especial. Markdown, `.d.ts` e source maps são ignorados. Um arquivo executável na raiz de `commands/` ou em outra pasta impede o startup antes da importação.
