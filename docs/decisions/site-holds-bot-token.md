# O site guarda o token do bot para ler o Discord

## Contexto

Até aqui só o site de desenvolvimento recebia `DISCORD_BOT_TOKEN`, para o DevMock listar os servidores do bot; o site de produção não o recebia (regra fixada em `tests/deploy-migration.test.ts`). O painel precisa ler o Discord com a identidade do bot: listar os canais de um servidor (seletor de canal ao enviar uma mensagem) e, nos próximos módulos, listar os servidores de cada usuário em que o bot está, usar imagens do bot e editar o perfil dele. O Discord só entrega canais a quem tem o token do bot; o token OAuth do usuário não basta.

Alternativa avaliada e descartada: o bot gravar os canais no banco e o site só ler. Evita o token no site, mas exige tabela, migration, sincronização no bot e não cobre os outros usos.

## Decisão

Aprovada pelo responsável em 29 de outubro de 2026: o serviço `site` recebe `DISCORD_BOT_TOKEN` em desenvolvimento e em produção. Substitui a regra anterior de que o site de produção não recebe o token. Emenda aprovada em 1º de novembro de 2026: o serviço `site` também recebe `DISCORD_BOT_ID` (client id do OAuth) e `DISCORD_CLIENT_SECRET` nos dois Composes, porque sem o par o login real fica `indisponivel` (o Compose só repassa as chaves listadas em `environment`). O `DISCORD_CLIENT_SECRET` é um segredo a mais no processo do site, usado só na troca do código OAuth em `apps/site/server/auth.ts`; o serviço `bot` não o recebe. O site continua sem `OWNER_ID`.

## Impacto

O processo do site, que atende a internet, passa a ter uma credencial com todos os poderes do bot: o Discord não permite limitar o escopo de um token de bot. Quem conseguir executar código no site controla o bot. Isso aumenta a superfície de ataque do site e é a razão dos controles abaixo.

## Controles compensatórios

1. **Só no servidor.** `apps/site/server/discord.ts` é o único ponto que usa o token. Ele não entra no bundle (`apps/site/src`), nem em respostas de API, mensagens de erro ou logs.
2. **Fora da configuração serializável.** `readSiteConfig` guarda `botToken` como propriedade não enumerável: `JSON.stringify`, spread e `util.inspect` da configuração não o mostram.
3. **Leituras com caminho fixo.** O site só faz `GET` a caminhos montados em código, com IDs validados como snowflake; nada vindo do navegador vira caminho ou cabeçalho.
4. **Autorização por servidor.** `GET /api/guilds/:guildId/channels|categories|roles` exige sessão e que o usuário administre aquele servidor (dono, Administrador ou Gerenciar servidor); sem isso responde 401 ou 404 sem consultar o Discord.
5. **Volume limitado.** Cache de 30 segundos por caminho consultado, no máximo 300 respostas em memória e timeout de 5 segundos por chamada.
6. **Escritas no Discord pelo site** (editar o perfil do bot, por exemplo) não existem hoje. Quando forem implementadas, entram em `discord.ts` com os mesmos controles e passam a ser listadas aqui.
7. **Um só segredo.** O site usa o mesmo `DISCORD_BOT_TOKEN` do bot, do config Doppler do ambiente. Rotacionar no Developer Portal e no Doppler vale para os dois; reinicie `bot` e `site` depois. O Compose lista só o nome da chave, sem valor, e o gitleaks continua ativo.

## Estado

Implementado: leitura de canais, categorias e cargos (`GET /api/guilds/:guildId/channels|categories|roles`), usada pelos seletores `ChannelSelect`, `CategorySelect` e `RoleSelect` (`apps/site/src/components/selectors/`); o envio de um template a um canal já usa o seletor de canal. Pendentes, sem data: servidores de cada usuário em que o bot está, imagens do bot e edição do perfil do bot.

## Verificação

- `tests/deploy-migration.test.ts`: o `compose.yaml` de produção entrega `DISCORD_BOT_TOKEN`, `DISCORD_BOT_ID` e `DISCORD_CLIENT_SECRET` ao site; o `bot` não recebe o client secret.
- `tests/site.test.ts`: o token é lido nos dois ambientes e não aparece em serialização, spread nem inspeção da configuração.
- `tests/guild-api.test.ts`: autorização, validação de IDs, mapeamento de erros sem vazar o token, cache, filtro e ordem de canais, categorias e cargos.
