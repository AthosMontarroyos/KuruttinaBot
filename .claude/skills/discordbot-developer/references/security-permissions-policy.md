# Segurança, permissões e políticas

## Segredos

Nunca coloque token, client secret, webhook token ou credencial de usuário em código, logs, screenshots ou Git. Carregue secrets no servidor por variáveis de ambiente/secret manager e valide presença sem imprimir valor. Se houver exposição, interrompa o uso, regenere no Developer Portal, atualize deployments e investigue atividade; remover apenas do commit atual não basta.

## Permissões

Verifique separadamente permissão do usuário (`interaction.memberPermissions`), permissão efetiva do app (`interaction.appPermissions`, `permissionsFor`/`permissionsIn`) e hierarquia/predicados `manageable`, `moderatable`, `kickable` ou `bannable`.

`Administrator` ignora overwrites, mas não supera hierarquia. O bot só gerencia cargos abaixo de sua maior role e membros cuja maior role esteja abaixo dela. Permissões padrão de command não substituem validação runtime.

Overwrites seguem: base `@everyone`, roles, overwrite de everyone, denies/allows agregados de roles e overwrite do membro. Negar `VIEW_CHANNEL` inutiliza permissões dependentes. Threads herdam do parent, mas envio exige `SEND_MESSAGES_IN_THREADS`.

## OAuth2, instalação e contextos

- `GUILD_INSTALL`: instalador precisa de `MANAGE_GUILD`.
- `USER_INSTALL`: app acompanha o usuário e fica limitado às permissões da superfície.
- Contextos: `GUILD`, `BOT_DM` e `PRIVATE_CHANNEL`; private channel requer user-install.
- O link de instalação do Discord suporta `application.commands` e `bot`; scopes de identidade/dados requerem OAuth2 apropriado.
- Scopes OAuth e permission bits não são equivalentes.
- Overwrites específicos de command aceitam até 100 entradas/guild e exigem Bearer token autorizado, não bot token.

Solicite privilégio mínimo. Não use `Administrator` como atalho.

## Dados e conduta

Não implemente self-bot, contorno de rate limit/bloqueio, scraping, DMs sem consentimento, inflação de atividade, venda de API Data, perfilamento ou decisões sensíveis. Message content obtido pela API não pode treinar ML/LLM sem permissão expressa do Discord. Colete e retenha somente o necessário para a função declarada.

## Monetização

Use entitlement como fonte de verdade. `sendPremiumRequired()` está depreciado; use Premium button com `sku_id`. O app pode escolher assinaturas de usuário ou guild, não ambas. Confira políticas, elegibilidade e disponibilidade regional antes de vender.

## Fontes

- [Permissions](https://docs.discord.com/developers/topics/permissions)
- [OAuth2](https://docs.discord.com/developers/topics/oauth2)
- [Installation Context](https://docs.discord.com/developers/resources/application#installation-context)
- [Developer Policy](https://support-dev.discord.com/hc/en-us/articles/8563934450327-Discord-Developer-Policy)
- [Developer Terms](https://support-dev.discord.com/hc/en-us/articles/8562894815383-Discord-Developer-Terms-of-Service)
- [Enabling Monetization](https://docs.discord.com/developers/monetization/enabling-monetization)
- [Managing SKUs](https://docs.discord.com/developers/monetization/managing-skus)
