# Sincronização de commands no startup

## Contexto

O bot só sincronizava com `AUTO_SYNC_COMMANDS=true`, e os Composes fixavam `false`; publicar commands era um passo manual (`npm run deploy:commands`). Um command novo, editado ou removido ficava desatualizado no Discord até alguém lembrar de publicar. Publicar sempre no startup também não serve: o `PUT` reescreve o conjunto do escopo a cada reinício.

## Decisão

Em 1º de novembro de 2026, o usuário pediu que o start do Docker (produção e desenvolvimento) cuide disso sozinho. Em seguida o usuário decidiu que o processo é obrigatório e a variável `AUTO_SYNC_COMMANDS` é inútil: ela foi removida do config, do bootstrap e dos Composes. A cada startup do bot, antes do Gateway, para o escopo global e para cada guilda de desenvolvimento cadastrada:

1. lê os commands registrados no Discord (`GET`);
2. compara com os commands locais, por nome, ignorando o que o Discord preenche sozinho;
3. sem diferença, não escreve nada;
4. com algum command adicionado, editado ou removido, faz um único `PUT` do conjunto do escopo, que publica o novo e já limpa o removido do registro do Discord.

`npm run deploy:commands` continua publicando sempre.

## Impacto

- Reinícios sem mudança de commands não geram escrita no Discord.
- Se o Discord não responder na leitura ou na escrita, o startup falha antes do readiness (log sem token), como falha de qualquer outra validação de startup. A exceção para `50001` e `10004` numa guilda de equipe está na seção seguinte.
- O cadastro das guildas de desenvolvimento é lido no startup. Sem guildas cadastradas, esse escopo não é publicado e o startup não falha.

## Controles

- Comparação normalizada e testada com respostas realistas do Discord (`tests/sync-commands.test.ts`). Um falso "mudou" só causa um `PUT` idempotente.
- Os logs `commands_sync_unchanged` e `commands_sync_applied` listam os nomes adicionados, editados e removidos. O aviso `staff_guild_sync_skipped` nomeia o `guildId` e o código Discord quando a guilda de equipe é inacessível (`50001`, `10004`).

## Várias guildas

Em 2 de novembro de 2026 o cadastro deixou de ser uma coluna única. O startup e `npm run deploy:commands` sincronizam o conjunto `dev-guild` em cada linha de `bot_private.bot_dev_guilds`, em ordem de `guild_id`. A comparação por escopo não muda. Tirar uma guilda do cadastro não apaga os commands que já estavam nela.

## Guilda inacessível

Em 2 de novembro de 2026 uma guilda cadastrada em `bot_private.bot_dev_guilds` da qual o bot não era membro fez o Discord responder `DiscordAPIError[50001]` (Missing Access) e o startup inteiro falhou antes do Gateway. `10004` (Unknown Guild) tem o mesmo efeito. Esses dois códigos, somente na sincronização de uma guilda de equipe, passam a ser o aviso `staff_guild_sync_skipped` com o `guildId`. Essa guilda é pulada e as demais seguem; o readiness não depende delas. Qualquer outro erro de sync, inclusive no escopo global e inclusive `50013`, continua impedindo o readiness. `npm run deploy:commands` usa o mesmo laço. O aviso não inclui token nem corpo da requisição.

## Condição de revisão

Reavaliar com mais de uma réplica do bot, quando dois starts simultâneos poderiam publicar ao mesmo tempo.
