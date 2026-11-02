# Fonte do catálogo de commands

## Contexto

O bot precisava exibir seus commands em dois lugares novos, `/help` e a página `/comandos` do site, sem que alguém mantivesse uma lista à mão. O site é outro processo e outro contêiner, e não importa nada de `apps/bot` (ver [site.md](../project/site.md)).

## Decisão

Em 1º de novembro de 2026 ficou assim:

- A documentação nasce no próprio command: descrição (a do `SlashCommandBuilder`), `help.topic` e `examples` com slash e prefixo, obrigatórios no loader. O prefixo `k!` já valia para todo command, então não é opção; os exemplos precisam mostrá-lo.
- O `/help` sem argumento é paginado: a página 1 traz os tópicos com a contagem de commands e as demais percorrem os commands por tópico (6 por página), com botões de seta. A navegação não guarda estado no processo: o `custom_id` `kt:help:<página>:<id de quem abriu>` basta, o clique edita a mensagem (`update`) e só o dono navega. Os emojis (tópicos, setas, seções) vêm do catálogo oficial pelo resolver, com alternativa Unicode, e o `custom_id` não muda. `/help <comando>` mostra o detalhe, sem botões.
- O `/help` lê a lista viva que o `CommandsHandler` monta dos commands carregados (`buildCatalog`, sem commands de equipe) e injeta em `context.commandCatalog`.
- O site lê `packages/command-catalog/catalog.js`, gerado por `scripts/commands-catalog.mjs` (executa o código do bot com `tsx`) a cada `npm run site build` e `npm run typecheck`. O pacote compartilhado guarda também os tópicos (`public`, `utility`, `fun`, `mod`, `dev`).
- O tópico acompanha a pasta: `mod/` exige `mod`, `dev/` exige `dev`, `public/` aceita `public`, `utility` ou `fun`. Commands de equipe não entram no catálogo.

## Impacto

- Command novo ou alterado aparece em `/help`, no site e no Discord sem outra edição; o arquivo gerado é versionado e deve ir junto da mudança.
- Command sem tópico, sem exemplos ou com exemplo de outro endereço impede o startup do bot.

## Controles

- O loader rejeita documentação ausente ou incoerente (`tests/command-help.test.ts`).
- O build do site e o typecheck regeneram o arquivo, então uma versão antiga commitada não chega à imagem Docker nem ao typecheck.

## Condição de revisão

Reavaliar se o site precisar de dados do bot que mudam em tempo de execução (por exemplo, contagem de usos): aí o catálogo estático deixa de bastar.
