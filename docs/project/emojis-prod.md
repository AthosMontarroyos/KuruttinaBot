# Emojis de produção

Application Emojis do bot de produção entram só por um workflow manual. A máquina de desenvolvimento não precisa do token desse bot, e o comando `/dev emoji add` não cria o emoji.

## Como adicionar

1. Grave um PNG, GIF ou WEBP de no máximo 256 KiB em `assets/emojis/` e faça o commit na branch que será usada na execução.
2. No GitHub, abra **Actions** → **Adicionar emoji de produção** → **Run workflow**.
3. Informe `name` e `image_path`. O nome tem de 2 a 32 caracteres e só aceita letras, dígitos e `_`. O caminho fica dentro de `assets/emojis/`, por exemplo `assets/emojis/festa.png`.
4. Aprove a execução no ambiente `production`. Sem essa aprovação o job não usa o segredo.

O workflow consulta a aplicação, recusa o nome se ele já existir e só então cria o emoji. Ele não apaga nem substitui. O resumo do job mostra o nome e o ID criados. Uma execução por vez: a concorrência é `emoji-prod`.

Kurutta configura os revisores obrigatórios do ambiente GitHub `production`. O arquivo do workflow só declara `environment: production`; a trava de aprovação fica nessa configuração do ambiente, não no repositório.

## Onde o token fica

`DISCORD_PROD_BOT_TOKEN` é segredo do ambiente `production` no GitHub. Não é segredo do repositório, não entra em `.env` local e não entra no `compose.dev.yaml`. O script mascara o valor e não o imprime.

O contêiner de produção na VPS continua lendo `DISCORD_BOT_TOKEN_PRODUCTION` do `.env` da raiz, pelo `compose.yaml`. Esse arquivo não mudou: o processo de produção ainda precisa do token para o Gateway. Desenvolvimento nativo e o Compose de desenvolvimento exigem só o par `DISCORD_BOT_TOKEN_DEVELOPMENT` / `DISCORD_BOT_ID_DEVELOPMENT`.

## Rotacionar o token antigo

O token de produção que já esteve em máquinas de desenvolvimento deve ser trocado.

1. No Discord Developer Portal, gere um token novo para a aplicação de produção.
2. Atualize `DISCORD_PROD_BOT_TOKEN` no ambiente GitHub `production`.
3. Atualize `DISCORD_BOT_TOKEN_PRODUCTION` no `.env` da VPS e reinicie só o contêiner do bot de produção.
4. Apague o token antigo dos `.env` locais e de qualquer cópia fora da VPS e do ambiente GitHub.

Não grave o token novo no repositório, no exemplo de ambiente nem no Compose de desenvolvimento.
