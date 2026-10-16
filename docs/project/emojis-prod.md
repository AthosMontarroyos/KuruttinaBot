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

O job instala a Doppler CLI com `dopplerhq/cli-action` e lê `DISCORD_BOT_TOKEN` do config `prd` por `doppler run --only-secrets DISCORD_BOT_TOKEN`. A autenticação é `DOPPLER_TOKEN`, segredo do ambiente GitHub `production`. Esse segredo é usado só por este workflow. Não é segredo do repositório, não entra no Compose e não é enviado à VPS.

O contêiner de produção na VPS lê o mesmo nome `DISCORD_BOT_TOKEN` pelo token Doppler já configurado para o usuário `deploy`. Desenvolvimento usa o config `dev`, também com `DISCORD_BOT_TOKEN` e `DISCORD_BOT_ID`, sem o token de production.

## Rotacionar o token antigo

O token de produção que já esteve em máquinas de desenvolvimento deve ser trocado.

1. No Discord Developer Portal, gere um token novo para a aplicação de produção.
2. Atualize `DISCORD_BOT_TOKEN` no config Doppler `prd`.
3. Reinicie só o contêiner do bot de produção, com `doppler run -- docker compose up -d bot`.
4. Apague cópias antigas fora do Doppler, inclusive o segredo GitHub `DISCORD_PROD_BOT_TOKEN` depois do primeiro deploy com Doppler.

A ordem completa está na [checklist de migração](deploy.md#checklist-de-migração-para-o-doppler). Não grave o token novo no repositório nem no Compose.
