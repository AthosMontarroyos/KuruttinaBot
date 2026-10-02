# Organização do catálogo de comandos

## Contexto

O loader descobria qualquer módulo executável sob `commands/` e ignorava helpers por nome (`types`, `access`, `loadCommands`, `emojiAdd`). Um arquivo novo na raiz, ou um helper com outro nome dentro de uma categoria, podia entrar no catálogo ou passar despercebido. Comando, mecanismo de execução e integração Discord também dividiam os mesmos diretórios.

## Decisão

Em 2 de outubro de 2026, a organização proposta nesta conversa foi aceita. Commands registráveis ficam só em `commands/dev/`, `commands/mod/` e `commands/public/`. O mecanismo fica em `command-system/`. Integrações ficam em `infrastructure/`. Arquivo executável fora das três categorias impede o startup. A categoria, a política e o escopo precisam concordar.

## Impacto

- Imports internos mudam de caminho. Não há reexport de compatibilidade.
- `public/` passa a exigir política `public` e escopo `global`; `mod/` exige `guild` e `global`. Antes, fora de `dev/`, bastava não ser `staff` nem `dev-guild`.
- Helper, executor ou teste colocado dentro de uma categoria deixa de ser ignorado pelo nome e impede o carregamento se não for um comando válido.
- `application/`, eventos, deployments e `DeploymentsHandler` não mudam de lugar.

## Controles

- O caminho é validado antes de importar qualquer módulo. O erro identifica o arquivo e a organização esperada (`dev/`, `mod/` ou `public/`).
- Cada módulo descoberto ainda precisa cumprir o contrato: nome, descrição, uma forma de execução, rotas e aliases válidos, política, escopo e `default_member_permissions` coerente.
- Duplicidade de nome ou alias continua rejeitada pelo catálogo. O log `command_loaded` permanece.
- Falha de localização ou de contrato impede readiness e a publicação de um catálogo parcial. Não há watcher.
- `dev-guild` continua fora do conjunto global. `CommandsHandler` continua recusando política `staff` sem escopo `dev-guild`.

## Condição de revisão

Reavaliar quando surgir uma quarta categoria de publicação com escopo próprio.
